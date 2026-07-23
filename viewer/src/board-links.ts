/**
 * Board-authored cross-source link policy (KRA-811).
 *
 * The policy runs only after source-v1 admission. Detail joins take their key
 * exclusively from the admitted, signed surface identity. Collection joins
 * take it from an exact, signed ExternalRef carrier. Neither path consults a
 * request query, a configured representative pin, a label, or a displayed
 * value as an identity fallback.
 */

import { type SurfaceNode, surfaceFamily } from "$lib/surface-edge/spec.js";
import type { BoardConfig, BoardJoin } from "./sources.js";

const IDENTITY_RE = /^[A-Za-z0-9_-]{1,128}$/;

export type LinkPaintMode = "scalar-value" | "linked-ref-label";

export interface ResolvedLinkPaint {
	readonly href: string;
	readonly mode: LinkPaintMode;
}

export interface BoardLinkPlan {
	readonly paints: ReadonlyMap<string, ResolvedLinkPaint>;
}

export class BoardLinkResolutionError extends Error {}

/** Cache namespace: a mount or join-policy change must never reuse joined stale trees. */
export function boardLinkPolicyKey(config: BoardConfig): string {
	return JSON.stringify({
		board: config.board,
		dimensions: config.dimensions,
		sources: [...config.sources].map(([id, source]) => ({
			id,
			title: source.title,
			baseUrl: source.baseUrl,
			tokenEnv: source.tokenEnv,
			dialectHint: source.dialectHint,
			icon: source.icon,
			collectionRoot: source.collectionRoot,
			governedParams: source.governedParams,
			homePanel: source.homePanel,
			surfaces: source.surfaces,
			sourceTrust:
				source.sourceTrust === undefined
					? undefined
					: {
							issuer: source.sourceTrust.issuer,
							publicKeys: [...source.sourceTrust.publicKeys].map(([issuer, keys]) => [
								issuer,
								[...keys],
							]),
							maxAgeSeconds: source.sourceTrust.maxAgeSeconds,
							maxFutureSkewSeconds: source.sourceTrust.maxFutureSkewSeconds,
						},
		})),
		joins: config.joins,
	});
}

/**
 * Resolve every active directional declaration for one admitted surface.
 * A declaration whose target source is absent is dormant by design, which is
 * how a board subset remains byte-identical without inventing a fallback.
 */
export function resolveBoardLinks(
	config: BoardConfig,
	sourceId: string,
	admittedSurfaceId: string,
	spec: SurfaceNode,
	asOf?: string,
): BoardLinkPlan {
	const family = surfaceFamily(admittedSurfaceId);
	if (family === null) {
		throw new BoardLinkResolutionError("admitted surface_id is outside the surface family grammar");
	}

	const paints = new Map<string, ResolvedLinkPaint>();
	for (const join of config.joins) {
		if (join.from.source !== sourceId || join.from.family !== family) continue;
		if (!config.sources.has(join.target.source)) continue;

		if (join.from.selector.kind === "admitted-surface-id") {
			const key = admittedIdentity(admittedSurfaceId, join.from.selector.instanceSegment);
			const href = targetHref(join, key, asOf);
			addPaint(paints, join.from.paint.path, { href, mode: join.from.paint.mode }, join.id);
			continue;
		}

		const matches = exactPathMatches(spec, join.from.paint.path);
		for (const node of matches) {
			if (node.strategy !== "linked-ref" || node.href === undefined) {
				throw new BoardLinkResolutionError(
					`join ${join.id}: ${node.path} is not a signed linked-ref carrier`,
				);
			}
			const key = externalIdentity(node.href, join.from.selector.scheme, join.id, node.path);
			const href = targetHref(join, key, asOf);
			addPaint(paints, node.path, { href, mode: join.from.paint.mode }, join.id);
		}
	}
	return { paints };
}

function admittedIdentity(surfaceId: string, segment: number): string {
	const separator = surfaceId.indexOf(":");
	const value = surfaceId.slice(separator + 1).split(":")[segment];
	if (value === undefined || !IDENTITY_RE.test(value)) {
		throw new BoardLinkResolutionError(
			`admitted surface_id has no safe instance segment ${segment}`,
		);
	}
	return value;
}

function targetHref(join: BoardJoin, identity: string, asOf: string | undefined): string {
	const query = new URLSearchParams([[join.target.queryParameter, identity]]);
	if (asOf !== undefined && asOf !== "") query.set("as_of", asOf);
	return `/s/${join.target.source}/${join.target.pane}?${query.toString()}`;
}

function externalIdentity(href: string, scheme: string, joinId: string, path: string): string {
	let parsed: URL;
	try {
		parsed = new URL(href);
	} catch {
		throw new BoardLinkResolutionError(`join ${joinId}: ${path} has a malformed ExternalRef`);
	}
	if (
		parsed.protocol !== `${scheme}:` ||
		parsed.host !== "" ||
		parsed.username !== "" ||
		parsed.password !== "" ||
		parsed.port !== "" ||
		parsed.search !== "" ||
		parsed.hash !== "" ||
		!href.startsWith(`${scheme}:///`) ||
		!/^\/[^/]+$/.test(parsed.pathname)
	) {
		throw new BoardLinkResolutionError(`join ${joinId}: ${path} is not ${scheme}:///one-identity`);
	}
	let identity: string;
	try {
		identity = decodeURIComponent(parsed.pathname.slice(1));
	} catch {
		throw new BoardLinkResolutionError(`join ${joinId}: ${path} has invalid identity encoding`);
	}
	if (!IDENTITY_RE.test(identity)) {
		throw new BoardLinkResolutionError(`join ${joinId}: ${path} has an unsafe identity`);
	}
	return identity;
}

function addPaint(
	paints: Map<string, ResolvedLinkPaint>,
	path: string,
	paint: ResolvedLinkPaint,
	joinId: string,
): void {
	if (paints.has(path)) {
		throw new BoardLinkResolutionError(`join ${joinId}: multiple declarations paint ${path}`);
	}
	paints.set(path, paint);
}

function exactPathMatches(root: SurfaceNode, pattern: string): readonly SurfaceNode[] {
	const matcher = pathPattern(pattern);
	const all = surfaceNodes(root);
	const matches = all.filter((node) => matcher.test(node.path));
	if (matches.length > 0) return matches;

	const wildcard = pattern.indexOf("[*]");
	if (wildcard !== -1) {
		const collection = all.find((node) => node.path === pattern.slice(0, wildcard));
		if (collection !== undefined && collection.items.length === 0) return [];
	}
	throw new BoardLinkResolutionError(`declared paint path ${pattern} is absent from admitted IR`);
}

function surfaceNodes(root: SurfaceNode): readonly SurfaceNode[] {
	const nodes: SurfaceNode[] = [];
	const pending: SurfaceNode[] = [root];
	while (pending.length > 0) {
		const node = pending.pop();
		if (node === undefined) break;
		nodes.push(node);
		pending.push(...node.children, ...node.items);
	}
	return nodes;
}

function pathPattern(pattern: string): RegExp {
	let source = "^\\$";
	let cursor = 1;
	while (cursor < pattern.length) {
		if (pattern.startsWith("[*]", cursor)) {
			source += "\\[\\d+\\]";
			cursor += 3;
			continue;
		}
		if (pattern[cursor] !== ".") {
			throw new BoardLinkResolutionError(`invalid paint path ${pattern}`);
		}
		const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(pattern.slice(cursor + 1));
		if (match === null) throw new BoardLinkResolutionError(`invalid paint path ${pattern}`);
		source += `\\.${match[0]}`;
		cursor += match[0].length + 1;
	}
	return new RegExp(`${source}$`);
}

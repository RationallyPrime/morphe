/**
 * Kernel-link rewiring at the trust gate.
 *
 * A kernel compiles links against ITS OWN origin (`/books/{id}/surfaces/overview`);
 * inside the viewer those hrefs are meaningless. After the gate passes, every navigable
 * link, status, and inline alert in a kernel tree is resolved against the source's
 * DECLARED surface paths:
 *
 * - path matches a declared entry → rewritten to `/s/{source}/{id}`, and the
 *   original query is CARRIED FORWARD onto the viewer href so a filtered link
 *   (`…/obligations?party_id=…`) survives the rewrite. The pane route forwards
 *   that query onto its kernel fetch; kernel-side honoring of the filter is the
 *   producer's concern.
 * - absolute http(s) href                         → left alone (a real external link)
 * - any other kernel-relative href                → DEGRADED to plain text
 *
 * The degrade mirrors the compiler's own absent-href rule (a relation that cannot
 * resolve is not a link) — a dead in-viewer 404 is worse than honest text. The
 * An unresolved ordinary link becomes text; an unresolved feedback drill keeps its
 * feedback node and loses only `href`, so the evidence signal remains honest and inert.
 * Every result is valid in the original Node position, so the gated tree stays gate-valid
 * by construction.
 */

import type { Node } from "$lib";
import type { KernelSurfaceEntry, SourceConfig } from "./sources.js";

/**
 * `carry` are viewer-level presentation params (KRA-789: `as_of`) that must SURVIVE a
 * drill-through so a panel link keeps the home date. They are merged onto the rewritten
 * viewer href AFTER the kernel link's own query, winning on a key collision. An empty or
 * omitted `carry` is a strict no-op — the rewrite stays byte-identical to the pre-KRA-789
 * behavior, so `as_of`-free navigation is unchanged.
 */
export function rewriteKernelLinks(
	tree: Node,
	source: SourceConfig,
	carry?: URLSearchParams,
	hostLinks: ReadonlySet<object> = new Set(),
): Node {
	const routes = declaredRoutes(source);
	const carried = carry !== undefined && [...carry].length > 0 ? carry : undefined;
	return walk(tree, routes, carried, hostLinks) as Node;
}

/** Declared path (query stripped) → viewer pane href. First declaration wins. */
function declaredRoutes(source: SourceConfig): ReadonlyMap<string, string> {
	const routes = new Map<string, string>();
	for (const entry of source.surfaces) {
		if (!("path" in entry)) continue;
		const path = pathOnly((entry as KernelSurfaceEntry).path);
		if (!routes.has(path)) routes.set(path, `/s/${source.id}/${entry.id}`);
	}
	return routes;
}

function pathOnly(href: string): string {
	const cut = href.search(/[?#]/);
	return cut === -1 ? href : href.slice(0, cut);
}

/** The `?query#fragment` suffix of a kernel href, or "" when there is none. */
function querySuffix(href: string): string {
	const cut = href.search(/[?#]/);
	return cut === -1 ? "" : href.slice(cut);
}

function isExternal(href: string): boolean {
	return /^https?:\/\//.test(href);
}

function walk(
	value: unknown,
	routes: ReadonlyMap<string, string>,
	carry: URLSearchParams | undefined,
	hostLinks: ReadonlySet<object>,
): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => walk(item, routes, carry, hostLinks));
	}
	if (typeof value !== "object" || value === null) return value;
	const record = value as Record<string, unknown>;
	if (
		(record.kind === "link" || record.kind === "status" || record.kind === "inline-alert") &&
		typeof record.href === "string"
	) {
		return rewriteNavigable(record, routes, carry, hostLinks);
	}
	const out: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(record)) {
		out[key] = walk(child, routes, carry, hostLinks);
	}
	return out;
}

/** Merge the carried viewer params onto a rewritten viewer href's own query. */
function withCarriedQuery(paneHref: string, carry: URLSearchParams | undefined): string {
	if (carry === undefined) return paneHref;
	const cut = paneHref.search(/[?#]/);
	const base = cut === -1 ? paneHref : paneHref.slice(0, cut);
	const existing = cut === -1 ? "" : paneHref.slice(cut + 1);
	const merged = new URLSearchParams(existing);
	for (const [key, value] of carry) merged.set(key, value);
	const query = merged.toString();
	return query === "" ? base : `${base}?${query}`;
}

function rewriteNavigable(
	node: Record<string, unknown>,
	routes: ReadonlyMap<string, string>,
	carry: URLSearchParams | undefined,
	hostLinks: ReadonlySet<object>,
): Record<string, unknown> {
	const href = node.href as string;
	// Preserve only the exact link objects minted by the host paint pass. String
	// equality is insufficient: a producer-authored link may duplicate a valid
	// board href but still has no authority to create another navigation position.
	if (hostLinks.has(node)) return node;
	if (isExternal(href)) return node;
	const pane = routes.get(pathOnly(href));
	if (pane !== undefined) {
		return { ...node, href: withCarriedQuery(`${pane}${querySuffix(href)}`, carry) };
	}
	if (node.kind === "link") {
		const label = typeof node.label === "string" ? node.label : "";
		return { kind: "text", value: label, as: "body" };
	}
	const { href: _unresolved, ...inert } = node;
	return inert;
}

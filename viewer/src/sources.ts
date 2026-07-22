/**
 * Versioned board configuration for the box viewer (KRA-806/KRA-811).
 *
 * `MORPHE_SOURCES` is one exact v2 board object: `{ version, board, sources,
 * joins }`. The former flat source map is deliberately not accepted; a board
 * declaration is now the only runtime contract.
 * The only source kind is `"kernel"`: a kernel-direct source (Taxis/chreos/…
 * shape) whose entries name a concrete route `path` and negotiate signed
 * source-v1 testimony under source-level trust pins. Store sources and the
 * legacy bare-CompiledSurface representation are retired (KRA-775 Stage 5) —
 * a config that declares either fails closed.
 *
 * Bearer credentials never reach the browser: a source names the PRIVATE env
 * var holding its token via `token_env`, and the SSR load injects it. A named
 * but absent token env is a configuration error (fail closed), never a silent
 * unauthenticated fetch.
 */

import { isValidSurfaceId, surfaceFamily } from "$lib/surface-edge/spec.js";

const SOURCE_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
const SLUG_RE = /^[a-z][a-z0-9-]*$/;
const SURFACE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const FAMILY_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
const QUERY_PARAMETER_RE = /^[a-z][a-z0-9_]*$/;
const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*$/;
const PAINT_PATH_RE = /^\$(?:\.[A-Za-z_][A-Za-z0-9_]*(?:\[\*\])?)+$/;
const RESERVED_VIEWER_QUERY_PARAMETERS = new Set(["as_of", "dialect", "temporal"]);

export interface KernelSurfaceEntry {
	readonly id: string;
	readonly title: string;
	readonly path: string;
	readonly dialectHint?: string;
	readonly representation: "source-v1";
	/** Concrete signed testimony identity; deliberately distinct from the viewer route id. */
	readonly sourceSurfaceId: string;
	/** A declared destination only; omitted from the catalog, collection, and home UI. */
	readonly routeOnly: boolean;
}

export type SurfaceEntry = KernelSurfaceEntry;

export interface SourceTrustConfig {
	readonly issuer: string;
	/** Canonical Ed25519 trust roots, pinned by issuer and then key_id. */
	readonly publicKeys: ReadonlyMap<string, ReadonlyMap<string, string>>;
	readonly maxAgeSeconds?: number;
	readonly maxFutureSkewSeconds?: number;
}

export interface SourceConfig {
	readonly id: string;
	readonly title: string;
	readonly kind: "kernel";
	readonly baseUrl: string;
	readonly tokenEnv?: string;
	readonly dialectHint?: string;
	readonly sourceTrust?: SourceTrustConfig;
	/** Optional Material Symbol name shown on the index card (declared, never inferred). */
	readonly icon?: string;
	/**
	 * The surface id of this source's collection pane — the breadcrumb's middle
	 * rung links here so a detail pane returns to its own collection ("one of N")
	 * rather than the flat index. DECLARED, never inferred: an undeclared source
	 * keeps the current back-to-index behavior, and a value that does not name a
	 * declared surface is a configuration error (fail closed), never a guess.
	 */
	readonly collectionRoot?: string;
	/**
	 * Query params the public viewer must never forward to this producer —
	 * governed-read selectors that flip a surface into a privileged
	 * representation on the caller's authority (Krepis convention:
	 * `include_pii`). Defaults to `["include_pii"]` when undeclared, so a new
	 * source is protected without remembering to configure it; an explicit
	 * empty array is the deliberate opt-out.
	 */
	readonly governedParams: readonly string[];
	/**
	 * Which configured pane represents this source on the composed home surface
	 * (KRA-789), plus the short panel title shown above the grafted digest.
	 * DECLARED, never inferred: an undeclared source is simply absent from home,
	 * and a `pane` that does not name a declared surface is a configuration error
	 * (fail closed), never a guess — boot-validated exactly like `collectionRoot`.
	 */
	readonly homePanel?: HomePanelConfig;
	readonly surfaces: readonly SurfaceEntry[];
}

export interface HomePanelConfig {
	/** The declared surface id this source contributes to home. */
	readonly pane: string;
	/** Short title rendered as the panel's strong lede. */
	readonly title: string;
}

export interface AdmittedSurfaceIdSelector {
	readonly kind: "admitted-surface-id";
	/** Zero-based segment in the admitted id's instance tail. */
	readonly instanceSegment: number;
}

export interface ExternalRefSelector {
	readonly kind: "external-ref";
	readonly scheme: string;
}

export type BoardJoinSelector = AdmittedSurfaceIdSelector | ExternalRefSelector;

export interface BoardJoinPaint {
	readonly path: string;
	readonly mode: "scalar-value" | "linked-ref-label";
}

export interface BoardJoinFrom {
	readonly source: string;
	readonly family: string;
	readonly selector: BoardJoinSelector;
	readonly paint: BoardJoinPaint;
}

export interface BoardJoinTarget {
	readonly source: string;
	readonly pane: string;
	/** Flattened from the wire declaration's `query.parameter`. */
	readonly queryParameter: string;
}

export interface BoardJoin {
	readonly id: string;
	readonly scope: "board";
	readonly from: BoardJoinFrom;
	readonly target: BoardJoinTarget;
}

export interface BoardConfig {
	readonly version: 2;
	/** Null only for the explicit no-environment configuration result. */
	readonly board: string | null;
	readonly sources: ReadonlyMap<string, SourceConfig>;
	readonly joins: readonly BoardJoin[];
}

export type BoardResult =
	| { readonly ok: true; readonly config: BoardConfig }
	| { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | null {
	const value = source[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

function unknownKey(
	context: string,
	raw: Record<string, unknown>,
	allowed: readonly string[],
): string | undefined {
	const allowedKeys = new Set(allowed);
	const key = Object.keys(raw).find((candidate) => !allowedKeys.has(candidate));
	return key === undefined ? undefined : `${context}: unknown key "${key}"`;
}

function canonicalEd25519PublicKey(value: unknown): value is string {
	if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
	try {
		const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}=`;
		const decoded = atob(padded);
		if (decoded.length !== 32) return false;
		let binary = "";
		for (let index = 0; index < decoded.length; index += 1) {
			binary += String.fromCharCode(decoded.charCodeAt(index));
		}
		return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") === value;
	} catch {
		return false;
	}
}

function optionalSeconds(
	sourceId: string,
	raw: Record<string, unknown>,
	key: "max_age_seconds" | "max_future_skew_seconds",
): number | undefined | string {
	const value = raw[key];
	if (value === undefined) return undefined;
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < 0 ||
		(key === "max_age_seconds" && value === 0)
	) {
		return `source ${sourceId}: source_trust.${key} must be a ${
			key === "max_age_seconds" ? "positive" : "non-negative"
		} finite number`;
	}
	return value;
}

function parseSourceTrust(sourceId: string, raw: unknown): SourceTrustConfig | string | undefined {
	if (raw === undefined) return undefined;
	if (!isRecord(raw)) return `source ${sourceId}: source_trust must be an object`;
	const extra = unknownKey(`source ${sourceId}: source_trust`, raw, [
		"issuer",
		"public_keys",
		"max_age_seconds",
		"max_future_skew_seconds",
	]);
	if (extra !== undefined) return extra;
	const issuer = stringField(raw, "issuer");
	if (issuer === null) return `source ${sourceId}: source_trust needs issuer`;
	if (!isRecord(raw.public_keys)) {
		return `source ${sourceId}: source_trust.public_keys must be an object`;
	}
	const issuerPublicKeys = new Map<string, string>();
	for (const [keyId, publicKey] of Object.entries(raw.public_keys)) {
		if (keyId.length === 0 || keyId.length > 256) {
			return `source ${sourceId}: source_trust contains an invalid key id`;
		}
		if (!canonicalEd25519PublicKey(publicKey)) {
			return `source ${sourceId}: source_trust public key ${keyId} is not a canonical raw Ed25519 key`;
		}
		issuerPublicKeys.set(keyId, publicKey);
	}
	if (issuerPublicKeys.size === 0) {
		return `source ${sourceId}: source_trust.public_keys must not be empty`;
	}
	const maxAgeSeconds = optionalSeconds(sourceId, raw, "max_age_seconds");
	if (typeof maxAgeSeconds === "string") return maxAgeSeconds;
	const maxFutureSkewSeconds = optionalSeconds(sourceId, raw, "max_future_skew_seconds");
	if (typeof maxFutureSkewSeconds === "string") return maxFutureSkewSeconds;
	const publicKeys = new Map<string, ReadonlyMap<string, string>>([[issuer, issuerPublicKeys]]);
	return { issuer, publicKeys, maxAgeSeconds, maxFutureSkewSeconds };
}

function parseEntry(sourceId: string, raw: unknown, index: number): SurfaceEntry | string {
	if (!isRecord(raw)) return `source ${sourceId}: surfaces[${index}] is not an object`;
	const extra = unknownKey(`source ${sourceId}: surfaces[${index}]`, raw, [
		"id",
		"title",
		"path",
		"dialect_hint",
		"representation",
		"surface_id",
		"route_only",
	]);
	if (extra !== undefined) return extra;
	const id = stringField(raw, "id");
	if (id === null || !SURFACE_ID_RE.test(id)) {
		return `source ${sourceId}: surfaces[${index}] needs a path-safe id`;
	}
	const title = stringField(raw, "title") ?? id;
	const path = stringField(raw, "path");
	if (path === null || !path.startsWith("/")) {
		return `source ${sourceId}: kernel surface ${id} needs an absolute path`;
	}
	const dialectHint = stringField(raw, "dialect_hint") ?? undefined;
	const representation = raw.representation;
	if (representation === undefined || representation === "legacy") {
		return `source ${sourceId}: kernel surface ${id}: the legacy representation is retired (KRA-775 Stage 5) — declare representation "source-v1"`;
	}
	if (representation !== "source-v1") {
		return `source ${sourceId}: kernel surface ${id} has an unsupported representation`;
	}
	const sourceSurfaceId = stringField(raw, "surface_id");
	if (sourceSurfaceId === null) {
		return `source ${sourceId}: source-v1 surface ${id} needs surface_id`;
	}
	// Boot-time pin check (KRA-777): the pinned surface_id is the family the admission gate
	// keys on, so a misconfigured `<source>:<pane>:…` (or otherwise malformed) pin must fail
	// config load fast rather than silently collapse the family at request time.
	if (!isValidSurfaceId(sourceSurfaceId)) {
		return `source ${sourceId}: kernel surface ${id} surface_id "${sourceSurfaceId}" must be <source>.<pane>:<instance…>`;
	}
	if (typeof raw.route_only !== "boolean") {
		return `source ${sourceId}: kernel surface ${id} needs boolean route_only`;
	}
	return {
		id,
		title,
		path,
		dialectHint,
		representation,
		sourceSurfaceId,
		routeOnly: raw.route_only,
	};
}

function parseSource(sourceId: string, raw: unknown): SourceConfig | string {
	if (!isRecord(raw)) return `source ${sourceId} is not an object`;
	const extra = unknownKey(`source ${sourceId}`, raw, [
		"kind",
		"base_url",
		"title",
		"token_env",
		"dialect_hint",
		"source_trust",
		"icon",
		"collection_root",
		"governed_params",
		"home_panel",
		"surfaces",
	]);
	if (extra !== undefined) return extra;
	const kindValue = stringField(raw, "kind");
	if (kindValue === "store") {
		return `source ${sourceId}: store sources are retired (KRA-775 Stage 5) — the viewer admits kernel source-v1 only`;
	}
	if (kindValue !== "kernel") {
		return `source ${sourceId}: kind must be "kernel"`;
	}
	const baseUrl = stringField(raw, "base_url");
	if (baseUrl === null || !/^https?:\/\//.test(baseUrl)) {
		return `source ${sourceId}: base_url must be an http(s) URL`;
	}
	const title = stringField(raw, "title") ?? sourceId;
	const tokenEnv = stringField(raw, "token_env") ?? undefined;
	const dialectHint = stringField(raw, "dialect_hint") ?? undefined;
	const icon = stringField(raw, "icon") ?? undefined;
	const sourceTrust = parseSourceTrust(sourceId, raw.source_trust);
	if (typeof sourceTrust === "string") return sourceTrust;
	const rawSurfaces = raw.surfaces ?? [];
	if (!Array.isArray(rawSurfaces)) return `source ${sourceId}: surfaces must be an array`;
	const surfaces: SurfaceEntry[] = [];
	const seen = new Set<string>();
	for (const [index, entry] of rawSurfaces.entries()) {
		const parsed = parseEntry(sourceId, entry, index);
		if (typeof parsed === "string") return parsed;
		if (seen.has(parsed.id)) return `source ${sourceId}: duplicate surface id ${parsed.id}`;
		seen.add(parsed.id);
		surfaces.push(parsed);
	}
	if (surfaces.length > 0 && sourceTrust === undefined) {
		return `source ${sourceId}: source-v1 surfaces require source_trust`;
	}
	const collectionRoot = stringField(raw, "collection_root") ?? undefined;
	if (collectionRoot !== undefined && !seen.has(collectionRoot)) {
		return `source ${sourceId}: collection_root "${collectionRoot}" is not a declared surface`;
	}
	if (
		collectionRoot !== undefined &&
		surfaces.find((surface) => surface.id === collectionRoot)?.routeOnly
	) {
		return `source ${sourceId}: collection_root "${collectionRoot}" cannot name a route-only surface`;
	}
	const governedParams = parseGovernedParams(sourceId, raw.governed_params);
	if (typeof governedParams === "string") return governedParams;
	const homePanel = parseHomePanel(sourceId, raw.home_panel, seen, title);
	if (typeof homePanel === "string") return homePanel;
	if (
		homePanel !== undefined &&
		surfaces.find((surface) => surface.id === homePanel.pane)?.routeOnly
	) {
		return `source ${sourceId}: home_panel pane "${homePanel.pane}" cannot name a route-only surface`;
	}
	return {
		id: sourceId,
		title,
		kind: kindValue,
		baseUrl: baseUrl.replace(/\/+$/, ""),
		tokenEnv,
		dialectHint,
		sourceTrust,
		icon,
		collectionRoot,
		governedParams,
		...(homePanel === undefined ? {} : { homePanel }),
		surfaces,
	};
}

/**
 * `home_panel` is config-as-data (KRA-789): `{ pane, title }`. Undeclared means the
 * source is absent from the composed home surface; a declared `pane` MUST name one of
 * this source's own surfaces, boot-validated against `seen` so a typo fails config load
 * fast rather than blanking a home cell at request time. `title` defaults to the source
 * title when omitted.
 */
function parseHomePanel(
	sourceId: string,
	raw: unknown,
	seen: ReadonlySet<string>,
	sourceTitle: string,
): HomePanelConfig | undefined | string {
	if (raw === undefined) return undefined;
	if (!isRecord(raw)) return `source ${sourceId}: home_panel must be an object`;
	const extra = unknownKey(`source ${sourceId}: home_panel`, raw, ["pane", "title"]);
	if (extra !== undefined) return extra;
	const pane = stringField(raw, "pane");
	if (pane === null) return `source ${sourceId}: home_panel needs a pane`;
	if (!seen.has(pane)) {
		return `source ${sourceId}: home_panel pane "${pane}" is not a declared surface`;
	}
	const title = stringField(raw, "title") ?? sourceTitle;
	return { pane, title };
}

/**
 * `governed_params` is fail-closed: undeclared means the Krepis default
 * (`include_pii`); only an explicit empty array opts a source out.
 */
function parseGovernedParams(sourceId: string, raw: unknown): readonly string[] | string {
	if (raw === undefined) return ["include_pii"];
	if (!Array.isArray(raw)) return `source ${sourceId}: governed_params must be an array`;
	const params: string[] = [];
	for (const value of raw) {
		if (typeof value !== "string" || !QUERY_PARAMETER_RE.test(value)) {
			return `source ${sourceId}: governed_params entries must be valid query parameter names`;
		}
		if (!params.includes(value)) params.push(value);
	}
	return params;
}

function parseSelector(joinId: string, raw: unknown): BoardJoinSelector | string {
	if (!isRecord(raw)) return `join ${joinId}: from.selector must be an object`;
	const kind = stringField(raw, "kind");
	if (kind === "admitted-surface-id") {
		const extra = unknownKey(`join ${joinId}: from.selector`, raw, ["kind", "instance_segment"]);
		if (extra !== undefined) return extra;
		if (
			typeof raw.instance_segment !== "number" ||
			!Number.isSafeInteger(raw.instance_segment) ||
			raw.instance_segment < 0
		) {
			return `join ${joinId}: admitted-surface-id selector needs a non-negative integer instance_segment`;
		}
		return { kind, instanceSegment: raw.instance_segment };
	}
	if (kind === "external-ref") {
		const extra = unknownKey(`join ${joinId}: from.selector`, raw, ["kind", "scheme"]);
		if (extra !== undefined) return extra;
		const scheme = stringField(raw, "scheme");
		if (scheme === null || !URI_SCHEME_RE.test(scheme)) {
			return `join ${joinId}: external-ref selector needs a valid lowercase URI scheme`;
		}
		return { kind, scheme };
	}
	return `join ${joinId}: from.selector.kind is unsupported`;
}

function parsePaint(joinId: string, raw: unknown): BoardJoinPaint | string {
	if (!isRecord(raw)) return `join ${joinId}: from.paint must be an object`;
	const extra = unknownKey(`join ${joinId}: from.paint`, raw, ["path", "mode"]);
	if (extra !== undefined) return extra;
	const path = stringField(raw, "path");
	if (path === null || !PAINT_PATH_RE.test(path)) {
		return `join ${joinId}: from.paint.path must be a concrete compiler JSON path`;
	}
	const mode = stringField(raw, "mode");
	if (mode !== "scalar-value" && mode !== "linked-ref-label") {
		return `join ${joinId}: from.paint.mode must be "scalar-value" or "linked-ref-label"`;
	}
	return { path, mode };
}

function parseJoinFrom(joinId: string, raw: unknown): BoardJoinFrom | string {
	if (!isRecord(raw)) return `join ${joinId}: from must be an object`;
	const extra = unknownKey(`join ${joinId}: from`, raw, ["source", "family", "selector", "paint"]);
	if (extra !== undefined) return extra;
	const source = stringField(raw, "source");
	if (source === null || !SOURCE_ID_RE.test(source)) {
		return `join ${joinId}: from.source must be a path-safe source id`;
	}
	const family = stringField(raw, "family");
	if (family === null || !FAMILY_RE.test(family)) {
		return `join ${joinId}: from.family must be a valid <source>.<pane> family`;
	}
	const selector = parseSelector(joinId, raw.selector);
	if (typeof selector === "string") return selector;
	const paint = parsePaint(joinId, raw.paint);
	if (typeof paint === "string") return paint;
	if (
		(selector.kind === "admitted-surface-id" && paint.mode !== "scalar-value") ||
		(selector.kind === "external-ref" && paint.mode !== "linked-ref-label")
	) {
		return `join ${joinId}: selector ${selector.kind} is incompatible with paint mode ${paint.mode}`;
	}
	return { source, family, selector, paint };
}

function parseJoinTarget(joinId: string, raw: unknown): BoardJoinTarget | string {
	if (!isRecord(raw)) return `join ${joinId}: target must be an object`;
	const extra = unknownKey(`join ${joinId}: target`, raw, ["source", "pane", "query"]);
	if (extra !== undefined) return extra;
	const source = stringField(raw, "source");
	if (source === null || !SOURCE_ID_RE.test(source)) {
		return `join ${joinId}: target.source must be a path-safe source id`;
	}
	const pane = stringField(raw, "pane");
	if (pane === null || !SURFACE_ID_RE.test(pane)) {
		return `join ${joinId}: target.pane must be a path-safe pane id`;
	}
	if (!isRecord(raw.query)) return `join ${joinId}: target.query must be an object`;
	const queryExtra = unknownKey(`join ${joinId}: target.query`, raw.query, ["parameter"]);
	if (queryExtra !== undefined) return queryExtra;
	const queryParameter = stringField(raw.query, "parameter");
	if (queryParameter === null || !QUERY_PARAMETER_RE.test(queryParameter)) {
		return `join ${joinId}: target.query.parameter must be a valid query parameter name`;
	}
	if (RESERVED_VIEWER_QUERY_PARAMETERS.has(queryParameter)) {
		return `join ${joinId}: target query parameter "${queryParameter}" is reserved by the viewer`;
	}
	return { source, pane, queryParameter };
}

function parseJoin(raw: unknown, index: number): BoardJoin | string {
	if (!isRecord(raw)) return `joins[${index}] is not an object`;
	const provisionalId = stringField(raw, "id") ?? `joins[${index}]`;
	const extra = unknownKey(`join ${provisionalId}`, raw, ["id", "scope", "from", "target"]);
	if (extra !== undefined) return extra;
	const id = stringField(raw, "id");
	if (id === null || !SLUG_RE.test(id)) return `joins[${index}] needs a lowercase slug id`;
	if (raw.scope !== "board") return `join ${id}: scope must be "board"`;
	const from = parseJoinFrom(id, raw.from);
	if (typeof from === "string") return from;
	const target = parseJoinTarget(id, raw.target);
	if (typeof target === "string") return target;
	return { id, scope: "board", from, target };
}

function parseJoins(
	raw: unknown,
	sources: ReadonlyMap<string, SourceConfig>,
): readonly BoardJoin[] | string {
	if (!Array.isArray(raw)) return `MORPHE_SOURCES.joins must be an array`;
	const joins: BoardJoin[] = [];
	const seenIds = new Set<string>();
	const paintedFields = new Set<string>();
	for (const [index, wireJoin] of raw.entries()) {
		const join = parseJoin(wireJoin, index);
		if (typeof join === "string") return join;
		if (seenIds.has(join.id)) return `duplicate join id ${join.id}`;
		seenIds.add(join.id);

		const paintedField = `${join.from.source}\u0000${join.from.family}\u0000${join.from.paint.path}`;
		if (paintedFields.has(paintedField)) {
			return `join ${join.id}: from source/family/paint overlaps another join`;
		}
		paintedFields.add(paintedField);

		const fromSource = sources.get(join.from.source);
		if (fromSource === undefined) {
			return `join ${join.id}: from.source "${join.from.source}" is not mounted`;
		}
		if (!join.from.family.startsWith(`${join.from.source}.`)) {
			return `join ${join.id}: from.family source must equal from.source`;
		}
		const fromSurface = fromSource.surfaces.find(
			(surface) => surfaceFamily(surface.sourceSurfaceId) === join.from.family,
		);
		if (fromSurface === undefined) {
			return `join ${join.id}: from.family "${join.from.family}" is not mounted on source "${join.from.source}"`;
		}
		if (join.from.selector.kind === "admitted-surface-id") {
			const instance = fromSurface.sourceSurfaceId.slice(join.from.family.length + 1).split(":");
			if (join.from.selector.instanceSegment >= instance.length) {
				return `join ${join.id}: admitted-surface-id instance_segment is absent from the mounted surface id`;
			}
		}

		// An absent target source makes this declaration dormant. This is intentional:
		// runtime subset boards may mount only one side, while deploy validation owns the
		// stronger whole-board endpoint check.
		const targetSource = sources.get(join.target.source);
		if (targetSource !== undefined) {
			if (join.target.source === join.from.source) {
				return `join ${join.id}: board joins must cross source boundaries`;
			}
			const targetPane = targetSource.surfaces.find((surface) => surface.id === join.target.pane);
			if (targetPane === undefined) {
				return `join ${join.id}: target pane "${join.target.pane}" is not mounted on source "${join.target.source}"`;
			}
			if (!targetPane.routeOnly) {
				return `join ${join.id}: target pane "${join.target.pane}" must declare route_only true`;
			}
			if (targetSource.governedParams.includes(join.target.queryParameter)) {
				return `join ${join.id}: target query parameter "${join.target.queryParameter}" is governed by source "${join.target.source}"`;
			}
		}
		joins.push(join);
	}
	return joins;
}

/**
 * Parse the exact v2 `MORPHE_SOURCES` board contract. An unset environment is
 * the sole empty-board case; empty text, flat source maps, v1 boards, aliases,
 * and unknown keys all fail closed.
 */
export function parseBoardConfig(rawBoard: string | undefined): BoardResult {
	if (rawBoard === undefined) {
		return {
			ok: true,
			config: { version: 2, board: null, sources: new Map(), joins: [] },
		};
	}

	let decoded: unknown;
	try {
		decoded = JSON.parse(rawBoard);
	} catch {
		return { ok: false, reason: "MORPHE_SOURCES is not valid JSON" };
	}
	if (!isRecord(decoded)) return { ok: false, reason: "MORPHE_SOURCES must be a JSON object" };
	const extra = unknownKey("MORPHE_SOURCES", decoded, ["version", "board", "sources", "joins"]);
	if (extra !== undefined) return { ok: false, reason: extra };
	for (const required of ["version", "board", "sources", "joins"] as const) {
		if (!Object.hasOwn(decoded, required)) {
			return { ok: false, reason: `MORPHE_SOURCES needs ${required}` };
		}
	}
	if (decoded.version !== 2) {
		return { ok: false, reason: "MORPHE_SOURCES.version must be 2" };
	}
	const board = stringField(decoded, "board");
	if (board === null || !SLUG_RE.test(board)) {
		return { ok: false, reason: "MORPHE_SOURCES.board must be a lowercase slug" };
	}
	if (!isRecord(decoded.sources)) {
		return { ok: false, reason: "MORPHE_SOURCES.sources must be an object" };
	}
	if (Object.keys(decoded.sources).length === 0) {
		return { ok: false, reason: "MORPHE_SOURCES.sources must not be empty" };
	}

	const sources = new Map<string, SourceConfig>();
	for (const [sourceId, raw] of Object.entries(decoded.sources)) {
		if (!SOURCE_ID_RE.test(sourceId)) {
			return { ok: false, reason: `source id "${sourceId}" is not path-safe` };
		}
		const parsed = parseSource(sourceId, raw);
		if (typeof parsed === "string") return { ok: false, reason: parsed };
		sources.set(sourceId, parsed);
	}
	const joins = parseJoins(decoded.joins, sources);
	if (typeof joins === "string") return { ok: false, reason: joins };
	return { ok: true, config: { version: 2, board, sources, joins } };
}

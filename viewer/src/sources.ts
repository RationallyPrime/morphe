/**
 * Multi-source configuration for the box viewer (KRA-752 §4).
 *
 * `MORPHE_SOURCES` is a JSON object mapping a source id to a source config.
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

import { isValidSurfaceId } from "$lib/surface-edge/spec.js";

const SOURCE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SURFACE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export interface KernelSurfaceEntry {
	readonly id: string;
	readonly title: string;
	readonly path: string;
	readonly dialectHint?: string;
	readonly representation: "source-v1";
	/** Concrete signed testimony identity; deliberately distinct from the viewer route id. */
	readonly sourceSurfaceId: string;
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

export type SourcesResult =
	| { readonly ok: true; readonly sources: ReadonlyMap<string, SourceConfig> }
	| { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | null {
	const value = source[key];
	return typeof value === "string" && value.length > 0 ? value : null;
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
	return { id, title, path, dialectHint, representation, sourceSurfaceId };
}

function parseSource(sourceId: string, raw: unknown): SourceConfig | string {
	if (!isRecord(raw)) return `source ${sourceId} is not an object`;
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
	const governedParams = parseGovernedParams(sourceId, raw.governed_params);
	if (typeof governedParams === "string") return governedParams;
	const homePanel = parseHomePanel(sourceId, raw.home_panel, seen, title);
	if (typeof homePanel === "string") return homePanel;
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
		if (typeof value !== "string" || value.length === 0) {
			return `source ${sourceId}: governed_params entries must be non-empty strings`;
		}
		if (!params.includes(value)) params.push(value);
	}
	return params;
}

/** Parse `MORPHE_SOURCES`; unset or empty means no sources are configured. */
export function parseSourcesConfig(rawSources: string | undefined): SourcesResult {
	if (rawSources === undefined || rawSources === "") {
		return { ok: true, sources: new Map() };
	}

	let decoded: unknown;
	try {
		decoded = JSON.parse(rawSources);
	} catch {
		return { ok: false, reason: "MORPHE_SOURCES is not valid JSON" };
	}
	if (!isRecord(decoded)) return { ok: false, reason: "MORPHE_SOURCES must be a JSON object" };

	const sources = new Map<string, SourceConfig>();
	for (const [sourceId, raw] of Object.entries(decoded)) {
		if (!SOURCE_ID_RE.test(sourceId)) {
			return { ok: false, reason: `source id "${sourceId}" is not path-safe` };
		}
		const parsed = parseSource(sourceId, raw);
		if (typeof parsed === "string") return { ok: false, reason: parsed };
		sources.set(sourceId, parsed);
	}
	return { ok: true, sources };
}

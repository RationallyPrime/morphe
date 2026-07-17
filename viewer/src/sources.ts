/**
 * Multi-source configuration for the box viewer (KRA-752 §4).
 *
 * `MORPHE_SOURCES` is a JSON object mapping a source id to a source config.
 * Two source kinds exist:
 *
 * - `"store"`  — a surface-artifact store (the topos shape): entries name a
 *   stored `artifact_id`; responses carry the outer SurfaceArtifactResponse
 *   envelope and are parsed by `parseSurfaceResponse`.
 * - `"kernel"` — a kernel-direct source (Taxis/chreos/… shape): entries name a
 *   concrete route `path`; omitted/legacy representations are BARE
 *   CompiledSurface responses, while an explicit source-v1 entry negotiates
 *   signed testimony under source-level trust pins.
 *
 * Bearer credentials never reach the browser: a source names the PRIVATE env
 * var holding its token via `token_env`, and the SSR load injects it. A named
 * but absent token env is a configuration error (fail closed), never a silent
 * unauthenticated fetch.
 *
 * Back-compat: with `MORPHE_SOURCES` unset, a configured
 * `MORPHE_ARTIFACT_BASE_URL` synthesizes the single legacy store source used
 * by `/surfaces/[artifactId]`.
 */

const SOURCE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SURFACE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export interface StoreSurfaceEntry {
	readonly id: string;
	readonly title: string;
	readonly artifactId: string;
}

interface KernelSurfaceEntryBase {
	readonly id: string;
	readonly title: string;
	readonly path: string;
	readonly dialectHint?: string;
}

export interface LegacyKernelSurfaceEntry extends KernelSurfaceEntryBase {
	/** Omission is the compatibility-safe legacy default. */
	readonly representation?: "legacy";
}

export interface SourceV1KernelSurfaceEntry extends KernelSurfaceEntryBase {
	readonly representation: "source-v1";
	/** Concrete signed testimony identity; deliberately distinct from the viewer route id. */
	readonly sourceSurfaceId: string;
}

export type KernelSurfaceEntry = LegacyKernelSurfaceEntry | SourceV1KernelSurfaceEntry;

export type SurfaceEntry = StoreSurfaceEntry | KernelSurfaceEntry;

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
	readonly kind: "store" | "kernel";
	readonly baseUrl: string;
	readonly tokenEnv?: string;
	readonly dialectHint?: string;
	readonly sourceTrust?: SourceTrustConfig;
	/** Optional Material Symbol name shown on the index card (declared, never inferred). */
	readonly icon?: string;
	readonly surfaces: readonly SurfaceEntry[];
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

function parseEntry(
	sourceId: string,
	kind: "store" | "kernel",
	raw: unknown,
	index: number,
): SurfaceEntry | string {
	if (!isRecord(raw)) return `source ${sourceId}: surfaces[${index}] is not an object`;
	const id = stringField(raw, "id");
	if (id === null || !SURFACE_ID_RE.test(id)) {
		return `source ${sourceId}: surfaces[${index}] needs a path-safe id`;
	}
	const title = stringField(raw, "title") ?? id;
	if (kind === "store") {
		const artifactId = stringField(raw, "artifact_id");
		if (artifactId === null) {
			return `source ${sourceId}: store surface ${id} needs artifact_id`;
		}
		return { id, title, artifactId };
	}
	const path = stringField(raw, "path");
	if (path === null || !path.startsWith("/")) {
		return `source ${sourceId}: kernel surface ${id} needs an absolute path`;
	}
	const dialectHint = stringField(raw, "dialect_hint") ?? undefined;
	const representation = raw.representation ?? "legacy";
	if (representation !== "legacy" && representation !== "source-v1") {
		return `source ${sourceId}: kernel surface ${id} has an unsupported representation`;
	}
	if (representation === "source-v1") {
		const sourceSurfaceId = stringField(raw, "surface_id");
		if (sourceSurfaceId === null) {
			return `source ${sourceId}: source-v1 surface ${id} needs surface_id`;
		}
		return { id, title, path, dialectHint, representation, sourceSurfaceId };
	}
	return { id, title, path, dialectHint, representation };
}

function parseSource(sourceId: string, raw: unknown): SourceConfig | string {
	if (!isRecord(raw)) return `source ${sourceId} is not an object`;
	const kindValue = stringField(raw, "kind");
	if (kindValue !== "store" && kindValue !== "kernel") {
		return `source ${sourceId}: kind must be "store" or "kernel"`;
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
		const parsed = parseEntry(sourceId, kindValue, entry, index);
		if (typeof parsed === "string") return parsed;
		if (seen.has(parsed.id)) return `source ${sourceId}: duplicate surface id ${parsed.id}`;
		seen.add(parsed.id);
		surfaces.push(parsed);
	}
	if (
		kindValue === "kernel" &&
		surfaces.some(
			(surface) => "representation" in surface && surface.representation === "source-v1",
		) &&
		sourceTrust === undefined
	) {
		return `source ${sourceId}: source-v1 surfaces require source_trust`;
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
		surfaces,
	};
}

/** Parse `MORPHE_SOURCES`, falling back to the legacy single-store env. */
export function parseSourcesConfig(
	rawSources: string | undefined,
	legacyBaseUrl: string | undefined,
): SourcesResult {
	if (rawSources === undefined || rawSources === "") {
		if (legacyBaseUrl === undefined || legacyBaseUrl === "") {
			return { ok: true, sources: new Map() };
		}
		const legacy: SourceConfig = {
			id: "default",
			title: "Artifact store",
			kind: "store",
			baseUrl: legacyBaseUrl.replace(/\/+$/, ""),
			surfaces: [],
		};
		return { ok: true, sources: new Map([[legacy.id, legacy]]) };
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

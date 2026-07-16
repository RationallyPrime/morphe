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
 *   concrete route `path`; responses are a BARE CompiledSurface and are lifted
 *   into the envelope contract by `parseKernelSurfaceResponse`.
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

export interface KernelSurfaceEntry {
	readonly id: string;
	readonly title: string;
	readonly path: string;
	readonly dialectHint?: string;
}

export type SurfaceEntry = StoreSurfaceEntry | KernelSurfaceEntry;

export interface SourceConfig {
	readonly id: string;
	readonly title: string;
	readonly kind: "store" | "kernel";
	readonly baseUrl: string;
	readonly tokenEnv?: string;
	readonly dialectHint?: string;
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
	return { id, title, path, dialectHint };
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
	return {
		id: sourceId,
		title,
		kind: kindValue,
		baseUrl: baseUrl.replace(/\/+$/, ""),
		tokenEnv,
		dialectHint,
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

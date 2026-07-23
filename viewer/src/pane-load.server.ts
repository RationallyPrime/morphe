/**
 * Shared per-pane admission + compile pipeline (KRA-789).
 *
 * ONE function admits a single configured pane the way `/s/[source]/[surfaceId]` always
 * has: build the kernel request (dropping render-only overrides, stripping browser-authored
 * governed selectors, then injecting any trusted board dimension), negotiate signed source-v1
 * testimony, verify + edge-compile under the source trust pins, run the shared grammar/dialect
 * gate, and rewrite kernel links. The pane route and the composed home route both call this so
 * admission can never fork: the home surface is exactly N pane admissions grafted into one
 * authored tree.
 *
 * `as_of` is an ORDINARY presentation/filter param here (KRA-779/KRA-789): it is neither
 * `dialect` nor `temporal`, so it flows onto the kernel fetch as a forwarded filter,
 * which flips the request to a DERIVED instance and admits under the KRA-776 family-mode
 * identity gate. The kernel's resolved window rides back on the family-canonical
 * `admittedSurfaceId`; `resolvedWindow` reports its instance tail when it differs from
 * the pinned representative.
 */

import { error } from "@sveltejs/kit";
import { emitNodeWithTrackedLinkPaints } from "$lib/surface-edge/emit.js";
import { resolveBoardLinks } from "./board-links.js";
import { derivedSurfaceTitle } from "./derived-title.js";
import { forwardedRequest, normalizeViewerQuery, withoutGovernedParams } from "./forward-query.js";
import { rewriteKernelLinks } from "./links.js";
import { parseSourceSurfaceResponse } from "./source-envelope.js";
import type { BoardConfig, SourceConfig, SurfaceEntry } from "./sources.js";
import { type GatedSurface, loadGatedSurface } from "./surface-load.server.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "./surface-reader.js";
import { resolveTemporalPolicy, TEMPORAL_QUERY_KEY } from "./temporal.js";

export interface PaneLoadRequest {
	readonly board: BoardConfig;
	readonly source: SourceConfig;
	readonly entry: SurfaceEntry;
	readonly searchParams: URLSearchParams;
	readonly fetch: typeof globalThis.fetch;
	/** Pre-resolved bearer (the caller owns the PRIVATE token env, keeping this `$env`-free). */
	readonly bearer?: string;
	/** Raw `?dialect=` value for the pane route; the composed home forces one home dialect. */
	readonly dialectOverride: string | null;
}

export interface PaneLoad {
	readonly surface: GatedSurface;
	readonly surfaceTitle: string;
	readonly collectionHref?: string;
	readonly temporalPolicy: ReturnType<typeof resolveTemporalPolicy>;
	/**
	 * The kernel's resolved-window instance (the tail of the admitted family-canonical
	 * `surface_id`), present only when a derived request resolved to an instance other
	 * than the pinned representative — i.e. there is something worth captioning.
	 */
	readonly resolvedWindow?: string;
}

export interface PaneRequestIdentity {
	readonly normalizedQuery: URLSearchParams;
	readonly temporalPolicy: ReturnType<typeof resolveTemporalPolicy>;
	/** Public filters safe to carry into rewritten browser links. */
	readonly carriedQuery: URLSearchParams;
	/** Effective producer query, including any board-trusted governed dimension. */
	readonly producerQuery: URLSearchParams;
	readonly forwarded: ReturnType<typeof forwardedRequest>;
	/** Bounded-cache discriminator for the exact effective delivery request. */
	readonly cacheKey: string;
}

/**
 * Resolve the single request identity shared by fetch, admission mode, and home cache.
 * Dialect is keyed separately; temporal affects compilation, while the governed-cleaned
 * public query and separately injected trusted dimension determine exactly what the producer
 * is asked to sign. Only the public-safe query may be carried back into browser links.
 */
export function paneRequestIdentity(
	board: BoardConfig,
	source: SourceConfig,
	entry: SurfaceEntry,
	searchParams: URLSearchParams,
): PaneRequestIdentity {
	const normalizedQuery = normalizeViewerQuery(searchParams);
	const temporalPolicy = resolveTemporalPolicy(normalizedQuery.get(TEMPORAL_QUERY_KEY));
	const rawQuery = new URLSearchParams(normalizedQuery);
	rawQuery.delete("dialect");
	rawQuery.delete(TEMPORAL_QUERY_KEY);
	const carriedQuery = withoutGovernedParams(rawQuery, source.governedParams);
	const producerQuery = new URLSearchParams(carriedQuery);
	const injectTrustedPii =
		board.dimensions?.includePii === true &&
		source.governedParams.includes("include_pii") &&
		entry.governedParams.includes("include_pii");
	if (injectTrustedPii) producerQuery.set("include_pii", "true");
	const effectiveRequest = forwardedRequest(entry.path, producerQuery);
	const forwarded = injectTrustedPii
		? { path: effectiveRequest.path, derived: true as const }
		: effectiveRequest;
	return {
		normalizedQuery,
		temporalPolicy,
		carriedQuery,
		producerQuery,
		forwarded,
		cacheKey: JSON.stringify([forwarded.path, temporalPolicy, { includePii: injectTrustedPii }]),
	};
}

/** The instance tail of a `<source>.<pane>:<instance…>` id (everything after the first `:`). */
function surfaceInstance(surfaceId: string): string | undefined {
	const cut = surfaceId.indexOf(":");
	return cut === -1 ? undefined : surfaceId.slice(cut + 1);
}

export async function loadSourcePane(request: PaneLoadRequest): Promise<PaneLoad> {
	const { board, source, entry, searchParams, fetch, bearer, dialectOverride } = request;
	const { temporalPolicy, carriedQuery, forwarded } = paneRequestIdentity(
		board,
		source,
		entry,
		searchParams,
	);

	const collectionHref =
		source.collectionRoot !== undefined && source.collectionRoot !== entry.id
			? `/s/${source.id}/${source.collectionRoot}`
			: undefined;

	// Preserve `as_of` (and any surviving viewer filter) on rewritten drill-through links so a
	// panel click keeps the selected date (KRA-768 query preservation, KRA-789 fan-out).
	const carry = new URLSearchParams(carriedQuery);

	const artifactId = `${source.id}:${entry.id}`;
	const dialectHint = entry.dialectHint ?? source.dialectHint ?? "ledger";
	const trust = source.sourceTrust;
	if (trust === undefined) {
		error(503, { message: `Source "${source.id}" has no source-v1 trust configuration.` });
	}
	const freshness = {
		...(trust.maxAgeSeconds === undefined ? {} : { maxAgeMs: trust.maxAgeSeconds * 1_000 }),
		...(trust.maxFutureSkewSeconds === undefined
			? {}
			: { maxFutureSkewMs: trust.maxFutureSkewSeconds * 1_000 }),
	};
	const surface = await loadGatedSurface({
		fetch,
		url: `${source.baseUrl}${forwarded.path}`,
		artifactId,
		bearer,
		accept: SOURCE_SURFACE_V1_MEDIA_TYPE,
		parse: (response) =>
			parseSourceSurfaceResponse(response, {
				artifactId,
				dialectHint,
				temporalPolicy,
				admission: {
					expectedIssuer: trust.issuer,
					expectedSurfaceId: entry.sourceSurfaceId,
					surfaceIdMatch: forwarded.derived ? "family" : "exact",
					publicKeys: trust.publicKeys,
					freshness,
				},
			}),
		dialectOverride,
		transformTree: (tree, context) => {
			if (
				context.admittedSurfaceId === undefined ||
				context.sourceIr === undefined ||
				context.sourceEmitContext === undefined
			) {
				throw new Error("source-v1 delivery omitted its admitted identity or compiler context");
			}
			const plan = resolveBoardLinks(
				board,
				source.id,
				context.admittedSurfaceId,
				context.sourceIr,
				carry.get("as_of") ?? undefined,
			);
			if (plan.paints.size === 0) return rewriteKernelLinks(tree, source, carry);
			const painted = emitNodeWithTrackedLinkPaints(
				context.sourceIr,
				plan.paints,
				undefined,
				context.sourceEmitContext,
			);
			return rewriteKernelLinks(painted.tree, source, carry, painted.paintedLinks);
		},
	});

	// A derived instance is a DIFFERENT surface than the pin: its crumb/title come from the
	// artifact's own leading heading, not the declared title of the pinned representative.
	const surfaceTitle = forwarded.derived
		? (derivedSurfaceTitle(surface.tree) ?? entry.title)
		: entry.title;

	// The resolved-window caption only makes sense when the kernel resolved a derived request
	// to a concrete instance other than the pin — then the family-canonical id carries the
	// window the producer actually served.
	const resolvedWindow =
		forwarded.derived &&
		surface.admittedSurfaceId !== undefined &&
		surface.admittedSurfaceId !== entry.sourceSurfaceId
			? surfaceInstance(surface.admittedSurfaceId)
			: undefined;

	return {
		surface,
		surfaceTitle,
		collectionHref,
		temporalPolicy,
		...(resolvedWindow === undefined ? {} : { resolvedWindow }),
	};
}

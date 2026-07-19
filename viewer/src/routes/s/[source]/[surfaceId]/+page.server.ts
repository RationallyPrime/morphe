import { error } from "@sveltejs/kit";
import { parseKernelSurfaceResponse, parseSurfaceResponse } from "../../../../envelope.js";
import { forwardedRequest, withoutGovernedParams } from "../../../../forward-query.js";
import { rewriteKernelLinks } from "../../../../links.js";
import { parseSourceSurfaceResponse } from "../../../../source-envelope.js";
import { bearerFor, loadSources } from "../../../../sources.server.js";
import { loadGatedSurface } from "../../../../surface-load.server.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "../../../../surface-reader.js";
import { resolveTemporalPolicy, TEMPORAL_QUERY_KEY } from "../../../../temporal.js";
import type { PageServerLoad } from "./$types.js";

/*
 * /s/[source]/[surfaceId] — the multi-source viewer route (KRA-752 §4).
 *
 * Both segments resolve against declared config only: an unknown source or an
 * undeclared surface id is a 404, never a proxied guess — the viewer is not an
 * open proxy onto the docker network. Store sources fetch a stored artifact by
 * its declared artifact_id; kernel sources either lift the legacy bare
 * CompiledSurface or admit and edge-compile signed source-v1 testimony. Kernel
 * links are rewired against declared paths inside the final grammar/dialect
 * gate (viewer-navigable or degraded to text — never a dead in-viewer href).
 *
 * The breadcrumb's middle rung (`collectionHref`) points at the source's
 * DECLARED `collectionRoot` — undeclared, or when the current pane already IS
 * the collection, it is absent and the chrome falls back to the flat index.
 * Any viewer query beyond `dialect` (e.g. `?party_id=`) is forwarded onto the
 * kernel fetch so a filtered link that survived `rewriteKernelLinks` actually
 * reaches the producer as a filter.
 */

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const sources = loadSources();
	const source = sources.get(params.source);
	if (source === undefined) error(404, { message: "Unknown source." });
	const entry = source.surfaces.find((surface) => surface.id === params.surfaceId);
	if (entry === undefined) error(404, { message: "Unknown surface." });

	const bearer = bearerFor(source);
	const dialectOverride = url.searchParams.get("dialect");
	// The instant presentation policy rides `?temporal=` exactly as the dialect
	// override rides `?dialect=`; it applies only to source-v1 panes (a legacy tree
	// carries baked display text), so it is threaded solely into that branch below.
	const temporalPolicy = resolveTemporalPolicy(url.searchParams.get(TEMPORAL_QUERY_KEY));

	// Breadcrumb "one of N" rung: link the source's declared collection pane,
	// unless this pane already is it (no self-link) or none is declared.
	const collectionHref =
		source.collectionRoot !== undefined && source.collectionRoot !== entry.id
			? `/s/${source.id}/${source.collectionRoot}`
			: undefined;

	// Everything except the render-only overrides (dialect, temporal) is a
	// producer-facing filter (party_id, …) forwarded onto the kernel fetch. The
	// temporal policy is a client-side presentation choice — it never reaches the
	// producer, and forwarding it would leak a viewer concern onto the kernel.
	// Governed-read selectors (source.governedParams) are stripped last: the
	// anonymous public edge must never request a privileged representation.
	const rawQuery = new URLSearchParams(url.searchParams);
	rawQuery.delete("dialect");
	rawQuery.delete(TEMPORAL_QUERY_KEY);
	const forwardedQuery = withoutGovernedParams(rawQuery, source.governedParams);

	if ("artifactId" in entry) {
		const surface = await loadGatedSurface({
			fetch,
			url: `${source.baseUrl}/${encodeURIComponent(entry.artifactId)}`,
			artifactId: entry.artifactId,
			bearer,
			parse: (response) => parseSurfaceResponse(response, { expectedArtifactId: entry.artifactId }),
			dialectOverride,
		});
		// Legacy store artifacts carry baked display text; the temporal control is inert.
		return {
			...surface,
			sourceTitle: source.title,
			surfaceTitle: entry.title,
			collectionHref,
			temporalPolicy: null,
		};
	}

	const artifactId = `${source.id}:${entry.id}`;
	const dialectHint = entry.dialectHint ?? source.dialectHint ?? "ledger";
	// Build the kernel request once. `derived` is true when the viewer forwarded a
	// filter beyond what the declared path already carries — a drill-through instance
	// whose producer emits a param-scoped surface_id. That single bit chooses the
	// source-v1 identity gate mode below; it is known here from how we built the URL,
	// never inferred from the artifact.
	const forwarded = forwardedRequest(entry.path, forwardedQuery);
	if (entry.representation === "source-v1") {
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
			transformTree: (tree) => rewriteKernelLinks(tree, source),
		});
		// Source-v1 panes honor the temporal control; report the effective policy so
		// the chrome renders it and marks the current selection.
		return {
			...surface,
			sourceTitle: source.title,
			surfaceTitle: entry.title,
			collectionHref,
			temporalPolicy,
		};
	}
	const surface = await loadGatedSurface({
		fetch,
		url: `${source.baseUrl}${forwarded.path}`,
		artifactId,
		bearer,
		parse: (response) => parseKernelSurfaceResponse(response, { artifactId, dialectHint }),
		dialectOverride,
		transformTree: (tree) => rewriteKernelLinks(tree, source),
	});
	// A legacy bare CompiledSurface is already lowered; the temporal control is inert.
	return {
		...surface,
		sourceTitle: source.title,
		surfaceTitle: entry.title,
		collectionHref,
		temporalPolicy: null,
	};
};

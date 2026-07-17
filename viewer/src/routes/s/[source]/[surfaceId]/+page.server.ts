import { error } from "@sveltejs/kit";
import { parseKernelSurfaceResponse, parseSurfaceResponse } from "../../../../envelope.js";
import { rewriteKernelLinks } from "../../../../links.js";
import { parseSourceSurfaceResponse } from "../../../../source-envelope.js";
import { bearerFor, loadSources } from "../../../../sources.server.js";
import { loadGatedSurface } from "../../../../surface-load.server.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "../../../../surface-reader.js";
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
 */

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const sources = loadSources();
	const source = sources.get(params.source);
	if (source === undefined) error(404, { message: "Unknown source." });
	const entry = source.surfaces.find((surface) => surface.id === params.surfaceId);
	if (entry === undefined) error(404, { message: "Unknown surface." });

	const bearer = bearerFor(source);
	const dialectOverride = url.searchParams.get("dialect");

	if ("artifactId" in entry) {
		const surface = await loadGatedSurface({
			fetch,
			url: `${source.baseUrl}/${encodeURIComponent(entry.artifactId)}`,
			artifactId: entry.artifactId,
			bearer,
			parse: (response) => parseSurfaceResponse(response, { expectedArtifactId: entry.artifactId }),
			dialectOverride,
		});
		return { ...surface, sourceTitle: source.title, surfaceTitle: entry.title };
	}

	const artifactId = `${source.id}:${entry.id}`;
	const dialectHint = entry.dialectHint ?? source.dialectHint ?? "ledger";
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
			url: `${source.baseUrl}${entry.path}`,
			artifactId,
			bearer,
			accept: SOURCE_SURFACE_V1_MEDIA_TYPE,
			parse: (response) =>
				parseSourceSurfaceResponse(response, {
					artifactId,
					dialectHint,
					admission: {
						expectedIssuer: trust.issuer,
						expectedSurfaceId: entry.sourceSurfaceId,
						publicKeys: trust.publicKeys,
						freshness,
					},
				}),
			dialectOverride,
			transformTree: (tree) => rewriteKernelLinks(tree, source),
		});
		return { ...surface, sourceTitle: source.title, surfaceTitle: entry.title };
	}
	const surface = await loadGatedSurface({
		fetch,
		url: `${source.baseUrl}${entry.path}`,
		artifactId,
		bearer,
		parse: (response) => parseKernelSurfaceResponse(response, { artifactId, dialectHint }),
		dialectOverride,
		transformTree: (tree) => rewriteKernelLinks(tree, source),
	});
	return {
		...surface,
		sourceTitle: source.title,
		surfaceTitle: entry.title,
	};
};

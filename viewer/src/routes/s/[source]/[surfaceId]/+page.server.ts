import { error } from "@sveltejs/kit";
import { parseKernelSurfaceResponse, parseSurfaceResponse } from "../../../../envelope.js";
import { bearerFor, loadSources } from "../../../../sources.server.js";
import { loadGatedSurface } from "../../../../surface-load.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * /s/[source]/[surfaceId] — the multi-source viewer route (KRA-752 §4).
 *
 * Both segments resolve against declared config only: an unknown source or an
 * undeclared surface id is a 404, never a proxied guess — the viewer is not an
 * open proxy onto the docker network. Store sources fetch a stored artifact by
 * its declared artifact_id; kernel sources fetch a declared route and lift the
 * bare CompiledSurface through the identical trust gate.
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
	const surface = await loadGatedSurface({
		fetch,
		url: `${source.baseUrl}${entry.path}`,
		artifactId,
		bearer,
		parse: (response) => parseKernelSurfaceResponse(response, { artifactId, dialectHint }),
		dialectOverride,
	});
	return { ...surface, sourceTitle: source.title, surfaceTitle: entry.title };
};

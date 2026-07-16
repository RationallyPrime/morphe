import { error } from "@sveltejs/kit";
import { isValidArtifactId, parseSurfaceResponse } from "../../../envelope.js";
import { bearerFor, loadSources } from "../../../sources.server.js";
import { loadGatedSurface } from "../../../surface-load.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * /surfaces/[artifactId] — the viewer container (KRA-648 / MO-D3).
 *
 * Addresses the DEFAULT store source by dynamic artifact id (the topos-shape
 * store, whose ids are minted at publication time and cannot be declared in
 * config). The default source is either the legacy MORPHE_ARTIFACT_BASE_URL
 * or a MORPHE_SOURCES entry named "default" with kind "store".
 *
 * SSR-fetches artifact JSON from the configured read route. The browser talks
 * only to this viewer, so the backing store stays private and CORS stays
 * fail-closed. Trust gate + fail-closed grammar 409 live in loadGatedSurface.
 */

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	if (!isValidArtifactId(params.artifactId)) error(404, { message: "Unknown artifact." });

	const source = loadSources().get("default");
	if (source === undefined || source.kind !== "store") {
		error(503, {
			message:
				"No default artifact store is configured; set MORPHE_ARTIFACT_BASE_URL or a " +
				'MORPHE_SOURCES entry named "default" with kind "store".',
			code: "not-configured",
		});
	}

	return loadGatedSurface({
		fetch,
		url: `${source.baseUrl}/${encodeURIComponent(params.artifactId)}`,
		artifactId: params.artifactId,
		bearer: bearerFor(source),
		parse: (response) => parseSurfaceResponse(response, { expectedArtifactId: params.artifactId }),
		dialectOverride: url.searchParams.get("dialect"),
	});
};

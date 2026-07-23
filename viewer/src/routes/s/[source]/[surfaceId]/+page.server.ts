import { error } from "@sveltejs/kit";
import { normalizeViewerQuery } from "../../../../forward-query.js";
import { loadSourcePane } from "../../../../pane-load.server.js";
import { paneNav } from "../../../../pane-nav.js";
import { bearerFor, loadBoard } from "../../../../sources.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * /s/[source]/[surfaceId] — the multi-source viewer route (KRA-752 §4).
 *
 * Both segments resolve against declared config only: an unknown source or an
 * undeclared surface id is a 404, never a proxied guess — the viewer is not an
 * open proxy onto the docker network. The admission + compile + gate pipeline is
 * the shared `loadSourcePane` (KRA-789), so this pane and the composed home
 * surface admit testimony through exactly one path. `as_of` rides through it as an
 * ordinary forwarded filter (KRA-779/KRA-789).
 */

export const load: PageServerLoad = async ({ params, url, fetch }) => {
	const board = loadBoard();
	const query = normalizeViewerQuery(url.searchParams);
	const source = board.sources.get(params.source);
	if (source === undefined) error(404, { message: "Unknown source." });
	const entry = source.surfaces.find((surface) => surface.id === params.surfaceId);
	if (entry === undefined) error(404, { message: "Unknown surface." });
	const rawAsOf = query.get("as_of");
	const asOf = rawAsOf !== null && rawAsOf !== "" ? rawAsOf : undefined;

	const pane = await loadSourcePane({
		board,
		source,
		entry,
		searchParams: query,
		fetch,
		bearer: bearerFor(source),
		dialectOverride: query.get("dialect"),
	});

	return {
		...pane.surface,
		sourceTitle: source.title,
		surfaceTitle: pane.surfaceTitle,
		collectionHref: pane.collectionHref,
		paneNav: paneNav(source, entry.id, asOf),
		temporalPolicy: pane.temporalPolicy,
		resolvedWindow: pane.resolvedWindow,
		asOf,
	};
};

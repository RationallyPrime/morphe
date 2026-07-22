import { env } from "$env/dynamic/private";
import { DEFAULT_DIALECT_ID, GRAMMAR_VERSION, hasDialect } from "$lib";
import { boardLinkPolicyKey } from "../board-links.js";
import { normalizeViewerQuery } from "../forward-query.js";
import { composeHomePanels, type HomePanelSource } from "../home-compose.server.js";
import { homeTree } from "../home-presenter.js";
import { bearerFor, loadBoard } from "../sources.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * / — the composed cross-kernel home surface (KRA-789), the viewer's navigation root.
 *
 * Each source that declares a `home_panel` contributes exactly one pane, admitted through
 * the SHARED `loadSourcePane` pipeline (same fail-closed admission, same edge compiler as
 * `/s/[source]/[surfaceId]`). The whole compiled subtrees are grafted into one authored
 * home tree by `home-presenter`. Every panel is gated under the SINGLE home dialect so the
 * composed tree renders coherently and each graft already passed that dialect's mask.
 *
 * The ONE `as_of` control (home chrome) fans `?as_of=` to every panel's kernel fetch — an
 * ordinary forwarded filter that admits under the KRA-776 family-mode gate. No `as_of`
 * selected is byte-identical to today's behavior. This route owns `$env`; the fail-soft
 * orchestration lives in the `$env`-free `composeHomePanels`.
 */

export const load: PageServerLoad = async ({ url, fetch }) => {
	const board = loadBoard();
	const { sources } = board;
	const query = normalizeViewerQuery(url.searchParams);
	const declared = env.MORPHE_INDEX_DIALECT;
	const override = query.get("dialect");
	const dialectId =
		override !== null && hasDialect(override)
			? override
			: declared !== undefined && hasDialect(declared)
				? declared
				: DEFAULT_DIALECT_ID;

	const title = env.MORPHE_HOME_TITLE ?? env.MORPHE_INDEX_TITLE ?? "Home";
	const rawAsOf = query.get("as_of");
	const asOf = rawAsOf !== null && rawAsOf !== "" ? rawAsOf : undefined;

	const roster: HomePanelSource[] = [];
	for (const source of sources.values()) {
		const home = source.homePanel;
		if (home === undefined) continue;
		const entry = source.surfaces.find((surface) => surface.id === home.pane);
		// Boot validation already proved `pane` names a declared surface; this guard only
		// keeps the loop total against a future config-shape change.
		if (entry === undefined) continue;
		roster.push({ source, entry, bearer: bearerFor(source), title: home.title });
	}

	const panels = await composeHomePanels({
		board,
		panels: roster,
		searchParams: query,
		fetch,
		dialectId,
		boardPolicyKey: boardLinkPolicyKey(board),
	});

	return {
		title,
		tree: homeTree({ title, grammarVersion: GRAMMAR_VERSION, asOf, panels }),
		dialectId,
		asOf,
	};
};

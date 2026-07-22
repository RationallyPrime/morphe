import { env } from "$env/dynamic/private";
import { DEFAULT_DIALECT_ID, GRAMMAR_VERSION, hasDialect } from "$lib";
import { type IndexSource, indexTree } from "../../index-presenter.js";
import { loadBoard } from "../../sources.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * /surfaces — the source catalog (KRA-752 §4, demoted from `/` by KRA-789).
 *
 * The composed home surface (`/`) is now the navigation root; this catalog lists every
 * configured source and its DECLARED surfaces (config is the whole browse space — nothing
 * is discovered by probing upstreams) and is reachable from home.
 *
 * The catalog dialect is deployment-declared (`MORPHE_INDEX_DIALECT`); a `?dialect=`
 * override wins when it names a shipped dialect — the same precedence the panes honor.
 */

export const load: PageServerLoad = ({ url }) => {
	const { sources } = loadBoard();
	const declared = env.MORPHE_INDEX_DIALECT;
	const override = url.searchParams.get("dialect");
	const dialectId =
		override !== null && hasDialect(override)
			? override
			: declared !== undefined && hasDialect(declared)
				? declared
				: DEFAULT_DIALECT_ID;

	const title = env.MORPHE_INDEX_TITLE ?? "Surfaces";
	const indexSources: IndexSource[] = [...sources.values()].map((source) => ({
		id: source.id,
		title: source.title,
		kind: source.kind,
		dialectId: source.dialectHint ?? "ledger",
		icon: source.icon,
		surfaces: source.surfaces
			.filter((entry) => !entry.routeOnly)
			.map((entry) => ({
				title: entry.title,
				href: `/s/${source.id}/${entry.id}`,
			})),
	}));

	return {
		title,
		tree: indexTree({ title, grammarVersion: GRAMMAR_VERSION, sources: indexSources }),
		dialectId,
	};
};

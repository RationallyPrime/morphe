import { env } from "$env/dynamic/private";
import { DEFAULT_DIALECT_ID, GRAMMAR_VERSION, hasDialect } from "$lib";
import { type IndexSource, indexTree } from "../index-presenter.js";
import { loadSources } from "../sources.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * / — the source index (KRA-752 §4), rendered as a Morphe tree.
 *
 * Lists every configured source and its DECLARED surfaces (config is the whole
 * browse space — nothing is discovered by probing upstreams). Store artifacts
 * addressed by dynamic ids remain reachable via /surfaces/[artifactId].
 *
 * The index dialect is deployment-declared (`MORPHE_INDEX_DIALECT`); a
 * `?dialect=` override wins when it names a shipped dialect — the same
 * precedence the pane routes honor.
 */

export const load: PageServerLoad = ({ url }) => {
	const sources = loadSources();
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
		dialectId: source.kind === "kernel" ? (source.dialectHint ?? "ledger") : source.dialectHint,
		icon: source.icon,
		surfaces: source.surfaces.map((entry) => ({
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

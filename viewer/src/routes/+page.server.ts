import { GRAMMAR_VERSION } from "$lib";
import { loadSources } from "../sources.server.js";
import type { PageServerLoad } from "./$types.js";

/*
 * / — the source index (KRA-752 §4).
 *
 * Lists every configured source and its DECLARED surfaces (config is the whole
 * browse space — nothing is discovered by probing upstreams). Store artifacts
 * addressed by dynamic ids remain reachable via /surfaces/[artifactId].
 */

export const load: PageServerLoad = () => {
	const sources = loadSources();
	return {
		grammarVersion: GRAMMAR_VERSION,
		sources: [...sources.values()].map((source) => ({
			id: source.id,
			title: source.title,
			kind: source.kind,
			surfaces: source.surfaces.map((entry) => ({
				title: entry.title,
				href: `/s/${source.id}/${entry.id}`,
			})),
		})),
	};
};

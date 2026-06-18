/*
 * Root server load — resolve the cohort from the `?cohort=` landing param so the
 * FIRST server response carries the cohort's copy + meta, not BASE_COPY. Before
 * this, arrival resolution was client-only ($effect in +layout.svelte), so a paid
 * `/?cohort=finance-controls` landing shipped generic copy in the HTML and only
 * morphed after hydration — wrong for crawlers, link-preview/OG cards, and the
 * first paint of the highest-intent traffic.
 *
 * The server sees ONLY the URL: no localStorage, so the PERSISTED-cohort case (a
 * returning visitor with no param) stays a client-only overlay applied by the
 * layout effect post-hydration. Param-only here keeps SSR and the first client
 * paint identical → no hydration mismatch. `resolveArrivalCohort(param, null, ids)`
 * is the param if it names a registered cohort, else null (base copy).
 */

import { COHORT_IDS, resolveArrivalCohort } from "$site";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ url }) => {
	const cohortId = resolveArrivalCohort(url.searchParams.get("cohort"), null, COHORT_IDS);
	return { cohortId };
};

/**
 * THE APP-WIDE ACTIVE COHORT — the marketing τ_frame selection of WHICH cohort's
 * copy is live, and the reactive `activeCopy` derived from it.
 *
 * Mirrors dialects/active.svelte.ts: one module-level `$state`, a tiny read/write
 * API, writes guarded by the registry (an unknown id is a no-op, never a reset).
 * SSR-SAFE BY CONSTRUCTION — nothing at module scope touches window/localStorage;
 * the setters run only from client code (the layout's mount effect), so the server
 * always renders the default (null cohort → BASE_COPY) and hydration is stable.
 * Persistence lives in the client-only layout effect, not here.
 */

import { getCohort, hasCohort } from "./cohorts.js";
import { resolveCopy, type SiteCopy } from "./copy.js";

/** The app-wide active cohort id, or null for "no cohort" (base copy). */
let active = $state<string | null>(null);

export const activeCohort = {
	/** The active cohort id (reactive); null when none is selected. */
	get current(): string | null {
		return active;
	},
	/** Select a cohort by id; an unknown id is a no-op (not a reset). */
	setById(id: string): void {
		if (hasCohort(id)) active = id;
	},
	/** Return to "no cohort" (base copy). */
	clear(): void {
		active = null;
	},
};

/** Base ∪ the named cohort's overlay (null → base). The shared resolution core. */
function copyFor(id: string | null): SiteCopy {
	return resolveCopy(id !== null ? getCohort(id)?.copy : undefined);
}

/** The live resolved copy (reactive): base ∪ the active cohort's overlay. */
export const activeCopy = {
	get current(): SiteCopy {
		return copyFor(active); // reactive read of `active`
	},
};

/**
 * The copy for a PAGE render, SSR-safe. The client store wins once it has resolved
 * (an in-session selection, post-hydration); until then — SSR and the first client
 * paint — the request-scoped `dataCohortId` from the layout's server load drives it.
 * This is the whole reason cohort copy SSRs: the server has no store and no
 * localStorage, but it DOES have the `?cohort=` param (resolved into layout data),
 * so a paid landing serves the cohort's copy + meta in the first response instead of
 * BASE_COPY. Reading `active` first keeps the page reactive to a later in-session
 * change; the store is NEVER written on the server, so SSR and hydration agree
 * (both see `active === null` and fall through to the same `dataCohortId`).
 */
export function pageCopy(dataCohortId: string | null): SiteCopy {
	return copyFor(active ?? dataCohortId); // reactive read of `active`, then the SSR fallback
}

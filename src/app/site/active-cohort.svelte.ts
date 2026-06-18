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

/** The live resolved copy (reactive): base ∪ the active cohort's overlay. */
export const activeCopy = {
	get current(): SiteCopy {
		const id = active; // reactive read
		return resolveCopy(id !== null ? getCohort(id)?.copy : undefined);
	},
};

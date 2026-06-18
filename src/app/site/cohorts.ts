/**
 * THE COHORT REGISTRY — a cohort selects a dialect AND a copy overlay (CONTEXT.md).
 *
 * A cohort is the marketing-side audience segment designed into an ad campaign:
 * a landing `?cohort=<id>` re-poses the page into the pitch that segment responds
 * to. It is DISTINCT from a dialect (the presentation register it selects); many
 * cohorts may share one dialect. Same posture as the intent/compound registries:
 * a gate on the way in, idempotent re-registration, ordered enumeration. The
 * arrival + persistence helpers mirror dialects/arrival.ts (valid param >
 * persisted > none; an untouched non-choice is never persisted).
 */

import { hasDialect } from "$lib";
import { SITE_COHORTS } from "./cohort-defs.js";
import type { CohortCopyOverlay } from "./copy.js";

// The shipped cohort DATA lives in cohort-defs.ts (the open/closed seam); this
// module is the machinery. Re-export so `$site` consumers keep one import surface.
export { SITE_COHORTS };

/** A marketing cohort: an id, the dialect it wears, and its copy overlay. */
export interface Cohort {
	/** Stable kebab-case id — the `?cohort=` value. */
	readonly id: string;
	/** The registered dialect this cohort selects. */
	readonly dialect: string;
	/** The copy this cohort overlays onto BASE_COPY (empty = palette-only). */
	readonly copy: CohortCopyOverlay;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Validate one cohort def. Returns a reason string, or null when it passes. */
export function cohortGateFailure(def: Cohort): string | null {
	if (!ID_PATTERN.test(def.id)) return `id "${def.id}" is not kebab-case`;
	if (!hasDialect(def.dialect)) return `${def.id}: unknown dialect "${def.dialect}"`;
	return null;
}

/** The cohort registry — gate in, idempotent, ordered (mirrors IntentRegistry). */
export class CohortRegistry {
	private readonly cohorts = new Map<string, Cohort>();

	register(def: Cohort): void {
		if (this.cohorts.has(def.id)) return; // idempotent (HMR/repeat imports)
		const failure = cohortGateFailure(def);
		if (failure !== null) {
			if (import.meta.env.DEV) {
				console.warn(`[morphe-site] cohort rejected by the gate: ${failure}`);
			}
			return;
		}
		this.cohorts.set(def.id, def);
	}

	has(id: string): boolean {
		return this.cohorts.has(id);
	}

	get(id: string): Cohort | undefined {
		return this.cohorts.get(id);
	}

	list(): readonly Cohort[] {
		return [...this.cohorts.values()];
	}
}

/* ------------------------------------------------------------------------- *
 * Arrival + persistence — the pure halves (the layout owns the I/O).
 * ------------------------------------------------------------------------- */

/**
 * Decide which cohort id (if any) an arrival should activate.
 * Precedence: valid `?cohort=` param > persisted cohort > null. Unknown/garbage
 * is ignored (never an error, never a reset). Ids are exact-match.
 */
export function resolveArrivalCohort(
	param: string | null,
	persisted: string | null,
	knownIds: readonly string[],
): string | null {
	if (param !== null && knownIds.includes(param)) return param;
	return persisted ?? null;
}

/**
 * Decide whether to persist the active cohort. "No cohort" is not a choice, and
 * re-affirming the stored value writes nothing; an explicit cohort persists.
 */
export function persistableCohort(active: string | null, stored: string | null): string | null {
	if (active === null) return null;
	if (active === stored) return null;
	return active;
}

/* ------------------------------------------------------------------------- *
 * The registry instance + the public helpers (the shipped cohort DATA is in
 * cohort-defs.ts, re-exported above).
 * ------------------------------------------------------------------------- */

/** The module-level default registry the layout resolves arrivals against. */
export const cohortRegistry = new CohortRegistry();

/** Idempotent registration of the shipped cohorts (safe under HMR). */
export function registerSiteCohorts(reg: CohortRegistry = cohortRegistry): void {
	for (const def of SITE_COHORTS) {
		reg.register(def);
	}
}

/** Resolve a cohort by id against the default registry (undefined if unknown). */
export function getCohort(id: string): Cohort | undefined {
	return cohortRegistry.get(id);
}

/** Whether an id names a registered cohort (against the default registry). */
export function hasCohort(id: string): boolean {
	return cohortRegistry.has(id);
}

/** Every registered cohort id, in registration order. */
export function getCohortIds(): readonly string[] {
	return cohortRegistry.list().map((c) => c.id);
}

/**
 * The shipped cohort ids (eager, for the layout's arrival check). Registration
 * is idempotent, so registering here at module load is safe and means COHORT_IDS
 * is populated before the layout's mount effect runs.
 */
registerSiteCohorts();
export const COHORT_IDS: readonly string[] = getCohortIds();

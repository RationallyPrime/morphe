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
import type { CohortCopyOverlay } from "./copy.js";

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
 * The shipped cohorts.
 * ------------------------------------------------------------------------- */

/**
 * pharma-sovereign — regulated drug-development companies that mandate Sovereign
 * deployment for IP reasons. Wears the `clinical` dialect (the regulated/GxP
 * console register). Copy leads with the IP/sovereignty pitch: local inference
 * only, no outbound inference calls; the rest of the site copy is inherited.
 */
export const PHARMA_SOVEREIGN: Cohort = {
	id: "pharma-sovereign",
	dialect: "clinical",
	copy: {
		meta: {
			title: "Sókrates — A sovereign AI department for drug development",
			description:
				"An on-premises AI department for regulated drug development. Local inference only, no outbound inference calls: your pipeline IP is reasoned over where it lives and never sent to a cloud model. Every act on a signed, auditable record.",
		},
		hero: {
			title: "A sovereign AI department for drug development.",
			lede: "Sókrates runs your cross-system operational work on a Sovereign appliance on your premises, on local inference — no outbound inference calls, ever. Your compounds, assays and trial data are read and acted on where they already live, and never sent to a model in the cloud. Tell it what runs your operation, and see what it takes on.",
		},
		closingCta: {
			sub: "Bring the workflow your IP constraints have kept off every cloud tool. Thirty minutes is enough to see Sókrates run it without your data leaving the building.",
		},
		faq: {
			entries: {
				"data-residency": {
					q: "Can our IP — compounds, assays, trial data — stay in-house?",
					a: "It never leaves. The appliance is installed inside your network and runs on local inference only — no outbound inference calls at all. A roughly 200-billion-parameter model runs on the box itself; your data is reasoned over where it already lives. No cloud model ever sees your pipeline.",
				},
				"no-shared-model": {
					q: "Could a model trained elsewhere ever see our pipeline?",
					a: "Never. The Sovereign appliance calls no externally hosted model, and nothing from your environment trains a shared one. The weights live on the box; your data stays on the box.",
				},
				"validation-audit": {
					q: "How does it hold up to validation and an audit?",
					a: "Every action is a typed act with a named owner and a signed authority record, and the full causal tree of each act is preserved as one auditable record: who did what, under whose authorization, with what data, in what order. The audit trail is the substrate itself, not a report bolted on after — built for the evidence standard your validation and QA teams already work to.",
				},
			},
			order: [
				"data-residency",
				"no-shared-model",
				"validation-audit",
				"what-if-wrong",
				"exit",
				"chatgpt-diff",
				"mid-migration",
			],
		},
	},
};

/** The shipped cohorts. Adding a cohort = add its module here. */
export const SITE_COHORTS: readonly Cohort[] = [PHARMA_SOVEREIGN];

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

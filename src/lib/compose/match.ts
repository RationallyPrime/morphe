/**
 * Deterministic, read-only, SUBSET-AWARE matching for the composer
 * ("What can Sókrates do for you?").
 *
 * A visitor's `ComposeQuery` (free-text pain + named systems) is scored against
 * the grounded `CAPABILITIES` corpus, now spanning THREE systems (Humanity,
 * dkPlus, Twenty). Two gates apply, in order:
 *
 *   1. SUBSET ELIGIBILITY (hard gate). Each capability declares the FULL set of
 *      systems it requires (`cap.systems`). It is eligible ONLY when that set is
 *      a SUBSET of the visitor's selected systems — you cannot run a Twenty×dkPlus
 *      automation without both Twenty and dkPlus selected. A single-system cap
 *      needs just its one system; the three-way "deal to delivery" loop needs all
 *      three. Caps whose required systems are not all selected are dropped before
 *      scoring (score 0, never surfaced).
 *
 *   2. PAIN-LED RANKING (soft signal, among eligible caps). Scoring is a pure
 *      function of:
 *        - PAIN-TAG OVERLAP: how many of the capability's `painPoints` the
 *          visitor's stated pain resolves to (via the closed `tagsFromText`
 *          taxonomy), weighted heavily — the pain is the primary signal.
 *        - SYSTEM OVERLAP: how many of the capability's required systems the
 *          visitor selected, weighted lightly — a tie-breaker / boost. Under the
 *          subset gate this is always the full `cap.systems` for eligible caps, so
 *          it naturally favours the richer multi-system compositions on a tie.
 *
 * Ties break deterministically on `capability.id` (ascending) so the ranking is
 * stable across runs. No clock, no RNG, no I/O — the same input always yields the
 * same ordering, which is what makes the surface auditable.
 */

import type { Capability, SystemId } from "./capability.js";
import { CAPABILITIES } from "./corpus.js";
import type { ComposeQuery } from "./input.js";
import { type PainTag, tagsFromText } from "./taxonomy.js";

/** A capability with its computed relevance to a query and what drove the score. */
export interface ScoredCapability {
	capability: Capability;
	score: number;
	matchedTags: PainTag[];
	/**
	 * The capability's required systems that the visitor selected. Under the subset
	 * gate, an eligible capability has ALL of its `cap.systems` selected, so for any
	 * eligible cap this equals `cap.systems` (in canonical order); ineligible caps
	 * are filtered out before they reach a consumer.
	 */
	matchedSystems: SystemId[];
}

/** Weight on a single matched pain tag. Strictly greater than the system weight. */
const W_TAG = 3;
/** Weight on a single matched system. */
const W_SYS = 1;

/**
 * Whether `required` is a subset of `selected` — i.e. every system the capability
 * needs is one the visitor selected. The empty required set is vacuously a subset,
 * but no capability carries an empty `systems`, so this only ever gates real caps.
 */
function isSubsetSelected(required: readonly SystemId[], selected: ReadonlySet<SystemId>): boolean {
	for (const id of required) {
		if (!selected.has(id)) return false;
	}
	return true;
}

/**
 * Score every ELIGIBLE capability in `corpus` against `query`, ranked descending.
 *
 * Pure and total. Applies the subset gate first (drops any capability whose
 * required systems are not all selected), then derives query tags via
 * `tagsFromText(query.pain)`, intersects each surviving capability's `painPoints`
 * with the query, and sorts by score desc then `id` asc for a stable order. The
 * returned `matchedSystems` is the capability's required systems (all selected, by
 * the gate), in the capability's declared order.
 */
export function scoreCapabilities(
	query: ComposeQuery,
	corpus: readonly Capability[] = CAPABILITIES,
): ScoredCapability[] {
	const queryTags = new Set<PainTag>(tagsFromText(query.pain));
	const querySystems = new Set<SystemId>(query.systems);

	const scored: ScoredCapability[] = [];
	for (const capability of corpus) {
		// Hard gate: the capability's full required system set must be selected.
		if (!isSubsetSelected(capability.systems, querySystems)) continue;

		const matchedTags: PainTag[] = [];
		for (const tag of capability.painPoints as PainTag[]) {
			if (queryTags.has(tag)) matchedTags.push(tag);
		}

		// By the subset gate every required system is selected; surface that as the
		// matched set (in declared order) and use its size as the light system boost.
		const matchedSystems: SystemId[] = [...capability.systems];

		const score = matchedTags.length * W_TAG + matchedSystems.length * W_SYS;
		scored.push({ capability, score, matchedTags, matchedSystems });
	}

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		// Deterministic tie-break: ascending capability id.
		return a.capability.id < b.capability.id ? -1 : a.capability.id > b.capability.id ? 1 : 0;
	});

	return scored;
}

/**
 * The capabilities that match a query, ranked. A capability matches only when (a)
 * its required systems are a subset of the selected systems AND (b) the visitor's
 * stated pain resolves to at least one of its pain tags: the pain is the question,
 * and the named systems gate eligibility and only boost the ranking among tag
 * matches (they do not, on their own, constitute a query). So an empty or
 * unrecognized pain yields `[]`, and the caller shows the honest breadth via
 * `featuredCapabilities` rather than dumping the whole catalogue when nothing was
 * actually asked.
 */
export function matchCapabilities(
	query: ComposeQuery,
	corpus: readonly Capability[] = CAPABILITIES,
): Capability[] {
	return scoreCapabilities(query, corpus)
		.filter((s) => s.matchedTags.length > 0)
		.map((s) => s.capability);
}

/**
 * The default / empty-state set: a fixed, curated cross-section of high-leverage
 * capabilities spanning distinct pain tags AND distinct system families
 * (single-system for each of the three, the three cross-system pairs, and the
 * three-way "deal to delivery" loop) to show the breadth of what the appliance
 * maps.
 *
 * SUBSET-AWARE: the curated list is filtered to the capabilities whose required
 * systems are a subset of the visitor's selected systems, in this fixed
 * declaration order. So selecting only Twenty surfaces the Twenty-only featured
 * caps (never blank), adding dkPlus unlocks the dkPlus-only and Twenty×dkPlus
 * featured caps, and selecting all three shows the full curated spread.
 *
 * Fully deterministic — a hard-coded id allowlist resolved against the corpus in
 * declaration order, gated by subset, with any missing ids skipped.
 */
const FEATURED_IDS: readonly string[] = [
	// Single-system — so any single selection is never empty, one strong cap per
	// distinct pain per system.
	"twenty-stale-deal-detection", // [twenty] sales-pipeline
	"twenty-duplicate-company-person-cleanup", // [twenty] master-data/contacts
	"twenty-task-sla-and-activity-capture", // [twenty] approvals/crm
	"humanity-open-shift-coverage-gaps", // [humanity] scheduling
	"humanity-overtime-early-warning", // [humanity] overtime
	"dkplus-customer-profitability-report", // [dkplus] margin/reporting
	"dkplus-unbilled-customer-detector", // [dkplus] invoicing
	// Humanity × dkPlus — the original two-system flagships, distinct tags.
	"schedule-to-labor-cost-forecast", // labor-cost/forecasting
	"auto-invoice-billable-labor", // invoicing
	"real-time-margin-dashboard-by-location-project-customer", // margin/reporting
	"payroll-exception-copilot", // payroll
	"manager-daily-operating-brief", // reporting/scheduling
	"auto-create-and-update-employees-across-both-systems", // master-data
	// Twenty × dkPlus — CRM to ERP.
	"won-opportunity-to-dkplus-customer-and-sales-order", // deals/invoicing
	"quote-from-opportunity", // quoting/deals
	"company-customer-sync", // master-data/contacts/crm
	// Twenty × Humanity — CRM to scheduling.
	"won-deal-to-staffing", // deals/scheduling
	"contact-to-employee", // contacts/hiring
	// Twenty × Humanity × dkPlus — the three-way loop.
	"deal-to-delivery-staff-project-and-advance-stage", // deals/scheduling/invoicing
	"deal-to-delivery-pipeline-to-capacity-forecast", // forecasting/sales-pipeline
];

/**
 * The curated featured set for a given selection of systems.
 *
 * Resolves `FEATURED_IDS` against the corpus in declaration order, keeping only
 * the capabilities whose required systems are a subset of `selected`. Pass the
 * visitor's `query.systems`; with all three systems selected the full curated
 * spread is returned, and the empty selection returns `[]` (no capability has an
 * empty required set, so nothing is universally featured).
 */
export function featuredCapabilities(
	selected: readonly SystemId[],
	corpus: readonly Capability[] = CAPABILITIES,
): readonly Capability[] {
	const selectedSet = new Set<SystemId>(selected);
	const byId = new Map<string, Capability>(corpus.map((c) => [c.id, c]));
	const out: Capability[] = [];
	for (const id of FEATURED_IDS) {
		const cap = byId.get(id);
		if (cap !== undefined && isSubsetSelected(cap.systems, selectedSet)) out.push(cap);
	}
	return out;
}

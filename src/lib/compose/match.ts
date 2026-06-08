/**
 * Deterministic, read-only matching for the composer ("What can Sókrates do for you?").
 *
 * A visitor's `ComposeQuery` (free-text pain + named systems) is scored against
 * the grounded `CAPABILITIES` corpus. Scoring is a pure function of:
 *   - PAIN-TAG OVERLAP: how many of the capability's `painPoints` the visitor's
 *     stated pain resolves to (via the closed `tagsFromText` taxonomy), weighted
 *     heavily — the pain is the primary signal.
 *   - SYSTEM OVERLAP: how many of the named systems the capability touches
 *     (as `source` or `target`), weighted lightly — a tie-breaker / boost, since
 *     on this surface both systems are usually in play.
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
	matchedSystems: SystemId[];
}

/** Weight on a single matched pain tag. Strictly greater than the system weight. */
const W_TAG = 3;
/** Weight on a single matched system. */
const W_SYS = 1;

/**
 * Score every capability in `corpus` against `query`, ranked descending.
 *
 * Pure and total: derives query tags via `tagsFromText(query.pain)`, intersects
 * each capability's `painPoints` and `{source.id, target.id}` with the query,
 * and sorts by score desc then `id` asc for a stable, deterministic order.
 */
export function scoreCapabilities(
	query: ComposeQuery,
	corpus: readonly Capability[] = CAPABILITIES,
): ScoredCapability[] {
	const queryTags = new Set<PainTag>(tagsFromText(query.pain));
	const querySystems = new Set<SystemId>(query.systems);

	const scored: ScoredCapability[] = corpus.map((capability) => {
		const matchedTags: PainTag[] = [];
		for (const tag of capability.painPoints as PainTag[]) {
			if (queryTags.has(tag)) matchedTags.push(tag);
		}

		const capSystems = new Set<SystemId>([capability.source.id, capability.target.id]);
		const matchedSystems: SystemId[] = [];
		for (const id of capSystems) {
			if (querySystems.has(id)) matchedSystems.push(id);
		}

		const score = matchedTags.length * W_TAG + matchedSystems.length * W_SYS;
		return { capability, score, matchedTags, matchedSystems };
	});

	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		// Deterministic tie-break: ascending capability id.
		return a.capability.id < b.capability.id ? -1 : a.capability.id > b.capability.id ? 1 : 0;
	});

	return scored;
}

/**
 * The capabilities that match a query, ranked. A capability matches only when the
 * visitor's stated pain resolves to at least one of its pain tags: the pain is the
 * question, and the named systems only boost the ranking among tag matches (they
 * do not, on their own, constitute a query). So an empty or unrecognized pain
 * yields `[]`, and the caller shows the honest breadth via `featuredCapabilities`
 * rather than dumping the whole catalogue when nothing was actually asked.
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
 * The default / empty-state set: a fixed, curated handful of high-leverage
 * capabilities spanning distinct pain tags (scheduling, invoicing, reporting,
 * margin, payroll, master-data) to show the breadth of what the appliance maps.
 *
 * Fully deterministic — a hard-coded id allowlist resolved against the corpus in
 * declaration order, with any missing ids skipped.
 */
const FEATURED_IDS: readonly string[] = [
	"schedule-to-labor-cost-forecast",
	"auto-invoice-billable-labor",
	"manager-daily-operating-brief",
	"real-time-margin-dashboard-by-location-project-customer",
	"payroll-exception-copilot",
	"auto-create-and-update-employees-across-both-systems",
];

export function featuredCapabilities(
	corpus: readonly Capability[] = CAPABILITIES,
): readonly Capability[] {
	const byId = new Map<string, Capability>(corpus.map((c) => [c.id, c]));
	const out: Capability[] = [];
	for (const id of FEATURED_IDS) {
		const cap = byId.get(id);
		if (cap !== undefined) out.push(cap);
	}
	return out;
}

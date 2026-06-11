/**
 * Example friction chips for the composer — SYSTEM-GATED suggestions.
 *
 * Each example pain declares the FULL system set it speaks to, exactly like a
 * `Capability.systems`, and is offered only when that set is a subset of the
 * visitor's current selection (the same `isSubsetSelected` gate `match.ts`
 * applies to capabilities). So the chips re-shape themselves around the stack
 * the visitor names: select Jira and the suggestions talk about tickets and
 * worklogs; drop the CRM and the deal-shaped suggestions disappear.
 *
 * Every example is HONEST BY CONSTRUCTION: `examples.test.ts` pins that each
 * one, submitted under exactly its declared systems, yields at least one
 * deterministic match — a suggestion can never lead to the off-domain refusal,
 * even on the no-Voyage fallback path. (Selections are supersets of the gate,
 * and eligibility is monotone in the selection, so the floor holds live too.)
 *
 * Pure DATA + pure functions. No clock, no RNG, no I/O.
 */

import type { SystemId } from "./capability.js";
import { isSubsetSelected } from "./match.js";

/** A suggested friction, gated on the systems it needs to be answerable. */
export interface ExamplePain {
	/** The visitor-voiced friction, exactly as the chip inserts it. */
	text: string;
	/** The FULL system set the example speaks to — offered only when all are selected. */
	systems: readonly SystemId[];
}

/**
 * The curated suggestion pool, most-specific footprints first within a theme.
 * Texts are visitor voice ("Quiet Confidence" register): the words an operator
 * would actually type, each resolving onto the closed pain-tag taxonomy.
 */
export const EXAMPLE_PAINS: readonly ExamplePain[] = [
	// Cross-system frictions — the composer's home turf.
	{ text: "Overtime keeps surprising finance", systems: ["humanity", "dkplus"] },
	{
		text: "Approved hours never make it into payroll on time",
		systems: ["humanity", "businesscentral"],
	},
	{ text: "Won deals stall before the invoice goes out", systems: ["twenty", "dkplus"] },
	{
		text: "Won deals never become orders finance can see",
		systems: ["twenty", "businesscentral"],
	},
	{ text: "Won deals stall before staffing", systems: ["twenty", "humanity"] },
	{
		text: "Every new hire's day-one task list is rebuilt by hand",
		systems: ["50skills", "asana"],
	},
	{ text: "Access requests for new hires sit in a queue", systems: ["50skills", "jira"] },
	{
		text: "New hires reach the roster before payroll is ready",
		systems: ["50skills", "humanity", "dkplus"],
	},
	{
		text: "Closed-won deals take weeks to become delivery projects",
		systems: ["twenty", "asana"],
	},
	{ text: "Sales promises ship dates engineering never sees", systems: ["twenty", "jira"] },
	{ text: "Logged hours never turn into invoices", systems: ["jira", "dkplus"] },
	{
		text: "Worklogs never make it into payroll or the books",
		systems: ["jira", "businesscentral"],
	},
	{ text: "Billable time tracked on tasks never gets invoiced", systems: ["asana", "dkplus"] },
	{
		text: "Milestone billing always waits for month end",
		systems: ["asana", "businesscentral"],
	},
	{
		text: "Delivery work gets planned with no staffing view",
		systems: ["asana", "humanity"],
	},
	{ text: "Incident surges hit before the roster can react", systems: ["jira", "humanity"] },
	// Single-system frictions — so a lone selection still gets honest chips.
	{ text: "Open shifts keep going uncovered", systems: ["humanity"] },
	{ text: "Customers slip past billing every month", systems: ["dkplus"] },
	{ text: "Cash keeps getting stuck in overdue invoices", systems: ["businesscentral"] },
	{ text: "Deals go quiet and nobody notices", systems: ["twenty"] },
	{ text: "Onboarding journeys stall and nobody owns the fix", systems: ["50skills"] },
	{ text: "Tasks slip past their deadline without anyone noticing", systems: ["asana"] },
	{ text: "Tickets sit untouched for weeks", systems: ["jira"] },
];

/** How many suggestion chips the composer shows at once. */
export const EXAMPLE_LIMIT = 4;

/**
 * The example pains to offer for a selection: the gate-eligible subset of
 * `EXAMPLE_PAINS`, widest footprint first (the most stack-specific suggestion
 * leads), ties in curated order, capped at `limit`. Pure and total — an empty
 * selection yields `[]` (no system, nothing to suggest), and the caller hides
 * the chip row.
 */
export function examplePainsFor(
	selected: readonly SystemId[],
	limit: number = EXAMPLE_LIMIT,
): string[] {
	const sel = new Set<SystemId>(selected);
	return EXAMPLE_PAINS.filter((e) => isSubsetSelected(e.systems, sel))
		.map((e, i) => ({ e, i }))
		.sort((a, b) => b.e.systems.length - a.e.systems.length || a.i - b.i)
		.slice(0, Math.max(0, limit))
		.map(({ e }) => e.text);
}

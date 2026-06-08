/**
 * The closed pain-tag taxonomy for the composer ("What can Sókrates do for you?").
 *
 * A visitor states a pain point in free text and names the systems they run. We
 * map that text onto a SMALL, CLOSED vocabulary of pain tags — the only tags a
 * `Capability` may carry and the only axis `match.ts` scores against. Keeping the
 * vocabulary closed is what makes matching deterministic and the corpus auditable:
 * every capability's `painPoints` is a subset of `PAIN_TAGS`, and every keyword a
 * real operator would type resolves to exactly one tag.
 *
 * This module is pure DATA + pure functions. No clock, no RNG, no I/O.
 */

import type { Category, SystemId, SystemRef } from "./capability.js";

/** The closed set of pain tags. A `Capability.painPoints` is a subset of these. */
export type PainTag =
	| "scheduling"
	| "overtime"
	| "labor-cost"
	| "forecasting"
	| "payroll"
	| "invoicing"
	| "margin"
	| "compliance"
	| "inventory"
	| "master-data"
	| "approvals"
	| "reporting"
	| "customer-comms"
	| "anomaly"
	| "utilization"
	| "quoting"
	| "hiring"
	| "sales-pipeline"
	| "deals"
	| "contacts"
	| "crm";

/** The canonical, ordered list of every pain tag. */
export const PAIN_TAGS: readonly PainTag[] = [
	"scheduling",
	"overtime",
	"labor-cost",
	"forecasting",
	"payroll",
	"invoicing",
	"margin",
	"compliance",
	"inventory",
	"master-data",
	"approvals",
	"reporting",
	"customer-comms",
	"anomaly",
	"utilization",
	"quoting",
	"hiring",
	"sales-pipeline",
	"deals",
	"contacts",
	"crm",
];

/**
 * Lowercased keyword / phrase -> tag. The phrases are the words a real operator
 * types when describing friction: "rota", "shift planning", "blowing budget on
 * overtime", "we keep forgetting to bill". `tagsFromText` substring-matches these
 * against the lowercased input, so longer phrases and synonyms all collapse onto
 * the right closed tag.
 */
export const PAIN_KEYWORDS: Readonly<Record<string, PainTag>> = {
	// scheduling
	scheduling: "scheduling",
	schedule: "scheduling",
	"shift planning": "scheduling",
	shifts: "scheduling",
	shift: "scheduling",
	rota: "scheduling",
	rostering: "scheduling",
	roster: "scheduling",
	staffing: "scheduling",
	"staff the": "scheduling",
	coverage: "scheduling",
	"open shifts": "scheduling",
	availability: "scheduling",

	// overtime
	overtime: "overtime",
	"over time": "overtime",
	"ot ": "overtime",
	"time and a half": "overtime",
	"40 hours": "overtime",
	"forty hours": "overtime",

	// labor-cost
	"labor cost": "labor-cost",
	"labour cost": "labor-cost",
	"cost of labor": "labor-cost",
	"cost of labour": "labor-cost",
	"wage cost": "labor-cost",
	"staff cost": "labor-cost",
	"payroll cost": "labor-cost",
	"what will this cost": "labor-cost",

	// forecasting
	forecast: "forecasting",
	forecasting: "forecasting",
	predict: "forecasting",
	prediction: "forecasting",
	demand: "forecasting",
	projection: "forecasting",
	"what if": "forecasting",

	// payroll
	payroll: "payroll",
	payrun: "payroll",
	"pay run": "payroll",
	payslip: "payroll",
	"pay slip": "payroll",
	timeclock: "payroll",
	"time clock": "payroll",
	"clock in": "payroll",
	"clock out": "payroll",
	"clock-in": "payroll",
	"clock-out": "payroll",
	timesheet: "payroll",
	"time sheet": "payroll",
	"work journal": "payroll",
	tips: "payroll",
	breaks: "payroll",

	// invoicing
	invoice: "invoicing",
	invoicing: "invoicing",
	billing: "invoicing",
	"bill the": "invoicing",
	"to bill": "invoicing",
	billable: "invoicing",
	unbilled: "invoicing",
	"sales order": "invoicing",

	// margin
	margin: "margin",
	profit: "margin",
	profitability: "margin",
	bleeding: "margin",
	"making money": "margin",
	"losing money": "margin",
	"revenue per": "margin",

	// compliance
	compliance: "compliance",
	compliant: "compliance",
	certification: "compliance",
	certified: "compliance",
	training: "compliance",
	"sla": "compliance",
	regulated: "compliance",
	"break rules": "compliance",
	"labor law": "compliance",
	"labour law": "compliance",

	// inventory
	inventory: "inventory",
	stock: "inventory",
	"out of stock": "inventory",
	warehouse: "inventory",
	"product demand": "inventory",
	transfer: "inventory",
	materials: "inventory",
	supplies: "inventory",

	// master-data
	"master data": "master-data",
	"master-data": "master-data",
	duplicate: "master-data",
	duplicates: "master-data",
	mapping: "master-data",
	mismatch: "master-data",
	"id mapping": "master-data",
	sync: "master-data",
	syncing: "master-data",
	"out of sync": "master-data",
	"data quality": "master-data",
	cleanup: "master-data",

	// approvals
	approval: "approvals",
	approvals: "approvals",
	approve: "approvals",
	"sign off": "approvals",
	"sign-off": "approvals",
	"route for review": "approvals",
	"pending review": "approvals",

	// reporting
	report: "reporting",
	reporting: "reporting",
	dashboard: "reporting",
	"daily brief": "reporting",
	briefing: "reporting",
	"end of day": "reporting",
	"end-of-day": "reporting",
	close: "reporting",
	visibility: "reporting",
	"single view": "reporting",

	// customer-comms
	"customer communication": "customer-comms",
	"customer update": "customer-comms",
	"notify customer": "customer-comms",
	"notify the customer": "customer-comms",
	"keep customers informed": "customer-comms",
	notification: "customer-comms",
	messaging: "customer-comms",
	"en route": "customer-comms",

	// anomaly
	anomaly: "anomaly",
	fraud: "anomaly",
	suspicious: "anomaly",
	"out of place": "anomaly",
	leakage: "anomaly",
	leak: "anomaly",
	"buddy punching": "anomaly",
	"unusual": "anomaly",

	// utilization
	utilization: "utilization",
	utilisation: "utilization",
	"bench": "utilization",
	idle: "utilization",
	"idle time": "utilization",
	billability: "utilization",
	"who is busy": "utilization",

	// quoting
	quote: "quoting",
	quotes: "quoting",
	quoting: "quoting",
	estimate: "quoting",
	estimating: "quoting",
	"fixed price": "quoting",
	"fixed-price": "quoting",
	bid: "quoting",

	// hiring
	hiring: "hiring",
	hire: "hiring",
	recruit: "hiring",
	recruiting: "hiring",
	headcount: "hiring",
	understaffed: "hiring",
	understaffing: "hiring",
	"short staffed": "hiring",
	"short-staffed": "hiring",
	fte: "hiring",

	// sales-pipeline
	pipeline: "sales-pipeline",
	"sales pipeline": "sales-pipeline",
	"sales stage": "sales-pipeline",
	"deal stage": "sales-pipeline",
	"stuck deal": "sales-pipeline",
	"stale deal": "sales-pipeline",
	"win rate": "sales-pipeline",
	funnel: "sales-pipeline",

	// deals
	deal: "deals",
	deals: "deals",
	opportunity: "deals",
	opportunities: "deals",
	"won deal": "deals",
	"closed won": "deals",
	"close the deal": "deals",
	lead: "deals",
	leads: "deals",

	// contacts
	contact: "contacts",
	contacts: "contacts",
	"contact record": "contacts",
	person: "contacts",
	people: "contacts",
	account: "contacts",
	"company record": "contacts",

	// crm
	crm: "crm",
	"sales team": "crm",
	"sales rep": "crm",
	salesforce: "crm",
	hubspot: "crm",
	pipedrive: "crm",
	"follow up": "crm",
	"follow-up": "crm",
};

/**
 * Free text -> matched pain tags. Lowercases the input, substring-matches every
 * keyword phrase, dedupes while preserving `PAIN_TAGS` order. Pure and total.
 */
export function tagsFromText(text: string): PainTag[] {
	const haystack = text.toLowerCase();
	const hit = new Set<PainTag>();
	for (const keyword of Object.keys(PAIN_KEYWORDS)) {
		if (haystack.includes(keyword)) {
			const tag = PAIN_KEYWORDS[keyword];
			if (tag !== undefined) hit.add(tag);
		}
	}
	// Return in canonical PAIN_TAGS order so the result is stable.
	return PAIN_TAGS.filter((tag) => hit.has(tag));
}

/* ---------------------------------------------------------------------------
 * SYSTEMS + CATEGORIES — the product registry and the system-agnostic axis.
 *
 * Each system is classified by `Category` (the system-AGNOSTIC concept it fills).
 * Capabilities reach across categories ("CRM -> ERP"); the concrete systems that
 * realize them are the grounding. With one product per category today, surfacing by
 * category and by system is identical — this classification is the seam for a second
 * product in a category later. To add one: add a `System` here with its category;
 * the binding/grounding of capabilities to it is the deferred template work.
 * ------------------------------------------------------------------------- */

/** A registered system: a display ref plus the category it fills. */
export interface System extends SystemRef {
	category: Category;
}

/** The canonical, ordered list of categories. */
export const CATEGORIES: readonly Category[] = ["crm", "erp", "wfm"];

/** Human label for each category (the system-agnostic register). */
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
	crm: "CRM",
	erp: "ERP / Finance",
	wfm: "Workforce",
};

/** The systems the composer answers for. Order is the display order. */
export const SYSTEMS: readonly System[] = [
	{ id: "humanity", label: "Humanity", category: "wfm" },
	{ id: "dkplus", label: "dkPlus", category: "erp" },
	{ id: "twenty", label: "Twenty", category: "crm" },
];

/** The category a system fills, or `undefined` for an unknown id. */
export function categoryOf(id: SystemId): Category | undefined {
	return SYSTEMS.find((s) => s.id === id)?.category;
}

/**
 * The set of categories a group of systems covers, in canonical `CATEGORIES` order
 * and deduped. This is a capability's system-agnostic reach (its `systems` mapped
 * through `categoryOf`) — the key a future template/binding split would surface on.
 */
export function categoriesOf(systems: readonly SystemId[]): Category[] {
	const seen = new Set<Category>();
	for (const id of systems) {
		const c = categoryOf(id);
		if (c !== undefined) seen.add(c);
	}
	return CATEGORIES.filter((c) => seen.has(c));
}

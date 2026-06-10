/**
 * The INTENT VOCABULARY (ADR-0006 §2–3, KRA-355) — the typed registry of page
 * morphs, the data half of the intent engine.
 *
 * A visitor states an interest (a chip click, a palette entry) and the page
 * reshapes in place. Each registered intent is pure DATA: a visitor-phrased
 * label, the match vocabulary the palette searches, the canonical content
 * target (the no-JS anchor — REQUIRED, so an intent without a crawlable
 * fallback is unrepresentable), and a typed action. Execution lives in
 * `intent-engine.svelte.ts`; this module is declarative and side-effect-free,
 * mirroring the compound split (CompoundDef = data, factory = mechanism).
 *
 * Actions are a closed union, not callbacks — the engine interprets them, so
 * every morph rides ONE execution path (chips and palette cannot diverge) and
 * the registry stays serializable data an agent could one day author through
 * the same gate (ADR-0006 v2).
 *
 *   - `navigate`   — no morph yet: the chip is exactly its anchor. The five
 *     content intents ship in this form until KRA-356–359 author their morphs.
 *   - `flip-dialect` — the tracer morph: toggle the global dialect between a
 *     light/dark pair. Gate-checked against the dialect registry at
 *     registration, so an intent naming an unknown dialect never registers.
 *   - `stage-delta` — a hand-authored choice movement `{id, choice}` against
 *     the stage's emission envelope. The engine stamps the LIVE epoch at
 *     execution and runs it through `applyDelta` — the R2 gate — so a
 *     malformed delta is rejected and the page renders unchanged (render
 *     totality, CONTRACT). KRA-356–359 upgrade the content intents to this.
 *
 * REGISTRATION GATE (same posture as the compound factory): a def is
 * validated before it is added; a failing def is never added and never throws
 * the batch; re-registration is an idempotent no-op (HMR-safe).
 */

import { hasDialect } from "$morphe";
import { HOME_INTENT_STAGE_ID, HOME_STAGE_CHOICES } from "./morph-stage.js";

/* ------------------------------------------------------------------------- *
 * Types
 * ------------------------------------------------------------------------- */

/** What an intent does when invoked. A closed, serializable union. */
export type IntentAction =
	| { readonly kind: "navigate" }
	| {
			/** Toggle the global dialect between a [light, dark] pair. */
			readonly kind: "flip-dialect";
			readonly between: readonly [string, string];
	  }
	| {
			/**
			 * A slow-loop-authorized choice movement on the stage envelope. The
			 * epoch is NOT authored — the engine stamps the live envelope's epoch
			 * at execution time (a synchronous visitor acts on the emission they
			 * are looking at; epoch staleness guards async proposers).
			 */
			readonly kind: "stage-delta";
			readonly id: string;
			readonly choice: number;
	  };

export interface SiteIntent {
	/** Stable kebab-case id. */
	readonly id: string;
	/** Visitor-phrased label — the chip text and the palette row. */
	readonly label: string;
	/** Lowercase match vocabulary for the palette, beyond the label itself. */
	readonly keywords: readonly string[];
	/**
	 * Canonical content target (`/path` or `#anchor`). The no-JS ground truth:
	 * chips render as anchors to this href; with JS, morphing intents intercept.
	 */
	readonly href: string;
	readonly action: IntentAction;
	/** Polite live-region line after a successful stage morph. */
	readonly announce?: string;
}

/* ------------------------------------------------------------------------- *
 * The registration gate
 * ------------------------------------------------------------------------- */

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Validate one intent def. Returns a reason string, or null when it passes. */
export function intentGateFailure(def: SiteIntent): string | null {
	if (!ID_PATTERN.test(def.id)) return `id "${def.id}" is not kebab-case`;
	if (def.label.trim() === "") return `${def.id}: empty label`;
	if (def.keywords.length === 0) return `${def.id}: no keywords`;
	if (def.keywords.some((k) => k.trim() === "")) return `${def.id}: blank keyword`;
	if (!/^[/#]/.test(def.href)) return `${def.id}: href "${def.href}" is not a /path or #anchor`;
	switch (def.action.kind) {
		case "navigate":
			return null;
		case "flip-dialect": {
			const [a, b] = def.action.between;
			if (a === b) return `${def.id}: flip pair names one dialect twice`;
			if (!hasDialect(a)) return `${def.id}: unknown dialect "${a}"`;
			if (!hasDialect(b)) return `${def.id}: unknown dialect "${b}"`;
			return null;
		}
		case "stage-delta": {
			if (def.action.id.trim() === "") return `${def.id}: stage-delta with empty vary id`;
			if (!Number.isInteger(def.action.choice) || def.action.choice < 0) {
				return `${def.id}: stage-delta choice ${def.action.choice} is not a non-negative integer`;
			}
			return null;
		}
	}
}

/**
 * The intent registry — same shape and posture as the compound registry: a
 * gate on the way in, idempotent re-registration, read-only enumeration in
 * registration order (the chip row renders this order).
 */
export class IntentRegistry {
	private readonly intents = new Map<string, SiteIntent>();

	/** Register one def through the gate. A failing def is never added. */
	register(def: SiteIntent): void {
		if (this.intents.has(def.id)) return; // idempotent (HMR/repeat imports)
		const failure = intentGateFailure(def);
		if (failure !== null) {
			if (import.meta.env.DEV) {
				console.warn(`[morphe-site] intent rejected by the gate: ${failure}`);
			}
			return;
		}
		this.intents.set(def.id, def);
	}

	has(id: string): boolean {
		return this.intents.has(id);
	}

	get(id: string): SiteIntent | undefined {
		return this.intents.get(id);
	}

	/** Every registered intent, in registration order. */
	list(): readonly SiteIntent[] {
		return [...this.intents.values()];
	}
}

/* ------------------------------------------------------------------------- *
 * Palette matching — curated fuzzy match over the registered vocabulary.
 * Tiered substring scoring (exact > prefix > word-start > substring) over the
 * label and keywords; deliberately NO subsequence tier, which over-matches on
 * a six-intent vocabulary ("hot dogs" must miss). ADR-0006: fuzzy string
 * match suffices for the launch set; semantic matching is explicitly v2.
 * ------------------------------------------------------------------------- */

function scoreAgainst(haystack: string, query: string): number {
	if (haystack === query) return 4;
	if (haystack.startsWith(query)) return 3;
	if (haystack.includes(` ${query}`)) return 2;
	if (haystack.includes(query)) return 1;
	return 0;
}

function scoreIntent(intent: SiteIntent, query: string): number {
	const candidates = [intent.label.toLowerCase(), ...intent.keywords.map((k) => k.toLowerCase())];
	return Math.max(...candidates.map((c) => scoreAgainst(c, query)));
}

/**
 * Rank registered intents against a palette query. An empty/blank query
 * returns the full vocabulary (the palette opens showing everything);
 * a query matching nothing returns [] (the palette says so honestly).
 */
export function matchIntents(query: string, intents: readonly SiteIntent[]): readonly SiteIntent[] {
	const q = query.trim().toLowerCase();
	if (q === "") return intents;
	return intents
		.map((intent, index) => ({ intent, index, score: scoreIntent(intent, q) }))
		.filter((row) => row.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((row) => row.intent);
}

/* ------------------------------------------------------------------------- *
 * The launch vocabulary (D9: six chips). Five content intents ship as plain
 * anchors to their canonical pages — KRA-356–359 upgrade each to its morph —
 * and the tracer morph (flip the lights) ships live, proving the engine
 * end-to-end with zero content authoring.
 * ------------------------------------------------------------------------- */

export const SITE_INTENTS: readonly SiteIntent[] = [
	{
		id: "governance-story",
		label: "How is it governed?",
		keywords: ["governance", "governed", "control", "oversight", "approval", "trust"],
		href: "/how-it-works",
		action: {
			kind: "stage-delta",
			id: HOME_INTENT_STAGE_ID,
			choice: HOME_STAGE_CHOICES.governance,
		},
		announce: "How it is held — shown below.",
	},
	{
		id: "technical-version",
		label: "Show me the technical version",
		keywords: ["technical", "architecture", "engineering", "stack", "how it works", "cto"],
		href: "/architecture",
		action: { kind: "navigate" },
	},
	{
		id: "engagement-path",
		label: "How do we start?",
		keywords: ["start", "begin", "onboarding", "engage", "journey", "workflow"],
		href: "/onboarding",
		action: {
			kind: "stage-delta",
			id: HOME_INTENT_STAGE_ID,
			choice: HOME_STAGE_CHOICES.engagement,
		},
		announce: "The first workflow — shown below.",
	},
	{
		id: "founder-identity",
		label: "Who's behind this?",
		keywords: ["who", "founder", "team", "company", "krates", "contact"],
		href: "#contact",
		action: {
			kind: "stage-delta",
			id: HOME_INTENT_STAGE_ID,
			choice: HOME_STAGE_CHOICES.identity,
		},
		announce: "Krates ehf. — shown below.",
	},
	{
		id: "plates-story",
		label: "Tell me the story",
		keywords: ["story", "plates", "narrative", "tale", "nine"],
		href: "/how-it-works",
		action: { kind: "navigate" },
	},
	{
		id: "flip-the-lights",
		label: "Flip the lights",
		keywords: ["lights", "light", "dark", "night", "gallery", "theme", "flip"],
		href: "/substrate",
		action: { kind: "flip-dialect", between: ["gallery", "night"] },
	},
];

/** The module-level default registry the home page renders from. */
export const intentRegistry = new IntentRegistry();

/** Idempotent registration of the launch vocabulary (safe under HMR). */
export function registerSiteIntents(reg: IntentRegistry = intentRegistry): void {
	for (const def of SITE_INTENTS) {
		reg.register(def);
	}
}

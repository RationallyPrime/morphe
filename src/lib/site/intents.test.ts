/**
 * INTENT ENGINE proof tests (ADR-0006 §2–3, KRA-355).
 *
 * The structural claims:
 *
 *   I1  The registration GATE holds: a malformed intent def is never added
 *       (bad id/label/href, an unknown dialect in a flip pair, a non-integer
 *       choice), registration is idempotent, and the launch vocabulary (D9:
 *       six chips) registers cleanly.
 *   I2  MATCHING is honest: empty query → the whole vocabulary; exact and
 *       fuzzy queries rank sensibly; an off-vocabulary query returns NOTHING
 *       (the 113-results lesson — a miss must read as a miss).
 *   I3  EXECUTION is one shared path. The flip-the-lights tracer toggles the
 *       global dialect between the plate-derived pair from ANY starting
 *       ground, and announces itself.
 *   I4  A stage-delta rides the R2 gate: applied deltas advance the envelope;
 *       a malformed delta (unknown id, out-of-range choice, no stage at all)
 *       is REJECTED and the envelope reference is untouched — the page
 *       renders unchanged (render totality at the morph seam).
 *   I5  VOICE (D12): no banned doctrine phrase in any visitor-facing intent
 *       string.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { EmissionEnvelope, Node } from "$morphe";
import { activeDialect, DEFAULT_DIALECT } from "$morphe";
import { intentEngine } from "./intent-engine.svelte.js";
import {
	IntentRegistry,
	intentGateFailure,
	matchIntents,
	registerSiteIntents,
	SITE_INTENTS,
	type SiteIntent,
} from "./intents.js";
import {
	HOME_INTENT_STAGE_ID,
	HOME_STAGE_CHOICES,
	homeIntentStageEnvelope,
} from "./morph-stage.js";

const flipIntent = SITE_INTENTS.find((i) => i.id === "flip-the-lights") as SiteIntent;

/** A minimal valid intent def to mutate per gate case. */
const VALID: SiteIntent = {
	id: "valid-intent",
	label: "A valid intent",
	keywords: ["valid"],
	href: "/somewhere",
	action: { kind: "navigate" },
};

afterEach(() => {
	// The engine and the dialect store are module-level state; leave every
	// test with the slate it found.
	activeDialect.set(DEFAULT_DIALECT);
	intentEngine.setStage(null);
});

describe("I1 — the registration gate", () => {
	it("registers the full launch vocabulary (D9: six chips) on a fresh registry", () => {
		const reg = new IntentRegistry();
		registerSiteIntents(reg);
		expect(reg.list().map((i) => i.id)).toEqual([
			"governance-story",
			"technical-version",
			"engagement-path",
			"founder-identity",
			"plates-story",
			"flip-the-lights",
		]);
	});

	it("is idempotent — a second pass over the same registry is a no-op", () => {
		const reg = new IntentRegistry();
		registerSiteIntents(reg);
		registerSiteIntents(reg);
		expect(reg.list()).toHaveLength(SITE_INTENTS.length);
	});

	it("rejects malformed defs without throwing and without adding", () => {
		const reg = new IntentRegistry();
		const bad: readonly SiteIntent[] = [
			{ ...VALID, id: "Not Kebab" },
			{ ...VALID, id: "empty-label", label: "  " },
			{ ...VALID, id: "no-keywords", keywords: [] },
			{ ...VALID, id: "bad-href", href: "https://elsewhere.example" },
			{
				...VALID,
				id: "unknown-dialect",
				action: { kind: "flip-dialect", between: ["gallery", "does-not-exist"] },
			},
			{
				...VALID,
				id: "self-flip",
				action: { kind: "flip-dialect", between: ["gallery", "gallery"] },
			},
			{
				...VALID,
				id: "fractional-choice",
				action: { kind: "stage-delta", id: "v1", choice: 1.5 },
			},
			{
				...VALID,
				id: "negative-choice",
				action: { kind: "stage-delta", id: "v1", choice: -1 },
			},
		];
		for (const def of bad) {
			expect(intentGateFailure(def), def.id).not.toBeNull();
			expect(() => reg.register(def)).not.toThrow();
			expect(reg.has(def.id), def.id).toBe(false);
		}
		// And the gate passes the shapes it should.
		expect(intentGateFailure(VALID)).toBeNull();
		expect(intentGateFailure(flipIntent)).toBeNull();
	});
});

describe("I2 — palette matching over the registered vocabulary", () => {
	it("an empty query returns the whole vocabulary, in registration order", () => {
		expect(matchIntents("", SITE_INTENTS)).toEqual(SITE_INTENTS);
		expect(matchIntents("   ", SITE_INTENTS)).toEqual(SITE_INTENTS);
	});

	it("an exact label match ranks first", () => {
		const hits = matchIntents("Flip the lights", SITE_INTENTS);
		expect(hits[0]?.id).toBe("flip-the-lights");
	});

	it("a fuzzy fragment finds its intent via label or keyword", () => {
		expect(matchIntents("tech", SITE_INTENTS)[0]?.id).toBe("technical-version");
		expect(matchIntents("govern", SITE_INTENTS)[0]?.id).toBe("governance-story");
		expect(matchIntents("dark", SITE_INTENTS)[0]?.id).toBe("flip-the-lights");
	});

	it("an off-vocabulary query MISSES (no everything-matches fallback)", () => {
		expect(matchIntents("hot dogs that taste like cinnamon", SITE_INTENTS)).toEqual([]);
	});
});

describe("I3 — the flip-the-lights tracer morph (one engine path)", () => {
	it("toggles night -> gallery -> night, announcing each ground", () => {
		// The shipped default IS the light half (KRA-354), so the first flip
		// turns the lights off; from any ground OUTSIDE the pair a flip turns
		// them on — deterministic either way.
		expect(activeDialect.id).toBe("gallery");

		expect(intentEngine.execute(flipIntent)).toEqual({ kind: "morphed" });
		expect(activeDialect.id).toBe("night");
		expect(intentEngine.announcement).toContain("Night");

		expect(intentEngine.execute(flipIntent)).toEqual({ kind: "morphed" });
		expect(activeDialect.id).toBe("gallery");
		expect(intentEngine.announcement).toContain("Gallery");

		activeDialect.setById("icelandic-archive");
		expect(intentEngine.execute(flipIntent)).toEqual({ kind: "morphed" });
		expect(activeDialect.id).toBe("gallery");
	});

	it("a navigate intent is returned to the caller, never executed in-engine", () => {
		// Every REGISTERED intent now morphs (KRA-356–359); the navigate path
		// remains the engine's contract for future vocabulary, proven here.
		expect(intentEngine.execute(VALID)).toEqual({ kind: "navigate", href: "/somewhere" });
		// No side effects: dialect untouched, no announcement.
		expect(activeDialect.id).toBe("gallery");
	});
});

describe("I4 — stage deltas ride the R2 gate (render totality at the morph seam)", () => {
	const varyTree: Node = {
		kind: "stack",
		role: "section",
		children: [
			{
				kind: "vary",
				id: "stage-mode",
				options: [
					{ kind: "text", value: "calm" },
					{ kind: "text", value: "expanded" },
				],
			},
		],
	};
	const envelope: EmissionEnvelope = { epoch: 3, tree: varyTree, choices: {} };

	const deltaIntent = (id: string, choice: number): SiteIntent => ({
		id: "morph-under-test",
		label: "Morph under test",
		keywords: ["test"],
		href: "/how-it-works",
		action: { kind: "stage-delta", id, choice },
		announce: "Stage reshaped.",
	});

	it("with no stage installed, a delta intent is rejected and nothing changes", () => {
		expect(intentEngine.execute(deltaIntent("stage-mode", 1))).toEqual({
			kind: "rejected",
			reason: "no-stage",
		});
		expect(intentEngine.stage).toBeNull();
	});

	it("an applied delta advances the envelope and announces", () => {
		intentEngine.setStage(envelope);
		const outcome = intentEngine.execute(deltaIntent("stage-mode", 1));
		expect(outcome).toEqual({ kind: "morphed" });
		expect(intentEngine.choices).toEqual({ "stage-mode": 1 });
		expect(intentEngine.stage?.epoch).toBe(3);
		expect(intentEngine.announcement).toBe("Stage reshaped.");
	});

	it("a delta addressing no live VaryId is rejected; the envelope is UNTOUCHED", () => {
		intentEngine.setStage(envelope);
		const outcome = intentEngine.execute(deltaIntent("not-a-live-id", 0));
		expect(outcome).toEqual({ kind: "rejected", reason: "unknown-id" });
		// The exact same reference: the page renders byte-identically.
		expect(intentEngine.stage).toBe(envelope);
	});

	it("an out-of-range choice is rejected; the envelope is UNTOUCHED", () => {
		intentEngine.setStage(envelope);
		const outcome = intentEngine.execute(deltaIntent("stage-mode", 99));
		expect(outcome).toEqual({ kind: "rejected", reason: "out-of-range" });
		expect(intentEngine.stage).toBe(envelope);
	});
});

describe("I5 — content morphs consume the shared stage-delta path", () => {
	const expected: ReadonlyArray<readonly [string, number]> = [
		["governance-story", HOME_STAGE_CHOICES.governance],
		["engagement-path", HOME_STAGE_CHOICES.engagement],
		["founder-identity", HOME_STAGE_CHOICES.identity],
		["technical-version", HOME_STAGE_CHOICES.technical],
		["plates-story", HOME_STAGE_CHOICES.plates],
	];

	it("registers KRA-356/357/358/359 content intents as stage deltas, not navigate fallbacks", () => {
		for (const [id, choice] of expected) {
			const intent = SITE_INTENTS.find((i) => i.id === id);
			expect(intent?.action, id).toEqual({
				kind: "stage-delta",
				id: HOME_INTENT_STAGE_ID,
				choice,
			});
		}
	});

	it("ships a home stage envelope with a default branch plus the five authored branches", () => {
		const envelope = homeIntentStageEnvelope();
		expect(envelope.epoch).toBe(1);
		expect(envelope.choices).toEqual({});
		expect(envelope.tree.kind).toBe("vary");
		if (envelope.tree.kind !== "vary") return;
		expect(envelope.tree.id).toBe(HOME_INTENT_STAGE_ID);
		expect(envelope.tree.default).toBe(HOME_STAGE_CHOICES.default);
		expect(envelope.tree.options).toHaveLength(6);
	});

	it("executes each authored content morph through the same engine gate", () => {
		intentEngine.setStage(homeIntentStageEnvelope());
		for (const [id, choice] of expected) {
			const intent = SITE_INTENTS.find((i) => i.id === id) as SiteIntent;
			expect(intentEngine.execute(intent), id).toEqual({ kind: "morphed" });
			expect(intentEngine.choices?.[HOME_INTENT_STAGE_ID], id).toBe(choice);
		}
	});

	it("a later content morph cleanly replaces the previous branch", () => {
		intentEngine.setStage(homeIntentStageEnvelope());
		const governance = SITE_INTENTS.find((i) => i.id === "governance-story") as SiteIntent;
		const engagement = SITE_INTENTS.find((i) => i.id === "engagement-path") as SiteIntent;

		expect(intentEngine.execute(governance)).toEqual({ kind: "morphed" });
		expect(intentEngine.choices?.[HOME_INTENT_STAGE_ID]).toBe(HOME_STAGE_CHOICES.governance);

		expect(intentEngine.execute(engagement)).toEqual({ kind: "morphed" });
		expect(intentEngine.choices?.[HOME_INTENT_STAGE_ID]).toBe(HOME_STAGE_CHOICES.engagement);
	});

	it("keeps no-JS fallbacks on canonical routes while JS execution morphs in place", () => {
		const expectedHrefs = new Map([
			["governance-story", "/how-it-works"],
			["engagement-path", "/onboarding"],
			["founder-identity", "#contact"],
			["technical-version", "/architecture"],
			["plates-story", "/how-it-works"],
		]);

		for (const [id, href] of expectedHrefs) {
			const intent = SITE_INTENTS.find((i) => i.id === id);
			expect(intent?.href, id).toBe(href);
			expect(intent?.action.kind, id).toBe("stage-delta");
		}
	});
});

describe("I6 — voice (D12): intent strings stay out of doctrine register", () => {
	const BANNED_UI_PHRASES = [
		"under governance",
		"the appliance is what acts",
		"read-only",
		"Read-only",
		"map of what is possible",
		"by construction",
		"Read-side",
		"Write-side",
		"AUTHORIZES",
		"dialect", // substrate vocabulary stays off the home page's visitor strings
	];

	it("no banned phrase in any label or announcement", () => {
		for (const intent of SITE_INTENTS) {
			const visitorStrings = `${intent.label} ${intent.announce ?? ""}`;
			for (const phrase of BANNED_UI_PHRASES) {
				expect(visitorStrings, `${intent.id}: ${phrase}`).not.toContain(phrase);
			}
		}
	});
});

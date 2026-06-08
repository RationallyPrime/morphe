/**
 * DIALECT proof tests (Lemma 4) — "re-dialecting is a fixed point".
 *
 * These prove the injection-vessel works: a dialect is an injection at the
 * INTENT layer + bounded priors and NOTHING ELSE. The structural claims:
 *
 *   FP1  An AUTHORED tree is invariant under re-dialecting. The same Node tree
 *        renders structurally identical under either dialect; only the boundary
 *        CSS vars (the intent->scale map) differ. Authoring never names a scale
 *        or a dialect, so swapping the dialect cannot touch it.
 *   FP2  Both dialects keep the SCALES neutral: every intent channel value is a
 *        `var(--mo-…)` reference or a `color-mix` of them — never a literal hex,
 *        never a welded vertical scale name (the legacy's fatal mistake).
 *   FP3  Both dialects cover the full CORE intent set and the shared register
 *        extension names, so an authored `intent: "<name>"` resolves under both.
 *   FP4  The swap is a CLEAN subtree-boundary injection: `applyDialect` yields a
 *        different `attr` and a different value for each shared intent var, while
 *        the authored input is byte-identical.
 *   FP5  Priors are CLAMPED so Lemma 2's four laws survive any dialect.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyDialect } from "./provider.svelte.js";
import { icelandicArchive, DEFAULT_DIALECT, ARCHIVE_SURFACES } from "./icelandic-archive.js";
import { clinical, CLINICAL_SURFACES } from "./clinical.js";
import { DIALECTS, DIALECT_IDS, getDialect, hasDialect, DEFAULT_DIALECT_ID } from "./registry.js";
import { CORE_INTENTS, intentVar } from "../tokens/intents.js";
import type { Node } from "../grammar/types.js";

/** Shared register-extension names both dialects re-read (FP3). */
const REGISTER_EXTENSIONS = ["folio", "marginalia", "seal"] as const;
const CHANNELS = ["surface", "on", "hover", "border", "ring"] as const;

/**
 * An AUTHORED tree. It references ONLY intent names (core + a register
 * extension) and structural roles — never a scale, never a dialect, never a raw
 * value. This is the object whose invariance under re-dialecting is the whole
 * point.
 */
const authoredTree: Node = {
	kind: "frame",
	role: "panel",
	surface: "raised",
	children: [
		{ kind: "text", value: "Batch 0xA3", as: "heading", intent: "accession" },
		{ kind: "badge", label: "Released", intent: "success", icon: "check_circle" },
		{ kind: "badge", label: "Deviation", intent: "caution", icon: "warning" },
		{ kind: "text", value: "p. 12", as: "caption", intent: "folio" },
		{
			kind: "status",
			tone: "info",
			signal: { text: "Awaiting sign-off", icon: "schedule" },
		},
	],
};

/** Deep clone via JSON so we can prove the input was not mutated by application. */
function freezeSnapshot(n: Node): string {
	return JSON.stringify(n);
}

describe("FP1 — an authored tree is invariant under re-dialecting", () => {
	it("the dialect swap does not mutate the authored tree", () => {
		const before = freezeSnapshot(authoredTree);
		applyDialect(icelandicArchive);
		applyDialect(clinical);
		const after = freezeSnapshot(authoredTree);
		expect(after).toBe(before);
	});

	it("the authored tree names no scale and no raw value (only intents/roles)", () => {
		const json = freezeSnapshot(authoredTree);
		// No scale var, no hex, no dialect id leaked into authored content.
		expect(json).not.toMatch(/--mo-(?:neutral|amber|blue|green|red|space|type)/);
		expect(json).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(json).not.toContain("icelandic-archive");
		expect(json).not.toContain("clinical");
	});
});

describe("FP2 — both dialects keep the scales neutral (no welded vertical)", () => {
	const isNeutralScaleExpr = (v: string): boolean => {
		// Allowed: var(--mo-…) refs, color-mix over them, transparent. The crucial
		// discipline is: every COLOUR token is a scale var; no literal hex.
		if (/#[0-9a-fA-F]{3,8}\b/.test(v)) return false; // no literal hex
		// No literal colour-function CALLS. Match the function form only (name
		// immediately followed by `(`), so the `srgb` colour-SPACE keyword inside
		// `color-mix(in srgb, …)` is not mistaken for an `rgb(` literal.
		if (/\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\(/.test(v)) return false;
		// Every var() reference must point at the --mo- scale namespace.
		const refs = v.match(/var\((--[a-z0-9-]+)/g) ?? [];
		return refs.every((r) => r.includes("--mo-"));
	};

	for (const dialect of [icelandicArchive, clinical]) {
		it(`${dialect.id}: every intent channel value references a neutral scale`, () => {
			for (const [name, def] of Object.entries(dialect.intents)) {
				for (const [channel, value] of Object.entries(def)) {
					expect(isNeutralScaleExpr(value), `${dialect.id}.${name}.${channel} = ${value}`).toBe(
						true,
					);
				}
			}
		});

		it(`${dialect.id}: no intent name is a scale name (vertical lives at intent layer)`, () => {
			for (const name of Object.keys(dialect.intents)) {
				// A scale name would look like "amber-500"/"neutral-3"; intent names
				// are semantic words. Guard against accidental re-welding.
				expect(name).not.toMatch(/^(neutral|amber|blue|green|red)-\d+$/);
			}
		});
	}

	it("the surface stacks are neutral-scale only too", () => {
		for (const stack of [ARCHIVE_SURFACES, CLINICAL_SURFACES]) {
			for (const value of Object.values(stack)) {
				expect(isNeutralScaleExpr(value), value).toBe(true);
			}
		}
	});
});

describe("FP3 — both dialects cover the full intent vocabulary authors may use", () => {
	for (const dialect of [icelandicArchive, clinical]) {
		it(`${dialect.id}: defines all ${CORE_INTENTS.length} core intents, all channels`, () => {
			for (const core of CORE_INTENTS) {
				const def = dialect.intents[core];
				expect(def, `${dialect.id} missing core intent ${core}`).toBeDefined();
				for (const channel of CHANNELS) {
					expect(def?.[channel], `${dialect.id}.${core}.${channel}`).toBeTypeOf("string");
				}
			}
		});

		it(`${dialect.id}: defines the shared register extensions`, () => {
			for (const ext of REGISTER_EXTENSIONS) {
				expect(dialect.intents[ext], `${dialect.id} missing extension ${ext}`).toBeDefined();
			}
		});
	}

	it("both dialects expose the SAME intent names (refinement, not renaming)", () => {
		const archiveNames = Object.keys(icelandicArchive.intents).sort();
		const clinicalNames = Object.keys(clinical.intents).sort();
		expect(clinicalNames).toEqual(archiveNames);
	});
});

describe("FP4 — the swap is a clean subtree-boundary injection", () => {
	it("applyDialect yields a different attr and different shared var values", () => {
		const a = applyDialect(icelandicArchive);
		const b = applyDialect(clinical);

		expect(a.attr).toBe("icelandic-archive");
		expect(b.attr).toBe("clinical");
		expect(a.attr).not.toBe(b.attr);

		// Every shared core intent var is present in both boundary var sets...
		let anyDiffered = false;
		for (const core of CORE_INTENTS) {
			for (const channel of CHANNELS) {
				const key = intentVar(core, channel);
				expect(a.vars[key], `archive missing ${key}`).toBeDefined();
				expect(b.vars[key], `clinical missing ${key}`).toBeDefined();
				if (a.vars[key] !== b.vars[key]) anyDiffered = true;
			}
		}
		// ...and the two dialects actually paint differently (it is a real swap).
		expect(anyDiffered).toBe(true);
	});

	it("the boundary var KEYS match across dialects (same slots, different fills)", () => {
		const a = applyDialect(icelandicArchive);
		const b = applyDialect(clinical);
		expect(Object.keys(b.vars).sort()).toEqual(Object.keys(a.vars).sort());
	});

	it("a shared register-extension intent is re-read, not dropped, by the swap", () => {
		const a = applyDialect(icelandicArchive);
		const b = applyDialect(clinical);
		const sealSurface = intentVar("seal", "surface");
		expect(a.vars[sealSurface]).toBeDefined();
		expect(b.vars[sealSurface]).toBeDefined();
		// Archive seal = grave amber; clinical seal = sign-off green. A real remap.
		expect(a.vars[sealSurface]).not.toBe(b.vars[sealSurface]);
	});
});

describe("FP5 — priors are clamped so Lemma 2's laws survive any dialect", () => {
	it("the default (archive) priors apply unchanged (in-range)", () => {
		const applied = applyDialect(DEFAULT_DIALECT);
		expect(applied.rootContext.density).toBe("regular");
		expect(applied.rootContext.scaleTier).toBe(4);
		expect(applied.rootContext.emphasisBudget).toBe(3);
	});

	it("the clinical (denser) priors apply, still inside the clamp range", () => {
		const applied = applyDialect(clinical);
		expect(applied.rootContext.density).toBe("compact");
		expect(applied.rootContext.scaleTier).toBeGreaterThanOrEqual(2);
		expect(applied.rootContext.scaleTier).toBeLessThanOrEqual(4);
		expect(applied.rootContext.emphasisBudget).toBeGreaterThanOrEqual(1);
		expect(applied.rootContext.emphasisBudget).toBeLessThanOrEqual(6);
		// And the dialect's declared values made it through (5 is in range).
		expect(applied.rootContext.emphasisBudget).toBe(5);
		expect(applied.rootContext.scaleTier).toBe(3);
	});
});

describe("data ⇄ CSS agreement — the default dialect equals its static fallback", () => {
	/**
	 * The default dialect's intent map (data) and the
	 * `[data-mo-dialect="icelandic-archive"]` block in tokens/intents.css (the
	 * static fallback that paints before JS) MUST agree by construction. This
	 * test pins that: if either drifts, the colour a user sees would depend on
	 * whether the cascade resolved the static block or a boundary override.
	 */
	function cssVars(): Record<string, string> {
		const cssPath = fileURLToPath(new URL("../tokens/intents.css", import.meta.url));
		const css = readFileSync(cssPath, "utf8");
		const out: Record<string, string> = {};
		for (const m of css.matchAll(/(--mo-[a-z0-9-]+):\s*([^;]+);/g)) {
			out[m[1] as string] = (m[2] as string).trim();
		}
		return out;
	}

	it("every core intent channel in the data matches the static CSS block", () => {
		const vars = cssVars();
		for (const core of CORE_INTENTS) {
			for (const channel of CHANNELS) {
				const key = intentVar(core, channel);
				const dataVal = icelandicArchive.intents[core]?.[channel];
				expect(dataVal, `data ${key}`).toBe(vars[key]);
			}
		}
	});

	it("the surface stack in the data matches the static CSS block", () => {
		const vars = cssVars();
		for (const [key, value] of Object.entries(ARCHIVE_SURFACES)) {
			expect(value, `surface ${key}`).toBe(vars[key]);
		}
	});
});

describe("dialect registry — named lookup for the subtree-boundary swap", () => {
	it("registers both shipped dialects, keyed by id", () => {
		expect(DIALECT_IDS).toContain("icelandic-archive");
		expect(DIALECT_IDS).toContain("clinical");
		expect(DIALECTS["clinical"]).toBe(clinical);
	});

	it("getDialect resolves by id and falls back to default for unknown ids", () => {
		expect(getDialect("clinical")).toBe(clinical);
		expect(getDialect("icelandic-archive")).toBe(icelandicArchive);
		expect(getDialect("does-not-exist").id).toBe(DEFAULT_DIALECT_ID);
		expect(getDialect(undefined).id).toBe(DEFAULT_DIALECT_ID);
	});

	it("hasDialect reports membership without falling back", () => {
		expect(hasDialect("clinical")).toBe(true);
		expect(hasDialect("nope")).toBe(false);
	});

	it("the registry is frozen (read-only data, not a mutable global)", () => {
		expect(Object.isFrozen(DIALECTS)).toBe(true);
	});
});

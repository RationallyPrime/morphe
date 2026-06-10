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
import { applyDialect, unknownIntentsIn } from "./provider.svelte.js";
import { icelandicArchive, DEFAULT_DIALECT, ARCHIVE_SURFACES } from "./icelandic-archive.js";
import { clinical, CLINICAL_SURFACES } from "./clinical.js";
import { reykjavikRegistry, REYKJAVIK_SURFACES } from "./reykjavik-registry.js";
import { DIALECTS, DIALECT_IDS, getDialect, hasDialect, DEFAULT_DIALECT_ID } from "./registry.js";
import { CORE_INTENTS, intentVar } from "../tokens/intents.js";
import { registry as compoundRegistry } from "../compounds/factory.js";
import type { Dialect } from "./types.js";
import type { Node } from "../grammar/types.js";

/** Shared register-extension names every shipped dialect re-reads (FP3). */
const REGISTER_EXTENSIONS = ["folio", "marginalia", "seal"] as const;
const CHANNELS = ["surface", "on", "hover", "border", "ring"] as const;

/**
 * EVERY shipped dialect, driven off the registry (not a literal list), so a new
 * globally-selectable dialect is AUTOMATICALLY held to the fixed point by the
 * parity suite below — exactly the gap that let a third dialect ship missing the
 * `evidence` intent / the action channels / the register extensions / a surface
 * stack and still go green (CONTRACT §8). If a dialect is added to registry.ts
 * but not brought to parity, FP2/FP3/FP4 fail here.
 */
const SHIPPED_DIALECTS: readonly Dialect[] = DIALECT_IDS.map((id) => DIALECTS[id] as Dialect);
const DIALECT_VALUE_PATTERN = /^(var\(--mo-|color-mix\(|transparent$)/;

/** Every shipped dialect's surface stack, by id (FP2 — surfaces stay neutral too). */
const SURFACE_STACKS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	"icelandic-archive": ARCHIVE_SURFACES,
	clinical: CLINICAL_SURFACES,
	"reykjavik-registry": REYKJAVIK_SURFACES,
};

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

	for (const dialect of SHIPPED_DIALECTS) {
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

		it(`${dialect.id}: its surface stack is neutral-scale only too`, () => {
			const stack = SURFACE_STACKS[dialect.id];
			expect(stack, `${dialect.id} ships no surface stack`).toBeDefined();
			for (const value of Object.values(stack ?? {})) {
				expect(isNeutralScaleExpr(value), value).toBe(true);
			}
		});

		it(`${dialect.id}: every intent and surface value uses the dialect value pattern`, () => {
			for (const [name, def] of Object.entries(dialect.intents)) {
				for (const [channel, value] of Object.entries(def)) {
					expect(value, `${dialect.id}.${name}.${channel}`).toMatch(DIALECT_VALUE_PATTERN);
				}
			}
			const stack = SURFACE_STACKS[dialect.id];
			for (const [name, value] of Object.entries(stack ?? {})) {
				expect(value, `${dialect.id}.surface.${name}`).toMatch(DIALECT_VALUE_PATTERN);
			}
		});
	}
});

describe("FP3 — every shipped dialect covers the full intent vocabulary authors may use", () => {
	for (const dialect of SHIPPED_DIALECTS) {
		it(`${dialect.id}: defines all ${CORE_INTENTS.length} core intents, all channels`, () => {
			for (const core of CORE_INTENTS) {
				const def = dialect.intents[core];
				expect(def, `${dialect.id} missing core intent ${core}`).toBeDefined();
				for (const channel of CHANNELS) {
					expect(def?.[channel], `${dialect.id}.${core}.${channel}`).toBeTypeOf("string");
				}
			}
		});

		it(`${dialect.id}: every core intent carries the action active/disabled channels`, () => {
			// The SEVEN-channel set for core intents is part of the §8 fixed point: a
			// button's pressed/disabled state is intent-scoped, so a dialect that omits
			// them lets those states fall through to the warm Archive defaults.
			for (const core of CORE_INTENTS) {
				const def = dialect.intents[core];
				expect(def?.active, `${dialect.id}.${core}.active`).toBeTypeOf("string");
				expect(def?.disabled, `${dialect.id}.${core}.disabled`).toBeTypeOf("string");
			}
		});

		it(`${dialect.id}: defines the shared register extensions`, () => {
			for (const ext of REGISTER_EXTENSIONS) {
				expect(dialect.intents[ext], `${dialect.id} missing extension ${ext}`).toBeDefined();
			}
		});
	}

	it("every shipped dialect exposes the SAME intent names (refinement, not renaming)", () => {
		const defaultNames = Object.keys(DEFAULT_DIALECT.intents).sort();
		for (const dialect of SHIPPED_DIALECTS) {
			expect(Object.keys(dialect.intents).sort(), `${dialect.id} intent names`).toEqual(
				defaultNames,
			);
		}
	});

	it("unknownIntentsIn reports typo'd intent refs and ignores valid refs", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "valid", intent: "provenance" },
				{ kind: "badge", label: "bad", intent: "provenence" },
				{ kind: "status", tone: "caution", signal: { text: "closed union tone" } },
			],
		};
		expect(unknownIntentsIn(tree, DEFAULT_DIALECT.intents)).toEqual(["provenence"]);
		expect(
			unknownIntentsIn({ kind: "text", value: "valid", intent: "provenance" }, DEFAULT_DIALECT.intents),
		).toEqual([]);
	});

	it("unknownIntentsIn walks a CompoundRef's authored surface: slot fills and node args", () => {
		// childrenOf returns [] for a compound, so without the explicit walk the
		// CALL SITE's authored intents would escape the dev warning entirely.
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{
					kind: "compound",
					name: "whatever",
					args: {
						title: { kind: "text", value: "via arg", intent: "provenance" },
						sub: { kind: "text", value: "typo'd via arg", intent: "evidense" },
						plain: "a non-node arg is skipped",
					},
					slots: {
						foot: [
							{ kind: "badge", label: "typo'd via slot", intent: "acession" },
							{ kind: "text", value: "valid via slot", intent: "accession" },
						],
					},
				},
			],
		};
		expect(unknownIntentsIn(tree, DEFAULT_DIALECT.intents).sort()).toEqual([
			"acession",
			"evidense",
		]);
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

	it("EVERY shipped dialect's boundary var KEYS equal the default's (the §8 keyset fixed point)", () => {
		// The whole point of the parity gate: a globally-shipped dialect that omits
		// any intent/channel produces a SMALLER `vars` keyset, so anything it omits
		// falls through to the warm Archive `:root` block — a partial re-theme. Hold
		// every shipped dialect to the default's exact keyset, driven off the registry
		// so a future dialect is automatically gated.
		const defaultKeys = Object.keys(applyDialect(DEFAULT_DIALECT).vars).sort();
		for (const dialect of SHIPPED_DIALECTS) {
			expect(Object.keys(applyDialect(dialect).vars).sort(), `${dialect.id} keyset`).toEqual(
				defaultKeys,
			);
		}
	});

	it("each non-default shipped dialect actually repaints (a real swap, not a re-attr)", () => {
		const def = applyDialect(DEFAULT_DIALECT);
		for (const dialect of SHIPPED_DIALECTS) {
			if (dialect.id === DEFAULT_DIALECT.id) continue;
			const other = applyDialect(dialect);
			expect(other.attr, `${dialect.id} attr`).not.toBe(def.attr);
			const anyDiffered = Object.keys(def.vars).some((k) => def.vars[k] !== other.vars[k]);
			expect(anyDiffered, `${dialect.id} paints identically to the default`).toBe(true);
		}
	});

	it("a shared register-extension intent is re-read, not dropped, by every swap", () => {
		const sealSurface = intentVar("seal", "surface");
		const defSeal = applyDialect(DEFAULT_DIALECT).vars[sealSurface];
		expect(defSeal, "default missing seal surface").toBeDefined();
		for (const dialect of SHIPPED_DIALECTS) {
			const v = applyDialect(dialect).vars[sealSurface];
			expect(v, `${dialect.id} missing seal surface`).toBeDefined();
			if (dialect.id !== DEFAULT_DIALECT.id) {
				// A different scale mapping per register — the extension-tier fixed point.
				expect(v, `${dialect.id} seal not remapped`).not.toBe(defSeal);
			}
		}
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
	it("registers all three shipped dialects, keyed by id", () => {
		expect(DIALECT_IDS).toContain("icelandic-archive");
		expect(DIALECT_IDS).toContain("clinical");
		expect(DIALECT_IDS).toContain("reykjavik-registry");
		expect(DIALECTS["clinical"]).toBe(clinical);
		expect(DIALECTS["reykjavik-registry"]).toBe(reykjavikRegistry);
	});

	it("getDialect resolves by id and falls back to default for unknown ids", () => {
		expect(getDialect("clinical")).toBe(clinical);
		expect(getDialect("icelandic-archive")).toBe(icelandicArchive);
		expect(getDialect("reykjavik-registry")).toBe(reykjavikRegistry);
		expect(getDialect("does-not-exist").id).toBe(DEFAULT_DIALECT_ID);
		expect(getDialect(undefined).id).toBe(DEFAULT_DIALECT_ID);
	});

	it("hasDialect reports membership without falling back", () => {
		expect(hasDialect("clinical")).toBe(true);
		expect(hasDialect("reykjavik-registry")).toBe(true);
		expect(hasDialect("nope")).toBe(false);
	});

	it("the registry is frozen (read-only data, not a mutable global)", () => {
		expect(Object.isFrozen(DIALECTS)).toBe(true);
	});
});

describe("FP6 — every shipped dialect's compound subset resolves against the registry", () => {
	// G|D's compound half (Lemma 4): a dialect's `compounds[]` is an allowlist
	// over the compound registry. A name that resolves to nothing would make the
	// restriction silently hide content under exactly one dialect — the kind of
	// drift this parity suite exists to catch. All shipped lists are EMPTY today
	// (unrestricted, Corollary 1); this guards the day one is not.
	it("each declared compound name is registered", () => {
		for (const d of Object.values(DIALECTS)) {
			for (const name of d.compounds) {
				expect(compoundRegistry.has(name), `${d.id}: unregistered compound "${name}"`).toBe(
					true,
				);
			}
		}
	});
});

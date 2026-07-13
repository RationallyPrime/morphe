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
import { registry as compoundRegistry } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { CORE_INTENTS, INTENT_REFS, intentVar, REGISTER_INTENTS } from "../tokens/intents.js";
import { CLINICAL_SURFACES, clinical } from "./clinical.js";
import { ESTATE_SURFACES, estate } from "./estate.js";
import { FOUNDRY_SURFACES, foundry } from "./foundry.js";
import { GALLERY_SURFACES, gallery } from "./gallery.js";
import { ARCHIVE_SURFACES, icelandicArchive } from "./icelandic-archive.js";
import { LEDGER_SURFACES, ledger } from "./ledger.js";
import { NIGHT_SURFACES, night } from "./night.js";
import { applyDialect, unknownIntentsIn } from "./provider.svelte.js";
import {
	DEFAULT_DIALECT,
	DEFAULT_DIALECT_ID,
	DIALECT_IDS,
	DIALECTS,
	getDialect,
	hasDialect,
} from "./registry.js";
import { REYKJAVIK_SURFACES, reykjavikRegistry } from "./reykjavik-registry.js";
import { TIMAEUS_SURFACES, timaeus } from "./timaeus.js";
import type { Dialect } from "./types.js";

/** Shared register-extension names every shipped dialect re-reads (FP3). */
const REGISTER_EXTENSIONS = REGISTER_INTENTS;
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
	timaeus: TIMAEUS_SURFACES,
	gallery: GALLERY_SURFACES,
	night: NIGHT_SURFACES,
	ledger: LEDGER_SURFACES,
	estate: ESTATE_SURFACES,
	foundry: FOUNDRY_SURFACES,
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

	it("the grammar-declared intent refs equal the fixed dialect keyset", () => {
		expect([...INTENT_REFS].sort()).toEqual(Object.keys(DEFAULT_DIALECT.intents).sort());
	});

	it("unknownIntentsIn reports typo'd intent refs and ignores valid refs", () => {
		const tree = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "valid", intent: "provenance" },
				{ kind: "badge", label: "bad", intent: "provenence" },
				{ kind: "status", tone: "caution", signal: { text: "closed union tone" } },
			],
		} as unknown as Node;
		expect(unknownIntentsIn(tree, DEFAULT_DIALECT.intents)).toEqual(["provenence"]);
		expect(
			unknownIntentsIn(
				{ kind: "text", value: "valid", intent: "provenance" },
				DEFAULT_DIALECT.intents,
			),
		).toEqual([]);
	});

	it("unknownIntentsIn walks a CompoundRef's authored surface: slot fills and node args", () => {
		// childrenOf returns [] for a compound, so without the explicit walk the
		// CALL SITE's authored intents would escape the dev warning entirely.
		const tree = {
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
		} as unknown as Node;
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
	it("the default (gallery) priors apply unchanged (in-range)", () => {
		const applied = applyDialect(DEFAULT_DIALECT);
		expect(applied.rootContext.density).toBe("regular");
		expect(applied.rootContext.scaleTier).toBe(4);
		expect(applied.rootContext.emphasisBudget).toBe(2);
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

describe("data ⇄ CSS agreement — each static block equals its dialect's data", () => {
	/**
	 * tokens/intents.css carries TWO static blocks: `:root` (+ the explicit
	 * gallery scope) — the DEFAULT dialect, what paints before JS and what
	 * native chrome outside a MorpheRoot stands on — and the retired-as-default
	 * Archive's own scope. Each MUST agree, value for value, with its dialect's
	 * data: if either drifts, the colour a user sees would depend on whether
	 * the cascade resolved the static block or a boundary override.
	 */
	const ALL_CHANNELS = [...CHANNELS, "active", "disabled"] as const;

	/** Whitespace-insensitive value form (the CSS wraps long color-mix calls). */
	function normalize(v: string): string {
		return v.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
	}

	/** Parse intents.css into selector -> { var -> value }. */
	function cssBlocks(): Record<string, Record<string, string>> {
		const cssPath = fileURLToPath(new URL("../tokens/intents.css", import.meta.url));
		const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const out: Record<string, Record<string, string>> = {};
		for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
			const selector = normalize(m[1] as string);
			const vars: Record<string, string> = {};
			for (const v of (m[2] as string).matchAll(/(--mo-[a-z0-9-]+):\s*([^;]+);/g)) {
				vars[v[1] as string] = normalize(v[2] as string);
			}
			out[selector] = vars;
		}
		return out;
	}

	const CASES = [
		{
			selector: ':root, [data-mo-dialect="gallery"]',
			dialect: gallery,
			surfaces: GALLERY_SURFACES,
		},
		{
			selector: '[data-mo-dialect="icelandic-archive"]',
			dialect: icelandicArchive,
			surfaces: ARCHIVE_SURFACES,
		},
	] as const;

	it("the DEFAULT dialect owns the :root block (the pre-JS ground is the default)", () => {
		expect(CASES[0].dialect.id).toBe(DEFAULT_DIALECT.id);
	});

	for (const { selector, dialect, surfaces } of CASES) {
		it(`${dialect.id}: every core intent channel in the data matches its static block`, () => {
			const block = cssBlocks()[selector];
			expect(block, `missing static block ${selector}`).toBeDefined();
			for (const core of CORE_INTENTS) {
				for (const channel of ALL_CHANNELS) {
					const key = intentVar(core, channel);
					const dataVal = dialect.intents[core]?.[channel];
					expect(dataVal && normalize(dataVal), `${dialect.id} ${key}`).toBe(block?.[key]);
				}
			}
		});

		it(`${dialect.id}: the surface stack in the data matches its static block`, () => {
			const block = cssBlocks()[selector];
			for (const [key, value] of Object.entries(surfaces)) {
				expect(normalize(value), `${dialect.id} surface ${key}`).toBe(block?.[key]);
			}
		});
	}
});

describe("dialect registry — named lookup for the subtree-boundary swap", () => {
	it("registers every shipped dialect, keyed by id", () => {
		expect(DIALECT_IDS).toContain("icelandic-archive");
		expect(DIALECT_IDS).toContain("clinical");
		expect(DIALECT_IDS).toContain("reykjavik-registry");
		expect(DIALECT_IDS).toContain("timaeus");
		expect(DIALECT_IDS).toContain("gallery");
		expect(DIALECT_IDS).toContain("night");
		expect(DIALECTS.clinical).toBe(clinical);
		expect(DIALECTS["reykjavik-registry"]).toBe(reykjavikRegistry);
		expect(DIALECTS.gallery).toBe(gallery);
		expect(DIALECTS.night).toBe(night);
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

describe("timaeus — the plates' blue-constellation world (KRA-326)", () => {
	// What is UNIQUE to this dialect: the plates are FIXED POINTS the substrate
	// re-poses around, so its beacon must be the plates' own lattice light (the
	// cobalt ramp minted for it), never the Archive amber — and its grounds must
	// carry the blue cast so a Timaeus page and its figures read as one object.
	it("the beacon rides the cobalt scale (the plates' lattice light, not the amber)", () => {
		const beacon = applyDialect(timaeus).vars[intentVar("primary-action", "surface")];
		expect(beacon).toBe("var(--mo-cobalt-500)");
		for (const channel of CHANNELS) {
			const v = applyDialect(timaeus).vars[intentVar("primary-action", channel)];
			expect(v, `timaeus.primary-action.${channel}`).toContain("--mo-cobalt-");
		}
	});

	it("every ground in the surface stack is cooled toward the lattice navy", () => {
		for (const key of ["base", "raised", "sunken", "overlay"] as const) {
			const v = TIMAEUS_SURFACES[`--mo-intent-surface-${key}`];
			expect(v, `timaeus surface ${key}`).toContain("--mo-cobalt-700");
		}
	});
});

describe("the cohort registers — ledger / estate / foundry (six-cohort expansion)", () => {
	// What is UNIQUE to this trio: they exist to give three previously-colliding
	// cohorts their OWN beacon hue (finance/roll-up/industrial were tripled up on
	// reykjavik/clinical). The parity suite above already proves keyset completeness;
	// here we prove the DIFFERENTIATION actually landed — each beacon rides its own
	// minted scale, distinct from the others, and the substrate carries that hue.
	const REGISTERS = [
		{ dialect: ledger, accent: "teal", surfaces: LEDGER_SURFACES },
		{ dialect: estate, accent: "copper", surfaces: ESTATE_SURFACES },
		{ dialect: foundry, accent: "steel", surfaces: FOUNDRY_SURFACES },
	] as const;

	for (const { dialect, accent, surfaces } of REGISTERS) {
		it(`${dialect.id}: the beacon rides the ${accent} scale on every channel`, () => {
			const vars = applyDialect(dialect).vars;
			expect(vars[intentVar("primary-action", "surface")]).toBe(`var(--mo-${accent}-500)`);
			for (const channel of CHANNELS) {
				const v = vars[intentVar("primary-action", channel)];
				expect(v, `${dialect.id}.primary-action.${channel}`).toContain(`--mo-${accent}-`);
			}
		});

		it(`${dialect.id}: its substrate carries the ${accent} cast (grounds mix the 700 tone)`, () => {
			for (const key of ["base", "raised", "overlay"] as const) {
				const v = surfaces[`--mo-intent-surface-${key}`];
				expect(v, `${dialect.id} surface ${key}`).toContain(`--mo-${accent}-700`);
			}
		});

		it(`${dialect.id}: keeps the semantic families (caution red, success green)`, () => {
			expect(dialect.intents.caution?.surface).toContain("--mo-red-");
			expect(dialect.intents.success?.surface).toContain("--mo-green-");
		});
	}

	it("the three registers are mutually distinct beacons (no shared identity hue)", () => {
		const beaconOf = (d: (typeof REGISTERS)[number]["dialect"]): string | undefined =>
			applyDialect(d).vars[intentVar("primary-action", "surface")];
		const beacons = [beaconOf(ledger), beaconOf(estate), beaconOf(foundry)];
		expect(new Set(beacons).size, beacons.join(" / ")).toBe(3);
	});
});

describe("gallery + night — the plate-derived pair (KRA-349, ADR-0005)", () => {
	// What is UNIQUE to this pair: both dialects are derived from the plates'
	// OWN palette — gallery is the museum wall (bone paper ground, plate-shadow
	// ink, one cobalt accent), night is the inside of the plates (the blue-black
	// strata as the page ground, ice text, the lattice beacon). The default is
	// untouched in this slice (the flip is KRA-354).
	it("gallery stands on the bone paper ramp (every ground is a bone step)", () => {
		for (const key of ["base", "raised", "sunken", "overlay"] as const) {
			const v = GALLERY_SURFACES[`--mo-intent-surface-${key}`];
			expect(v, `gallery surface ${key}`).toContain("--mo-bone-");
		}
	});

	it("gallery text is the plate-shadow ink and its beacon rides the cobalt scale", () => {
		expect(GALLERY_SURFACES["--mo-intent-on-surface"]).toBe("var(--mo-cobalt-800)");
		const vars = applyDialect(gallery).vars;
		expect(vars[intentVar("primary-action", "surface")]).toBe("var(--mo-cobalt-600)");
		for (const channel of CHANNELS) {
			const v = vars[intentVar("primary-action", channel)];
			expect(v, `gallery.primary-action.${channel}`).toContain("--mo-cobalt-");
		}
	});

	it("gallery's single accent is cobalt: no amber anywhere in the dialect", () => {
		// ADR-0005's two-master rule: the amber retirement means the gallery may
		// not reach for the warm metal at all — one accent, by conviction.
		for (const [name, def] of Object.entries(gallery.intents)) {
			for (const [channel, value] of Object.entries(def)) {
				expect(value, `gallery.${name}.${channel}`).not.toContain("--mo-amber-");
			}
		}
		for (const value of Object.values(GALLERY_SURFACES)) {
			expect(value).not.toContain("--mo-amber-");
		}
	});

	it("night stands on the strata (every ground is a deep cobalt step)", () => {
		for (const key of ["base", "raised", "sunken", "overlay"] as const) {
			const v = NIGHT_SURFACES[`--mo-intent-surface-${key}`];
			expect(v, `night surface ${key}`).toMatch(/--mo-cobalt-9(00|50)/);
		}
		// And the well truly is the floor: sunken sits ON the deepest stratum.
		expect(NIGHT_SURFACES["--mo-intent-surface-sunken"]).toBe("var(--mo-cobalt-950)");
	});

	it("night text is the ice of the hot cores and its beacon is the lattice light", () => {
		expect(NIGHT_SURFACES["--mo-intent-on-surface"]).toBe("var(--mo-cobalt-100)");
		const vars = applyDialect(night).vars;
		expect(vars[intentVar("primary-action", "surface")]).toBe("var(--mo-cobalt-500)");
	});

	it("the pair's priors keep the substrate quiet (tight budget, in clamp range)", () => {
		for (const d of [gallery, night]) {
			const applied = applyDialect(d);
			expect(applied.rootContext.emphasisBudget, `${d.id} budget`).toBe(2);
			expect(applied.rootContext.scaleTier, `${d.id} scaleTier`).toBe(4);
			expect(applied.rootContext.density, `${d.id} density`).toBe("regular");
		}
	});

	it("gallery IS the shipped default (the KRA-354 flip; ADR-0005 §2)", () => {
		expect(DEFAULT_DIALECT_ID).toBe("gallery");
		expect(DEFAULT_DIALECT.id).toBe("gallery");
		// The Archive is retired as the default but stays registered — the
		// substrate demo's fixed point, selectable on /substrate.
		expect(hasDialect("icelandic-archive")).toBe(true);
	});
});

describe("FP6 — every shipped dialect's compound subset resolves against the registry", () => {
	// G|D's compound half (Lemma 4): a dialect's `compounds[]` is an allowlist
	// over the compound registry. A name that resolves to nothing would make the
	// restriction silently hide content under exactly one dialect — the kind of
	// drift this parity suite exists to catch. Structural restriction is live:
	// `clinical` ships the first real allowlist (["SignalCard"], generated from
	// py/morphe_grammar/dialects.py); the other shipped dialects remain
	// unrestricted with empty lists.
	it("each declared compound name is registered", () => {
		for (const d of Object.values(DIALECTS)) {
			for (const name of d.compounds) {
				expect(compoundRegistry.has(name), `${d.id}: unregistered compound "${name}"`).toBe(true);
			}
		}
	});
});

describe("FP7 — surface stacks ride applyDialect (the grounds actually paint)", () => {
	// Before this law, *_SURFACES were test-enforced data only: applyDialect
	// flattened `intents` exclusively, intents.css defines the surface vars only
	// under the `:root`/archive block, and so every non-default dialect kept the
	// Archive's warm grounds at runtime — a PARTIAL re-theme. A dialect's surface
	// stack must (a) be wired on the Dialect object itself and (b) be emitted by
	// applyDialect, so a boundary swap repaints the ground it stands on.
	it("every shipped dialect wires its exported surface stack as `surfaces`", () => {
		for (const [id, stack] of Object.entries(SURFACE_STACKS)) {
			expect(DIALECTS[id]?.surfaces, `${id}: Dialect.surfaces`).toBe(stack);
		}
	});

	it("applyDialect emits every surface var of the dialect's stack, verbatim", () => {
		for (const [id, stack] of Object.entries(SURFACE_STACKS)) {
			const dialect = DIALECTS[id];
			if (dialect === undefined) throw new Error(`unregistered id in SURFACE_STACKS: ${id}`);
			const vars = applyDialect(dialect).vars;
			for (const [name, value] of Object.entries(stack)) {
				expect(vars[name], `${id}: ${name}`).toBe(value);
			}
		}
	});

	it("intent channel vars always win a (hypothetical) key collision with surfaces", () => {
		// Surface keys (`--mo-intent-surface-*`, `--mo-scrim`) and intent channel
		// keys (`--mo-intent-<name>-<channel>`) are disjoint namespaces today;
		// this pins the merge ORDER so a future collision resolves toward intents.
		const vars = applyDialect(timaeus).vars;
		expect(vars[intentVar("primary-action", "surface")]).toBe("var(--mo-cobalt-500)");
	});
});

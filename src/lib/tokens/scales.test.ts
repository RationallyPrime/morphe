/**
 * SCALES gate (KRA-826) — the drift gates that keep the bottom token layer raw.
 *
 * Four permanent test groups:
 *
 *   1. NAME GRAMMAR — a scale must never carry meaning. Every custom property
 *      declared in scales.css is either geometry (space/type/leading/radius/
 *      elev/layer/stroke/ring/font) or `--mo-<family>-(<step>|on)` with the
 *      family drawn from the enumerated neutral list. A `--mo-color-primary-
 *      action` (the legacy's welded vertical) fails here.
 *   2. LADDER COMPLETENESS — each step-numbered chromatic family carries the
 *      full {50,100,200,300,400,500,600,700,800,900,950} ladder.
 *   3. MONOTONICITY — within a family, OKLab lightness L strictly decreases as
 *      the step number increases, modulo the explicitly allowlisted
 *      pre-existing inversions. Adding to that list requires a comment citing
 *      KRA-826 (or its successor ticket).
 *   4. HEX QUARANTINE — no color hex literal in primitives/compounds/render/
 *      context source; color always enters through a scale token.
 *
 * No new dependencies: sRGB→OKLab is inlined below (Björn Ottosson's published
 * matrices; only the L channel is needed) and `oklch()` literals are parsed
 * directly.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Loaded via fs (same as dialects.test.ts loads intents.css): the vitest css
// pipeline stubs `?raw` stylesheet imports to the empty string here.
const scalesCss = readFileSync(fileURLToPath(new URL("./scales.css", import.meta.url)), "utf8");

/* ------------------------------------------------------------------------- *
 * Shared parsing
 * ------------------------------------------------------------------------- */

/** The step-numbered chromatic families (full-ladder rule applies). */
const CHROMATIC_FAMILIES = [
	"amber",
	"blue",
	"green",
	"red",
	"violet",
	"cobalt",
	"teal",
	"copper",
	"steel",
] as const;

/** The ordinal surface stacks — EXEMPT from the ladder rules (KRA-826). */
const ORDINAL_FAMILIES = ["neutral", "bone"] as const;

const ALL_FAMILIES = [...CHROMATIC_FAMILIES, ...ORDINAL_FAMILIES];

const LADDER_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Pre-existing OKLab-L inversions, frozen with their values (KRA-826: existing
 * steps keep their exact values, so these two cannot be repaired):
 *   - amber: 400 (#e9c349) is darker than 500 (#f2ca50, "the beacon") — the
 *     inversion named by the ticket itself.
 *   - blue: 400 (#b4c5ff) is darker than 500 (#bfcdff) — same pre-existing
 *     shape in the periwinkle ramp, discovered during the KRA-826 fill; both
 *     values predate the ladder pass and are frozen by its decision record.
 * No NEW inversion may be introduced; additions here require a citing comment.
 */
const KNOWN_INVERSIONS = ["amber:400>500", "blue:400>500"] as const;

/** scales.css with comments stripped (so prose naming tokens is not parsed). */
const css = scalesCss.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every `--mo-*: value;` declaration in scales.css. */
function declarations(): ReadonlyMap<string, string> {
	const out = new Map<string, string>();
	for (const m of css.matchAll(/(--mo-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
		out.set(m[1] as string, (m[2] as string).trim());
	}
	return out;
}

/** The color tokens of one family, step -> literal value. */
function familySteps(family: string): ReadonlyMap<number, string> {
	const out = new Map<number, string>();
	for (const [name, value] of declarations()) {
		const m = name.match(/^--mo-([a-z]+)-(\d+)$/);
		if (m && m[1] === family) out.set(Number(m[2]), value);
	}
	return out;
}

/* ------------------------------------------------------------------------- *
 * sRGB → OKLab L (inline; Ottosson's matrices, L channel only)
 * ------------------------------------------------------------------------- */

function srgbChannelToLinear(byte: number): number {
	const c = byte / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToOklabL(hex: string): number {
	const h = hex.replace("#", "");
	const full =
		h.length === 3
			? h
					.split("")
					.map((x) => x + x)
					.join("")
			: h;
	const r = srgbChannelToLinear(Number.parseInt(full.slice(0, 2), 16));
	const g = srgbChannelToLinear(Number.parseInt(full.slice(2, 4), 16));
	const b = srgbChannelToLinear(Number.parseInt(full.slice(4, 6), 16));
	const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
	return 0.2104542553 * Math.cbrt(l) + 0.793617785 * Math.cbrt(m) - 0.0040720468 * Math.cbrt(s);
}

/** OKLab L of a scales.css color literal (`#hex` or `oklch(L% C H)`). */
function oklabLOf(value: string): number {
	const okl = value.match(/^oklch\(\s*([\d.]+)(%?)/);
	if (okl) {
		const raw = Number.parseFloat(okl[1] as string);
		return okl[2] === "%" ? raw / 100 : raw;
	}
	const hex = value.match(/^#[0-9a-fA-F]{3,8}$/);
	if (hex) return hexToOklabL(value);
	throw new Error(`not a color literal: ${value}`);
}

/* ------------------------------------------------------------------------- *
 * 1. Name grammar — a scale must never carry meaning
 * ------------------------------------------------------------------------- */

describe("scales name grammar (anti-semantic-drift)", () => {
	const GEOMETRY = new RegExp(
		"^--mo-(?:" +
			[
				"space-\\d+",
				"type-\\d+",
				"leading-[a-z]+",
				"radius-(?:\\d+|full)",
				"elev-\\d+",
				"layer-[a-z]+",
				"border-width(?:-strong)?",
				"ring-width",
				"ring-offset",
				"font-(?:display|body|mono)",
			].join("|") +
			")$",
	);
	const COLOR = new RegExp(`^--mo-(?:${ALL_FAMILIES.join("|")})-(?:\\d+|on)$`);

	it("every declared custom property is geometry or a neutral family token", () => {
		const decls = declarations();
		expect(decls.size).toBeGreaterThan(0);
		for (const name of decls.keys()) {
			const ok = GEOMETRY.test(name) || COLOR.test(name);
			expect(ok, `${name} is neither geometry nor a neutral <family>-<step|on> token`).toBe(true);
		}
	});

	it("the grammar itself rejects a welded semantic name", () => {
		// The legacy's fatal shape must stay unrepresentable at this layer.
		for (const bad of ["--mo-color-primary-action", "--mo-judicial-crimson-500"]) {
			expect(GEOMETRY.test(bad) || COLOR.test(bad), bad).toBe(false);
		}
	});
});

/* ------------------------------------------------------------------------- *
 * 2. Ladder completeness
 * ------------------------------------------------------------------------- */

describe("ladder completeness — every chromatic family carries the full ladder", () => {
	for (const family of CHROMATIC_FAMILIES) {
		it(`${family}: has every step in {${LADDER_STEPS.join(",")}}`, () => {
			const steps = familySteps(family);
			for (const step of LADDER_STEPS) {
				expect(steps.has(step), `--mo-${family}-${step} is missing`).toBe(true);
			}
		});
	}
});

/* ------------------------------------------------------------------------- *
 * 3. Monotonicity — OKLab L strictly decreasing per family
 * ------------------------------------------------------------------------- */

describe("monotonicity — OKLab L strictly decreases with the step number", () => {
	for (const family of CHROMATIC_FAMILIES) {
		it(`${family}: strictly decreasing L (allowlisted inversions only)`, () => {
			const steps = [...familySteps(family).entries()].sort((a, b) => a[0] - b[0]);
			for (let i = 1; i < steps.length; i++) {
				const [prevStep, prevVal] = steps[i - 1] as [number, string];
				const [curStep, curVal] = steps[i] as [number, string];
				const key = `${family}:${prevStep}>${curStep}`;
				if ((KNOWN_INVERSIONS as readonly string[]).includes(key)) {
					// The allowlisted inversion must still BE an inversion — if the
					// values are ever re-cut monotone, the allowlist entry must go.
					expect(
						oklabLOf(curVal),
						`${key} is allowlisted but no longer inverted — remove it`,
					).toBeGreaterThanOrEqual(oklabLOf(prevVal));
					continue;
				}
				expect(
					oklabLOf(curVal),
					`--mo-${family}-${curStep} (${curVal}) must be darker than --mo-${family}-${prevStep} (${prevVal})`,
				).toBeLessThan(oklabLOf(prevVal));
			}
		});
	}

	it("the ordinal stacks are exempt but must still parse as color literals", () => {
		for (const family of ORDINAL_FAMILIES) {
			const steps = familySteps(family);
			expect(steps.size, `${family} has no steps`).toBeGreaterThan(0);
			for (const value of steps.values()) {
				expect(() => oklabLOf(value)).not.toThrow();
			}
		}
	});
});

/* ------------------------------------------------------------------------- *
 * 4. Hex quarantine — color enters components only through scale tokens
 * ------------------------------------------------------------------------- */

describe("hex quarantine — no color hex literal outside the scales", () => {
	/**
	 * Pre-existing hits are either migrated to a scale token (preferred) or
	 * added here with an inline justification comment. Empty is the goal state.
	 */
	const ALLOWLISTED_HEX: readonly string[] = [];

	const SWEPT_DIRS = ["primitives", "compounds", "render", "context"] as const;
	const HEX = /#[0-9a-fA-F]{3,8}\b/g;

	function* walk(dir: string): Generator<string> {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) {
				yield* walk(path);
			} else if (/\.(?:ts|svelte)$/.test(entry)) {
				yield path;
			}
		}
	}

	for (const dirName of SWEPT_DIRS) {
		it(`src/lib/${dirName}: no hex literals outside the allowlist`, () => {
			const dir = fileURLToPath(new URL(`../${dirName}`, import.meta.url));
			for (const file of walk(dir)) {
				const source = readFileSync(file, "utf8");
				for (const match of source.matchAll(HEX)) {
					expect(
						ALLOWLISTED_HEX.includes(match[0]),
						`${file}: hex literal ${match[0]} — use a scale token (or allowlist with justification)`,
					).toBe(true);
				}
			}
		});
	}
});

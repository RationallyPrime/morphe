/**
 * Functional-color family invariance (KRA-825 gate 3).
 *
 * "Functional color is never a mood": under EVERY shipped dialect — including
 * the monochrome ones — `caution` stays in the red family and `success` stays
 * in the green family. A dialect may re-cut depth, wash strength, and register,
 * but it may not remap the meaning of danger and safety onto another hue.
 *
 * The gate resolves each dialect's caution/success channels through the actual
 * scale values in scales.css (following `var()` refs and evaluating the
 * `color-mix(in srgb, …)` expressions the dialect files use), converts the
 * resolved color to OKLCH, and asserts hue-family membership. Wash/mix channels
 * with near-neutral chroma cannot carry a hue and are exempt via the chroma
 * floor — but the text-bearing channels (`on`, `ink`) always carry enough
 * chroma to be asserted.
 *
 * The hue bands are tuned to the shipped ramps (see the constants below), not
 * to an abstract color wheel: the red family's mixes drift warm over paper and
 * the green family's deep steps sit near hue 150.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DIALECT_IDS, DIALECTS } from "./registry.js";
import type { Dialect } from "./types.js";

/* ------------------------------------------------------------------------- *
 * Scale resolution: scales.css literals -> sRGB
 * ------------------------------------------------------------------------- */

type Rgba = { r: number; g: number; b: number; a: number };

const scalesCss = readFileSync(
	fileURLToPath(new URL("../tokens/scales.css", import.meta.url)),
	"utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const SCALES = new Map<string, string>();
for (const m of scalesCss.matchAll(/(--mo-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
	SCALES.set(m[1] as string, (m[2] as string).trim());
}

function hexToRgba(hex: string): Rgba {
	const h = hex.replace("#", "");
	const full =
		h.length === 3
			? h
					.split("")
					.map((x) => x + x)
					.join("")
			: h;
	return {
		r: Number.parseInt(full.slice(0, 2), 16),
		g: Number.parseInt(full.slice(2, 4), 16),
		b: Number.parseInt(full.slice(4, 6), 16),
		a: 1,
	};
}

function oklchLiteralToRgba(value: string): Rgba {
	const m = value.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
	if (!m) throw new Error(`unparsable oklch literal: ${value}`);
	const L =
		m[2] === "%" ? Number.parseFloat(m[1] as string) / 100 : Number.parseFloat(m[1] as string);
	const C = Number.parseFloat(m[3] as string);
	const H = Number.parseFloat(m[4] as string);
	const hr = (H * Math.PI) / 180;
	const a = C * Math.cos(hr);
	const b = C * Math.sin(hr);
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;
	const l3 = l_ ** 3;
	const m3 = m_ ** 3;
	const s3 = s_ ** 3;
	const lin = {
		r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
		g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
		b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
	};
	const toByte = (v: number): number => {
		const c = Math.min(1, Math.max(0, v));
		const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
		return Math.round(srgb * 255);
	};
	return { r: toByte(lin.r), g: toByte(lin.g), b: toByte(lin.b), a: 1 };
}

/** Split a function-argument list on top-level commas. */
function splitArgs(inner: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = "";
	for (const ch of inner) {
		if (ch === "(") depth++;
		if (ch === ")") depth--;
		if (ch === "," && depth === 0) {
			out.push(cur.trim());
			cur = "";
		} else {
			cur += ch;
		}
	}
	if (cur.trim()) out.push(cur.trim());
	return out;
}

/** Resolve a dialect channel value (var refs, color-mix, transparent) to sRGB. */
function resolve(value: string): Rgba {
	const v = value.trim();
	if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
	const varRef = v.match(/^var\((--mo-[a-z0-9-]+)\)$/);
	if (varRef) {
		const target = SCALES.get(varRef[1] as string);
		if (target === undefined) throw new Error(`unknown scale var: ${varRef[1]}`);
		return resolve(target);
	}
	if (v.startsWith("color-mix(")) {
		const inner = v.slice("color-mix(".length, -1);
		const [space, ...colorArgs] = splitArgs(inner);
		if (!/^in srgb$/.test((space ?? "").trim())) {
			throw new Error(`only color-mix(in srgb, …) is used by dialects: ${v}`);
		}
		if (colorArgs.length !== 2) throw new Error(`color-mix arity: ${v}`);
		const parts = colorArgs.map((arg) => {
			const m = arg.match(/^(.*?)(?:\s+([\d.]+)%)?$/s);
			return {
				color: resolve((m?.[1] ?? arg).trim()),
				pct: m?.[2] ? Number.parseFloat(m[2]) : null,
			};
		}) as [{ color: Rgba; pct: number | null }, { color: Rgba; pct: number | null }];
		let w1 = parts[0].pct;
		let w2 = parts[1].pct;
		if (w1 === null && w2 === null) {
			w1 = 50;
			w2 = 50;
		} else if (w1 === null) {
			w1 = 100 - (w2 as number);
		} else if (w2 === null) {
			w2 = 100 - w1;
		}
		const total = (w1 as number) + (w2 as number);
		const f1 = (w1 as number) / total;
		const f2 = (w2 as number) / total;
		// CSS color-mix premultiplied-alpha interpolation in srgb.
		const a = parts[0].color.a * f1 + parts[1].color.a * f2;
		const pm = (ch: "r" | "g" | "b"): number =>
			a === 0
				? 0
				: (parts[0].color[ch] * parts[0].color.a * f1 +
						parts[1].color[ch] * parts[1].color.a * f2) /
					a;
		return { r: pm("r"), g: pm("g"), b: pm("b"), a };
	}
	if (v.startsWith("#")) return hexToRgba(v);
	if (v.startsWith("oklch(")) return oklchLiteralToRgba(v);
	throw new Error(`unresolvable channel value: ${v}`);
}

/** Composite a translucent resolved color over the dialect's base surface. */
function overBase(color: Rgba, dialect: Dialect): Rgba {
	if (color.a >= 1) return color;
	const base = resolve(dialect.surfaces?.["--mo-intent-surface-base"] ?? "#000000");
	const blend = (fg: number, bg: number): number => fg * color.a + bg * (1 - color.a);
	return {
		r: blend(color.r, base.r),
		g: blend(color.g, base.g),
		b: blend(color.b, base.b),
		a: 1,
	};
}

/* ------------------------------------------------------------------------- *
 * sRGB -> OKLCH
 * ------------------------------------------------------------------------- */

function rgbaToOklch(c: Rgba): { L: number; C: number; H: number } {
	const lin = (byte: number): number => {
		const x = byte / 255;
		return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
	};
	const r = lin(c.r);
	const g = lin(c.g);
	const b = lin(c.b);
	const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
	const l_ = Math.cbrt(l);
	const m_ = Math.cbrt(m);
	const s_ = Math.cbrt(s);
	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	const C = Math.hypot(A, B);
	let H = (Math.atan2(B, A) * 180) / Math.PI;
	if (H < 0) H += 360;
	return { L, C, H };
}

/* ------------------------------------------------------------------------- *
 * The gate
 * ------------------------------------------------------------------------- */

/**
 * Hue bands tuned to the shipped ramps (OKLCH hue, degrees): the red family's
 * scale steps sit at ~23–28° and its paper washes drift warm; the green
 * family's steps sit at ~148–153°. A remap onto blue/violet/teal/amber lands
 * far outside either band.
 */
const RED_BAND: readonly [number, number] = [0, 60];
const GREEN_BAND: readonly [number, number] = [110, 170];

/**
 * Below this chroma a color is effectively neutral (a deep wash or a
 * disabled/ghost state) and carries no hue signal to assert. The text-bearing
 * channels stay far above it under every shipped dialect.
 */
const CHROMA_FLOOR = 0.02;

/** The channels a functional intent must keep in-family. */
const ASSERTED_CHANNELS = ["surface", "on", "ink", "ink-hover", "border", "ring"] as const;
/** The channels that must always carry an assertable hue (text/ink bearing). */
const HUE_MANDATORY = new Set(["on", "ink", "ink-hover"]);

const CASES = [
	{ intent: "caution", band: RED_BAND, family: "red" },
	{ intent: "success", band: GREEN_BAND, family: "green" },
] as const;

function inBand(h: number, [lo, hi]: readonly [number, number]): boolean {
	return h >= lo && h <= hi;
}

describe("functional color is never a mood (KRA-825 gate 3)", () => {
	for (const id of DIALECT_IDS) {
		const dialect = DIALECTS[id] as Dialect;
		for (const { intent, band, family } of CASES) {
			it(`${id}: ${intent} stays in the ${family} hue family`, () => {
				const def = dialect.intents[intent];
				expect(def, `${id} missing ${intent}`).toBeDefined();
				for (const channel of ASSERTED_CHANNELS) {
					const raw = def?.[channel];
					expect(raw, `${id}.${intent}.${channel}`).toBeTypeOf("string");
					const resolved = overBase(resolve(raw as string), dialect);
					const { C, H } = rgbaToOklch(resolved);
					if (HUE_MANDATORY.has(channel)) {
						expect(
							C,
							`${id}.${intent}.${channel} (${raw}) is near-neutral — a text channel must carry the family hue`,
						).toBeGreaterThanOrEqual(CHROMA_FLOOR);
					}
					if (C >= CHROMA_FLOOR) {
						expect(
							inBand(H, band),
							`${id}.${intent}.${channel} (${raw}) resolves to hue ${H.toFixed(1)}° C=${C.toFixed(3)} — outside the ${family} band [${band[0]}°, ${band[1]}°]`,
						).toBe(true);
					}
				}
			});
		}
	}
});

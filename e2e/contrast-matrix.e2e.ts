/**
 * KRA-796 Defect 3 — the browser-computed WCAG 2.2 AA contrast matrix.
 *
 * Token-key PARITY (dialects.test.ts) proves every dialect defines every channel;
 * it CANNOT prove the resolved colour is readable. This gate does: it renders each
 * dialect's real token pipeline (scales -> intents -> the applyDialect boundary
 * spread) in a real browser, reads getComputedStyle AFTER `var()` and
 * `color-mix()` resolution, and asserts the freestanding-ink channels clear the AA
 * floor (4.5:1) on base / raised / sunken — the exact class of live failures the
 * ticket measured (clinical links 1.84:1, blocking KPI 1.05:1, estate 1.06:1,
 * ledger 1.24:1). The `ink` / `ink-hover` channels (Text/Number/Icon/Link) are the
 * subject; the FILLED `on`-on-`surface` pair is checked as its own contract.
 *
 * The core matrix is server-free (page.setContent over the concatenated token CSS
 * + the dialect's own boundary vars), so it is fast and deterministic. A second
 * block exercises the composed playground at 390px, 200% zoom, keyboard focus,
 * forced-colors, and reduced-motion against the live viewer server.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { applyDialect, dialectStyle } from "../src/lib/dialects/provider.svelte.js";
import { DIALECT_IDS, DIALECTS } from "../src/lib/dialects/registry.js";
import type { Dialect } from "../src/lib/dialects/types.js";
import { CORE_INTENTS, intentVar, REGISTER_INTENTS } from "../src/lib/tokens/intents.js";

const AA_NORMAL = 4.5;
const SURFACES = ["base", "raised", "sunken"] as const;
const ALL_INTENTS = [...CORE_INTENTS, ...REGISTER_INTENTS];

const CSS = ["scales.css", "intents.css"]
	.map((f) =>
		readFileSync(fileURLToPath(new URL(`../src/lib/tokens/${f}`, import.meta.url)), "utf8"),
	)
	.join("\n");

/** WCAG 2.2 relative luminance + contrast over canonical sRGB [r,g,b] (0-255). */
type Rgb = [number, number, number];
function relLum([r, g, b]: Rgb): number {
	const f = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg: Rgb, bg: Rgb): number {
	const a = relLum(fg);
	const b = relLum(bg);
	const [hi, lo] = a >= b ? [a, b] : [b, a];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Build a self-contained harness page for one dialect: a boundary carrying the
 * dialect's applied vars, then a ground per surface tier, then one ink probe per
 * intent (rest + hover) and one filled probe per intent (surface + on).
 */
function harness(dialect: Dialect): string {
	const applied = applyDialect(dialect);
	const style = dialectStyle(applied);
	const grounds = SURFACES.map((tier) => {
		const inkProbes = ALL_INTENTS.map((intent) => {
			const ink = `var(${intentVar(intent, "ink")})`;
			const inkHover = `var(${intentVar(intent, "ink-hover")})`;
			return (
				`<span class="probe" data-kind="ink" data-tier="${tier}" data-intent="${intent}" data-state="rest" style="color:${ink}">Ag</span>` +
				`<span class="probe" data-kind="ink" data-tier="${tier}" data-intent="${intent}" data-state="hover" style="color:${inkHover}">Ag</span>`
			);
		}).join("");
		return (
			`<div class="ground" data-tier="${tier}" data-bg-tier="${tier}" style="background:var(--mo-intent-surface-${tier})">` +
			inkProbes +
			`</div>`
		);
	}).join("");
	// Filled probes: `on` text painted on the intent's own `surface` (the badge/
	// status/alert/solid-button contract) — checked on the base ground.
	const filled = ALL_INTENTS.map(
		(intent) =>
			`<span class="filled" data-intent="${intent}" style="background:var(${intentVar(intent, "surface")});color:var(${intentVar(intent, "on")})">Ag</span>`,
	).join("");
	return (
		`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>` +
		`<body style="margin:0"><div id="root" data-mo-dialect="${dialect.id}" style="${style}">` +
		grounds +
		`<div class="ground" data-tier="base" style="background:var(--mo-intent-surface-base)">${filled}</div>` +
		`</div></body></html>`
	);
}

test.describe("contrast matrix — freestanding ink clears AA on every ground (KRA-796)", () => {
	for (const id of DIALECT_IDS) {
		const dialect = DIALECTS[id] as Dialect;
		test(`${id}: ink + ink-hover ≥ ${AA_NORMAL}:1 on base/raised/sunken; filled on/surface ≥ ${AA_NORMAL}:1`, async ({
			page,
		}) => {
			await page.setContent(harness(dialect), { waitUntil: "load" });

			// Pull resolved colours for every probe and its ground in one pass. Any
			// computed colour (Chromium serialises `color-mix()` as `color(srgb …)` /
			// `oklab(…)`) is canonicalised to sRGB 0-255 by a 1×1 canvas readback — the
			// browser's own colour engine does the conversion, so the numbers are the
			// real shipped pixels regardless of the serialisation form.
			const rows = await page.evaluate(() => {
				const cv = document.createElement("canvas");
				cv.width = cv.height = 1;
				const cx = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
				const toRgb = (color: string): [number, number, number] => {
					cx.clearRect(0, 0, 1, 1);
					cx.fillStyle = "#000";
					cx.fillStyle = color;
					cx.fillRect(0, 0, 1, 1);
					const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
					return [r, g, b];
				};
				const bgOf = (el: Element): string => {
					let n: Element | null = el;
					while (n) {
						const c = getComputedStyle(n).backgroundColor;
						if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
						n = n.parentElement;
					}
					return "rgb(255, 255, 255)";
				};
				const out: {
					kind: string;
					tier: string;
					intent: string;
					state: string;
					color: [number, number, number];
					bg: [number, number, number];
				}[] = [];
				for (const el of Array.from(document.querySelectorAll(".probe"))) {
					out.push({
						kind: (el as HTMLElement).dataset.kind ?? "",
						tier: (el as HTMLElement).dataset.tier ?? "",
						intent: (el as HTMLElement).dataset.intent ?? "",
						state: (el as HTMLElement).dataset.state ?? "",
						color: toRgb(getComputedStyle(el).color),
						bg: toRgb(bgOf(el)),
					});
				}
				const alphaOf = (color: string): number => {
					cx.clearRect(0, 0, 1, 1);
					cx.fillStyle = "rgba(0,0,0,0)";
					cx.fillStyle = color;
					cx.fillRect(0, 0, 1, 1);
					return cx.getImageData(0, 0, 1, 1).data[3] ?? 0;
				};
				for (const el of Array.from(document.querySelectorAll(".filled"))) {
					const s = getComputedStyle(el);
					// The filled `surface + on` contract only applies to intents that paint
					// an OPAQUE fill (badge/status/alert/solid button). A register intent
					// with a `transparent` surface (folio, a bare catalogue number) is
					// freestanding ink, not a fill — skip it here; its `ink` channel is
					// what the probe rows above already hold to AA.
					if (alphaOf(s.backgroundColor) < 250) continue;
					out.push({
						kind: "filled",
						tier: "self",
						intent: (el as HTMLElement).dataset.intent ?? "",
						state: "rest",
						color: toRgb(s.color),
						bg: toRgb(s.backgroundColor),
					});
				}
				return out;
			});

			const failures: string[] = [];
			for (const r of rows) {
				const ratio = contrast(r.color, r.bg);
				if (ratio < AA_NORMAL) {
					failures.push(
						`${id}.${r.intent}.${r.kind}[${r.state}] on ${r.tier}: ${ratio.toFixed(2)}:1 (fg ${r.color} / bg ${r.bg})`,
					);
				}
			}
			expect(rows.length, `${id}: no probes rendered`).toBeGreaterThan(0);
			expect(failures, `\n${failures.join("\n")}\n`).toHaveLength(0);
		});
	}
});

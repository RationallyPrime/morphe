/**
 * A dialect: 'foundry' — the industrial/quality register.
 *
 * The machined, blueprint reading of the SAME core intents. The vertical
 * vocabulary (quality-gate / spec-blue / lot-grey) lives ONLY here, at the
 * intent layer, mapped onto the NEUTRAL scales. The scale names stay
 * vertical-neutral; the vertical vocabulary is an injection (Lemma 4).
 *
 * Selecting this dialect re-themes the page WITHOUT changing one authored node —
 * the on-screen proof of the fixed point (Lemma 3). Foundry is pulled apart from
 * its sibling dialects at the loudest signals (the §8 beacon + surface
 * differentiation): where the Archive reads warm (AMBER beacon), the Clinical a
 * cold periwinkle, the Registry an AMETHYST violet, and the cobalt default an
 * electric blue, the Foundry reads STEEL — a muted, greyed-blue quality beacon on
 * a substrate cooled toward steel-700 (a deep steel navy) — with spec-blue
 * retained only for the reference intents (provenance/info) and shop-floor red
 * caution. Values are scale vars only — never hex — keeping the vertical out of
 * the scale layer.
 *
 * PARITY (CONTRACT §8 fixed point): this is a globally-shipped, globally-
 * selectable dialect, so it MUST meet the same channel/intent/surface bar the
 * other shipped dialects meet — otherwise everything it omits falls through the
 * cascade to the `:root` (warm Archive) block and selecting it yields a PARTIAL
 * re-theme. So, exactly as the siblings do:
 *   - it defines all EIGHT core intents (incl. `evidence`, the record register);
 *   - every intent carries all SEVEN channels (surface/on/hover/border/ring +
 *     the action `active`/`disabled` pressed/disabled states);
 *   - it contributes the SAME register extensions the others do (folio /
 *     marginalia / seal), re-read for a quality record;
 *   - it ships a surface stack (FOUNDRY_SURFACES) so the page substrate cools to
 *     the blueprint reading too, instead of staying Archive-warm.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import { DIALECT_COMPOUND_CONSTRAINTS } from "./constraints.generated.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The Foundry surface stack — a cool blueprint substrate. Still tonal layering
 * (no shadows), still pure neutral-scale references; the cool steel cast comes
 * from mixing a touch of steel-700 (the deep steel navy) into the neutral steps.
 * ------------------------------------------------------------------------- */

export const FOUNDRY_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-neutral-1) 90%, var(--mo-steel-700))",
	"--mo-intent-surface-raised": "color-mix(in srgb, var(--mo-neutral-4) 88%, var(--mo-steel-700))",
	"--mo-intent-surface-sunken": "var(--mo-neutral-0)",
	// Overlay panel — top tonal tier, cooled toward the steel quality accent.
	"--mo-intent-surface-overlay": "color-mix(in srgb, var(--mo-neutral-6) 88%, var(--mo-steel-700))",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	// Muted on-surface raised to 74% (matching the Archive's AA fix): at 62% it dipped
	// under 4.5:1 on the highest raised tier. 74% clears AA on every tier while staying
	// visibly quieter than full on-surface.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 74%, transparent)",
	// A crisper outline than the Archive's warm ghost, toned to the steel accent —
	// a blueprint wants visible structure in its own colour.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-neutral-8) 64%, var(--mo-steel-600))",
	// A denser scrim — a quality-control console dims the field harder.
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 68%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, re-read for an industrial/quality register. Same eight names;
 * cool, spec-led mapping. Every intent carries all seven channels (incl. the
 * action active/disabled states) so the fixed point holds and no pressed/disabled
 * state falls through to the warm Archive defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/**
	 * primary-action: the STEEL beacon — the quality-gate accent. This is the
	 * differentiator: where the Archive's beacon is warm amber, the Clinical a
	 * cold periwinkle, and the Registry a distinct violet, the Foundry's is a
	 * muted greyed-blue steel, so flipping the dialect re-reads the page's single
	 * loudest signal into a wholly different hue. A bright 500 fill, dark text.
	 */
	"primary-action": {
		surface: "var(--mo-steel-500)",
		on: "var(--mo-steel-on)",
		hover: "var(--mo-steel-400)",
		border: "var(--mo-steel-600)",
		ring: "var(--mo-steel-500)",
		active: "var(--mo-steel-600)",
		disabled: "color-mix(in srgb, var(--mo-steel-500) 38%, var(--mo-neutral-3))",
		ink: "var(--mo-steel-300)",
		"ink-hover": "var(--mo-steel-400)",
	},
	/** neutral: cooler chrome than the warm Archive neutral. */
	neutral: {
		surface: "var(--mo-neutral-3)",
		on: "var(--mo-neutral-11)",
		hover: "var(--mo-neutral-4)",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-blue-500)",
		active: "var(--mo-neutral-5)",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 50%, var(--mo-neutral-2))",
		ink: "var(--mo-neutral-11)",
		"ink-hover": "var(--mo-neutral-9)",
	},
	/** provenance: spec-blue, forward (the lineage of a part/lot). */
	provenance: {
		surface: "var(--mo-blue-700)",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 85%, var(--mo-blue-300))",
		border: "var(--mo-blue-400)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 78%, var(--mo-blue-400))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 40%, var(--mo-neutral-3))",
		ink: "var(--mo-blue-300)",
		"ink-hover": "var(--mo-blue-400)",
	},
	/**
	 * evidence: the record register — near-neutral but cooled toward the steel
	 * substrate, so an authored `intent: "evidence"` resolves to the foundry's own
	 * measurement tone here instead of falling through to the warm Archive evidence.
	 */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-neutral-3) 86%, var(--mo-steel-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-4) 86%, var(--mo-steel-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-steel-400)",
		active: "color-mix(in srgb, var(--mo-neutral-5) 86%, var(--mo-steel-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 58%, var(--mo-neutral-1))",
		ink: "var(--mo-neutral-11)",
		"ink-hover": "var(--mo-neutral-9)",
	},
	/** accession: the catalog accent echoes the steel beacon (a lot/part stamp). */
	accession: {
		surface: "color-mix(in srgb, var(--mo-steel-700) 42%, var(--mo-neutral-3))",
		on: "var(--mo-steel-300)",
		hover: "color-mix(in srgb, var(--mo-steel-700) 54%, var(--mo-neutral-3))",
		border: "var(--mo-steel-600)",
		ring: "var(--mo-steel-500)",
		active: "color-mix(in srgb, var(--mo-steel-700) 62%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-steel-700) 18%, var(--mo-neutral-3))",
		ink: "var(--mo-steel-300)",
		"ink-hover": "var(--mo-steel-400)",
	},
	/** caution: shop-floor red — a louder fault/reject red. */
	caution: {
		surface: "var(--mo-red-700)",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 82%, var(--mo-red-300))",
		border: "var(--mo-red-500)",
		ring: "var(--mo-red-500)",
		active: "color-mix(in srgb, var(--mo-red-700) 74%, var(--mo-red-400))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-neutral-3))",
		ink: "var(--mo-red-300)",
		"ink-hover": "var(--mo-red-400)",
	},
	/** success: keep green, slightly cooler (a passed/within-spec state). */
	success: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 84%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 74%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-3))",
		ink: "var(--mo-green-400)",
		"ink-hover": "var(--mo-green-500)",
	},
	/** info: blue family, brighter (an open work-order note). */
	info: {
		surface: "color-mix(in srgb, var(--mo-blue-700) 60%, var(--mo-neutral-2))",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 72%, var(--mo-neutral-2))",
		border: "var(--mo-blue-400)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 80%, var(--mo-neutral-2))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 36%, var(--mo-neutral-3))",
		ink: "var(--mo-blue-300)",
		"ink-hover": "var(--mo-blue-400)",
	},
};

/* ------------------------------------------------------------------------- *
 * The SAME register-extension names the Archive and Clinical contribute, re-read
 * for a quality record. Identical NAMES (so an authored `intent: "seal"` keeps
 * resolving), different scale mapping — the fixed-point demonstration at the
 * extension tier. Without these, an authored `intent: "folio"` would fall through
 * to the warm Archive register while the rest of the page reads cool.
 * ------------------------------------------------------------------------- */

const FOUNDRY_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → lot/serial-number register: a steel-toned mono label. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-steel-300) 72%, transparent)",
		hover: "color-mix(in srgb, var(--mo-neutral-2) 82%, var(--mo-steel-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 50%, transparent)",
		ring: "var(--mo-steel-400)",
		active: "color-mix(in srgb, var(--mo-neutral-3) 82%, var(--mo-steel-700))",
		disabled: "transparent",
		ink: "var(--mo-steel-400)",
		"ink-hover": "var(--mo-steel-300)",
	},
	/** Marginalia → annotation/aside register: a steel-toned aside. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 72%, var(--mo-steel-700))",
		on: "var(--mo-neutral-10)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 72%, var(--mo-steel-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-steel-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 72%, var(--mo-steel-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 42%, var(--mo-neutral-2))",
		ink: "var(--mo-neutral-10)",
		"ink-hover": "var(--mo-neutral-9)",
	},
	/**
	 * Seal → the inspector's sign-off / quality-approval mark. The Foundry's
	 * authority mark is a deliberate STEEL stamp — the greyed-blue counterpart of
	 * the Archive's grave amber seal and the Clinical green sign-off, same name,
	 * same slot, its own hue.
	 */
	seal: {
		surface: "var(--mo-steel-700)",
		on: "var(--mo-steel-300)",
		hover: "color-mix(in srgb, var(--mo-steel-700) 82%, var(--mo-steel-300))",
		border: "var(--mo-steel-600)",
		ring: "var(--mo-steel-400)",
		active: "color-mix(in srgb, var(--mo-steel-700) 70%, var(--mo-steel-300))",
		disabled: "color-mix(in srgb, var(--mo-steel-700) 40%, var(--mo-neutral-3))",
		ink: "var(--mo-steel-300)",
		"ink-hover": "var(--mo-steel-400)",
	},
};

export const foundry: Dialect = {
	id: "foundry",
	label: "Foundry",
	persona: { vertical: "industrial", role: "quality" },
	intents: {
		...CORE,
		...FOUNDRY_REGISTER,
	},
	surfaces: FOUNDRY_SURFACES,
	// A quality prior: exception-led, slightly denser, a marginally tighter top
	// tier than the editorial Archive. Clamped by the provider so Lemma 2 holds.
	priors: {
		rootDensity: "compact",
		rootScaleTier: 3,
		rootBudget: 3,
	},
	// Explicit unrestricted compatibility policy, generated from the catalog authority.
	compounds: DIALECT_COMPOUND_CONSTRAINTS.foundry.compounds,
};

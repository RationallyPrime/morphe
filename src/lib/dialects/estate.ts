/**
 * A roll-up/platform dialect: 'estate' — the operator register.
 *
 * Estate is the platform reading of the SAME core intents: one operating map laid
 * across a portfolio of acquired holdings, read by an operator (not an editor, not
 * a registrar). Its vertical vocabulary — the holdings accent, the consolidated
 * folio, the operator's stamp — lives ONLY here, at the intent layer, mapped onto
 * the NEUTRAL scales plus the single identity hue. The scale names stay
 * vertical-neutral; the platform vocabulary is an injection (Lemma 4).
 *
 * Selecting this dialect re-themes the page WITHOUT changing one authored node —
 * the on-screen proof of the fixed point (Lemma 3). Where the Registry reads
 * AMETHYST (a violet amendment beacon on a faintly violet-cooled substrate),
 * Estate reads COPPER — a warm bronze holdings beacon on a substrate that warms
 * toward a deep copper-brown — with citation-blue retained only for the lineage
 * intents (provenance/info) and red caution. Values are scale vars only — never
 * hex — keeping the vertical out of the scale layer.
 *
 * PARITY (CONTRACT §8 fixed point): this is a globally-shipped, globally-
 * selectable dialect, so it MUST meet the same channel/intent/surface bar the
 * other shipped dialects meet — otherwise everything it omits falls through
 * the cascade to the `:root` (default) block and selecting it yields a
 * PARTIAL re-theme. So, exactly as the Registry does:
 *   - it defines all EIGHT core intents (incl. `evidence`, the record register);
 *   - every intent carries all SEVEN channels (surface/on/hover/border/ring +
 *     the action `active`/`disabled` pressed/disabled states);
 *   - it contributes the SAME register extensions the others do (folio /
 *     marginalia / seal), re-read for an operating estate;
 *   - it ships a surface stack (ESTATE_SURFACES) so the page substrate warms
 *     to the holdings reading too, instead of staying default-cool.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import { DIALECT_COMPOUND_CONSTRAINTS } from "./constraints.generated.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The Estate surface stack — a warm holdings substrate. Still tonal layering
 * (no shadows), still pure neutral-scale references; the warm cast comes from
 * mixing a touch of copper-700 (the deep estate brown) into the neutral steps.
 * ------------------------------------------------------------------------- */

export const ESTATE_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-neutral-1) 90%, var(--mo-copper-700))",
	"--mo-intent-surface-raised": "color-mix(in srgb, var(--mo-neutral-4) 88%, var(--mo-copper-700))",
	"--mo-intent-surface-sunken": "var(--mo-neutral-0)",
	// Overlay panel — top tonal tier, warmed toward the copper holdings accent.
	"--mo-intent-surface-overlay":
		"color-mix(in srgb, var(--mo-neutral-6) 88%, var(--mo-copper-700))",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	// Muted on-surface raised to 74% (matching the AA fix the other dark dialects
	// carry): at 62% it dipped under 4.5:1 on the highest raised tier. 74% clears AA
	// on every tier while staying visibly quieter than full on-surface.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 74%, transparent)",
	// A crisper outline than a soft ghost, toned to the copper accent — an operating
	// map wants visible structure in its own colour.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-neutral-8) 64%, var(--mo-copper-600))",
	// A denser scrim — an operator's console dims the field harder.
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 68%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, re-read for a roll-up/platform register. Same eight names; warm,
 * copper-led mapping. Every intent carries all seven channels (incl. the
 * action active/disabled states) so the fixed point holds and no pressed/disabled
 * state falls through to the default defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/**
	 * primary-action: the COPPER beacon — the operator's holdings accent. This
	 * is the differentiator: where the Registry's beacon is a cool violet and the
	 * default beacon an electric cobalt, Estate's is a warm bronze, so flipping the
	 * dialect re-reads the page's single loudest signal into a wholly different hue.
	 * A bright 500 fill, dark text.
	 */
	"primary-action": {
		surface: "var(--mo-copper-500)",
		on: "var(--mo-copper-on)",
		hover: "var(--mo-copper-400)",
		border: "var(--mo-copper-600)",
		ring: "var(--mo-copper-500)",
		active: "var(--mo-copper-600)",
		disabled: "color-mix(in srgb, var(--mo-copper-500) 38%, var(--mo-neutral-3))",
		ink: "var(--mo-copper-300)",
		"ink-hover": "var(--mo-copper-400)",
	},
	/** neutral: warm chrome, in keeping with the copper substrate. */
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
	/** provenance: citation-blue, forward (the lineage of a holding). */
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
	 * evidence: the record register — near-neutral but warmed toward the copper
	 * substrate, so an authored `intent: "evidence"` resolves to the estate's own
	 * record tone here instead of falling through to the default evidence.
	 */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-neutral-3) 86%, var(--mo-copper-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-4) 86%, var(--mo-copper-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-copper-400)",
		active: "color-mix(in srgb, var(--mo-neutral-5) 86%, var(--mo-copper-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 58%, var(--mo-neutral-1))",
		ink: "var(--mo-neutral-11)",
		"ink-hover": "var(--mo-neutral-9)",
	},
	/** accession: the catalog accent echoes the copper beacon (a holdings folio). */
	accession: {
		surface: "color-mix(in srgb, var(--mo-copper-700) 42%, var(--mo-neutral-3))",
		on: "var(--mo-copper-300)",
		hover: "color-mix(in srgb, var(--mo-copper-700) 54%, var(--mo-neutral-3))",
		border: "var(--mo-copper-600)",
		ring: "var(--mo-copper-500)",
		active: "color-mix(in srgb, var(--mo-copper-700) 62%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-copper-700) 18%, var(--mo-neutral-3))",
		ink: "var(--mo-copper-300)",
		"ink-hover": "var(--mo-copper-400)",
	},
	/** caution: red — a clear operating-risk red. */
	caution: {
		surface: "color-mix(in srgb, var(--mo-red-700) 30%, var(--mo-neutral-2))",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-neutral-2))",
		border: "var(--mo-red-500)",
		ring: "var(--mo-red-500)",
		active: "color-mix(in srgb, var(--mo-red-700) 48%, var(--mo-neutral-2))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 16%, var(--mo-neutral-3))",
		ink: "var(--mo-red-300)",
		"ink-hover": "var(--mo-red-400)",
	},
	/** success: keep green (an affirmed/closed state across the portfolio). */
	success: {
		surface: "color-mix(in srgb, var(--mo-green-700) 30%, var(--mo-neutral-2))",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-2))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 48%, var(--mo-neutral-2))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 16%, var(--mo-neutral-3))",
		ink: "var(--mo-green-400)",
		"ink-hover": "var(--mo-green-500)",
	},
	/** info: blue family, brighter (an open operating note). */
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
 * The SAME register-extension names the other dialects contribute, re-read for
 * an operating estate. Identical NAMES (so an authored `intent: "seal"` keeps
 * resolving), different scale mapping — the fixed-point demonstration at the
 * extension tier. Without these, an authored `intent: "folio"` would fall through
 * to the default register while the rest of the page reads warm.
 * ------------------------------------------------------------------------- */

const ESTATE_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → holding/asset-id register: a copper-toned mono label. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-copper-300) 72%, transparent)",
		hover: "color-mix(in srgb, var(--mo-neutral-2) 82%, var(--mo-copper-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 50%, transparent)",
		ring: "var(--mo-copper-400)",
		active: "color-mix(in srgb, var(--mo-neutral-3) 82%, var(--mo-copper-700))",
		disabled: "transparent",
		ink: "var(--mo-copper-400)",
		"ink-hover": "var(--mo-copper-300)",
	},
	/** Marginalia → annotation/aside register: a copper-toned aside. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 72%, var(--mo-copper-700))",
		on: "var(--mo-neutral-10)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 72%, var(--mo-copper-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-copper-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 72%, var(--mo-copper-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 42%, var(--mo-neutral-2))",
		ink: "var(--mo-neutral-10)",
		"ink-hover": "var(--mo-neutral-9)",
	},
	/**
	 * Seal → the operator's stamp / authority mark. The Estate's authority mark
	 * is a deliberate COPPER stamp — the bronze counterpart of the Registry's
	 * amethyst seal, same name, same slot, its own hue.
	 */
	seal: {
		surface: "var(--mo-copper-700)",
		on: "var(--mo-copper-300)",
		hover: "color-mix(in srgb, var(--mo-copper-700) 82%, var(--mo-copper-300))",
		border: "var(--mo-copper-600)",
		ring: "var(--mo-copper-400)",
		active: "color-mix(in srgb, var(--mo-copper-700) 70%, var(--mo-copper-300))",
		disabled: "color-mix(in srgb, var(--mo-copper-700) 40%, var(--mo-neutral-3))",
		ink: "var(--mo-copper-300)",
		"ink-hover": "var(--mo-copper-400)",
	},
};

export const estate: Dialect = {
	id: "estate",
	label: "Estate",
	gloss: "A warm copper register for portfolio-wide operational oversight.",
	persona: { vertical: "platform", role: "operator" },
	intents: {
		...CORE,
		...ESTATE_REGISTER,
	},
	surfaces: ESTATE_SURFACES,
	// An operator prior: exception-led, slightly denser, a marginally tighter top
	// tier than an editorial register. Clamped by the provider so Lemma 2 holds.
	priors: {
		rootDensity: "compact",
		rootScaleTier: 3,
		rootBudget: 3,
	},
	// Explicit unrestricted compatibility policy, generated from the catalog authority.
	compounds: DIALECT_COMPOUND_CONSTRAINTS.estate.compounds,
};

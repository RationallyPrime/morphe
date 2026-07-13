/**
 * A SIXTH dialect: 'night' — the immersive ground (ADR-0005, D6).
 *
 * The other half of the plate-derived pair (`gallery` is the wall; this is
 * the inside of the appliance). Where the gallery stages the plates against a
 * calm paper ground, night steps INTO them: the page surfaces are the plates'
 * own blue-black strata, the text is the ice white of their hot cores, and
 * cobalt is the luminous primary. A plate on a night page has no frame
 * boundary at all — the artwork and the page share one darkness.
 *
 * Night vs. Timaeus (both dark, not the same thing): Timaeus COOLS the warm
 * Archive neutrals toward the lattice navy — a graphite room with blue cast.
 * Night abandons the neutral ramp's grounds entirely and stands on the
 * cobalt ramp's own dark extremes (`--mo-cobalt-900/950`, the strata sampled
 * from the plates) — the plates' actual ground, not a tinted neutral. One
 * hue, many depths, all the way down.
 *
 *   - The beacon is the LATTICE LIGHT: the bright electric 500 with
 *     near-black navy text, the same scarcity discipline as ever.
 *   - GROUNDS are the strata themselves: base just above the 950 floor,
 *     raised on the 900 stratum, the sunken well ON the floor, the overlay
 *     lifted toward the lattice navy.
 *   - Only the FUNCTIONAL pair (caution/success) keeps its red/green
 *     families — functional color is never sacrificed to a mood.
 *
 * PARITY (CONTRACT §8 fixed point): globally shipped and globally selectable,
 * so it meets the same bar as the other shipped dialects — all EIGHT core
 * intents, all SEVEN channels each, the same register extensions
 * (folio/marginalia/seal), and a full surface stack.
 *
 * THE DISCIPLINE (Lemma 3): every value below references a NEUTRAL scale var
 * (`--mo-cobalt-*`, `--mo-red-*`, `--mo-green-*`) or a `color-mix` of them.
 * The strata are the `--mo-cobalt-800/900/950` steps minted in scales.css —
 * raw vertical-neutral extremes of the existing cobalt band; "night" exists
 * ONLY here, at the intent layer.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import { DIALECT_COMPOUND_CONSTRAINTS } from "./constraints.generated.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The night surface stack — the plates' strata as tonal layering (no
 * shadows). The sunken well sits ON the 950 floor; base floats a hair above
 * it so wells still read recessed at the bottom of the ramp.
 * ------------------------------------------------------------------------- */

export const NIGHT_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-cobalt-950) 72%, var(--mo-cobalt-900))",
	"--mo-intent-surface-raised": "var(--mo-cobalt-900)",
	"--mo-intent-surface-sunken": "var(--mo-cobalt-950)",
	// Overlay panel — the top tonal tier, lifted toward the lattice navy.
	"--mo-intent-surface-overlay":
		"color-mix(in srgb, var(--mo-cobalt-900) 80%, var(--mo-cobalt-700))",
	"--mo-intent-on-surface": "var(--mo-cobalt-100)",
	// Muted ice at 72%: composites ≈8.5:1 on the raised stratum — quieter than
	// full ice, still far clear of AA on every tier.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-cobalt-100) 72%, transparent)",
	// The outline IS the lattice: a faint wireframe stroke in the plates' blue.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-cobalt-500) 32%, transparent)",
	// A deep scrim — the strata close over an overlay.
	"--mo-scrim": "color-mix(in srgb, var(--mo-cobalt-950) 76%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, the immersive reading. Every intent carries all seven
 * channels (incl. the action active/disabled states) so the fixed point holds
 * and no pressed/disabled state falls through to the warm Archive defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/** The beacon is the lattice light: electric 500, near-black navy text. */
	"primary-action": {
		surface: "var(--mo-cobalt-500)",
		on: "var(--mo-cobalt-on)",
		hover: "var(--mo-cobalt-400)",
		border: "var(--mo-cobalt-600)",
		ring: "var(--mo-cobalt-500)",
		active: "var(--mo-cobalt-600)",
		disabled: "color-mix(in srgb, var(--mo-cobalt-500) 38%, var(--mo-cobalt-900))",
	},
	/** Quiet strata chrome — the 900 stratum nudged toward the lattice. */
	neutral: {
		surface: "color-mix(in srgb, var(--mo-cobalt-900) 84%, var(--mo-cobalt-700))",
		on: "var(--mo-cobalt-100)",
		hover: "color-mix(in srgb, var(--mo-cobalt-900) 72%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-cobalt-500) 38%, transparent)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-900) 60%, var(--mo-cobalt-700))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-900) 60%, var(--mo-cobalt-950))",
	},
	/** Provenance — the wire of the lattice: deep navy, full depth. */
	provenance: {
		surface: "var(--mo-cobalt-700)",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 86%, var(--mo-cobalt-300))",
		border: "var(--mo-cobalt-500)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 78%, var(--mo-cobalt-500))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 40%, var(--mo-cobalt-950))",
	},
	/** Evidence — the record register: a near-stratum panel, ink-lifted. */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-cobalt-900) 64%, var(--mo-cobalt-800))",
		on: "var(--mo-cobalt-100)",
		hover: "color-mix(in srgb, var(--mo-cobalt-900) 50%, var(--mo-cobalt-800))",
		border: "color-mix(in srgb, var(--mo-cobalt-500) 30%, transparent)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-900) 40%, var(--mo-cobalt-800))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-900) 70%, var(--mo-cobalt-950))",
	},
	/** Accession — a half-lit node of the lattice; depth, not hue, sets it apart. */
	accession: {
		surface: "color-mix(in srgb, var(--mo-cobalt-700) 46%, var(--mo-cobalt-900))",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 58%, var(--mo-cobalt-900))",
		border: "var(--mo-cobalt-600)",
		ring: "var(--mo-cobalt-500)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 66%, var(--mo-cobalt-900))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 18%, var(--mo-cobalt-900))",
	},
	/** Caution — red survives the monochrome: functional color is never a mood. */
	caution: {
		surface: "var(--mo-red-700)",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 84%, var(--mo-red-300))",
		border: "var(--mo-red-400)",
		ring: "var(--mo-red-400)",
		active: "color-mix(in srgb, var(--mo-red-700) 76%, var(--mo-red-400))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-cobalt-900))",
	},
	/** Success — likewise: green stays green, quiet in the strata. */
	success: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 84%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 76%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-cobalt-900))",
	},
	/** Info — a brighter panel of the same lattice, lifted out of provenance. */
	info: {
		surface: "color-mix(in srgb, var(--mo-cobalt-700) 66%, var(--mo-cobalt-900))",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 78%, var(--mo-cobalt-900))",
		border: "var(--mo-cobalt-400)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 86%, var(--mo-cobalt-900))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 36%, var(--mo-cobalt-900))",
	},
};

/* ------------------------------------------------------------------------- *
 * The SAME register-extension names the other dialects contribute, re-read
 * for the strata. Identical NAMES, different scale mapping — the fixed point
 * at the extension tier.
 * ------------------------------------------------------------------------- */

const NIGHT_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → the plate number glowing dimly in the dark: lattice blue, mono. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-cobalt-400) 76%, transparent)",
		hover: "color-mix(in srgb, var(--mo-cobalt-900) 80%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-cobalt-500) 36%, transparent)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-900) 68%, var(--mo-cobalt-700))",
		disabled: "transparent",
	},
	/** Marginalia → a half-lit aside in the strata, softened ice. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-cobalt-900) 72%, var(--mo-cobalt-700))",
		on: "color-mix(in srgb, var(--mo-cobalt-100) 70%, transparent)",
		hover: "color-mix(in srgb, var(--mo-cobalt-900) 62%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-cobalt-500) 30%, transparent)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-900) 54%, var(--mo-cobalt-700))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-900) 50%, var(--mo-cobalt-950))",
	},
	/** Seal → the authority mark: the deep navy charged toward the beacon. */
	seal: {
		surface: "color-mix(in srgb, var(--mo-cobalt-700) 76%, var(--mo-cobalt-500))",
		on: "var(--mo-cobalt-100)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 64%, var(--mo-cobalt-500))",
		border: "var(--mo-cobalt-500)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 56%, var(--mo-cobalt-500))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 40%, var(--mo-cobalt-950))",
	},
};

export const night: Dialect = {
	id: "night",
	label: "Night",
	persona: { vertical: "editorial-gallery", role: "immersion" },
	intents: {
		...CORE,
		...NIGHT_REGISTER,
	},
	surfaces: NIGHT_SURFACES,
	priors: {
		// Immersive register: regular density, display drama allowed at the top
		// (the plates carry display headlines), and the same TIGHT emphasis
		// budget as the gallery — inside the strata the plates are still the
		// loudest objects. Inside the provider's clamp range, so Lemma 2 holds.
		rootDensity: "regular",
		rootScaleTier: 4,
		rootBudget: 2,
	},
	compounds: DIALECT_COMPOUND_CONSTRAINTS.night.compounds,
};

/**
 * A FOURTH dialect: 'timaeus' — the plates' blue-constellation world.
 *
 * The first dialect added for EDITORIAL NEED rather than demonstration. The
 * Timaeus narrative plates (B1–B9) are fixed artwork: electric-blue wireframe
 * lattices glowing on near-black blue-cast grounds, white-blue highlights at
 * the hot cores. The plates cannot re-pose — they are FIXED POINTS in the
 * strictest sense — so the substrate re-poses around THEM: under this dialect
 * a Timaeus page and its figures read as one object, the intent layer tuned to
 * the same lattice light the plates are drawn in.
 *
 * The register is the constellation, monochrome by conviction:
 *
 *   - ONE HUE, MANY DEPTHS. The plates are blue and only blue — structure,
 *     signal, and ornament are all the same lattice at different intensities.
 *     So the beacon, lineage, the catalog accent, and info all live on the
 *     cobalt ramp, separated by depth (full 700 / dim mixes / the bright 500),
 *     never by hue. Only the FUNCTIONAL pair (caution/success) keeps its
 *     red/green families — functional color is never sacrificed to a mood.
 *   - The beacon is the LATTICE LIGHT: the bright electric 500 with near-black
 *     navy text, under the SAME scarcity discipline as the Archive's amber —
 *     a beacon, used sparingly, never decoration.
 *   - GROUNDS go near-black blue-cast: every neutral surface step is cooled
 *     toward the deep lattice navy, so the page substrate sits in the plates'
 *     own darkness instead of the Archive's warm graphite.
 *
 * PARITY (CONTRACT §8 fixed point): this is a globally-shipped, globally-
 * selectable dialect, so it meets the same bar the other three shipped
 * dialects meet — otherwise everything it omits falls through the cascade to
 * the `:root` (warm Archive) block and selecting it yields a PARTIAL re-theme:
 *   - it defines all EIGHT core intents (incl. `evidence`, the record register);
 *   - every intent carries all SEVEN channels (surface/on/hover/border/ring +
 *     the action `active`/`disabled` pressed/disabled states);
 *   - it contributes the SAME register extensions the others do (folio /
 *     marginalia / seal), re-read for the plate world;
 *   - it ships a surface stack (TIMAEUS_SURFACES) so the page substrate drops
 *     into the constellation darkness too, instead of staying Archive-warm.
 *
 * THE DISCIPLINE (Lemma 3): every value below references a NEUTRAL scale var
 * (`--mo-neutral-*`, `--mo-cobalt-*`, `--mo-red-*`, `--mo-green-*`) or a
 * `color-mix` of them. The electric-blue band the plates demand is the
 * `--mo-cobalt-*` ramp minted in scales.css — a raw, vertical-neutral
 * progression; "Timaeus" exists ONLY here, at the intent layer. No hex, no
 * scale rename, no grammar change: selecting this dialect re-themes the page
 * without touching one authored node.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The Timaeus surface stack — the constellation ground. Still tonal layering
 * (no shadows), still pure neutral-scale references; the near-black blue cast
 * comes from cooling each neutral step toward the deep lattice navy.
 * ------------------------------------------------------------------------- */

export const TIMAEUS_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-neutral-1) 84%, var(--mo-cobalt-700))",
	"--mo-intent-surface-raised": "color-mix(in srgb, var(--mo-neutral-4) 84%, var(--mo-cobalt-700))",
	// Even the sunken well is blue-cast — the plates' ground is never warm black.
	"--mo-intent-surface-sunken": "color-mix(in srgb, var(--mo-neutral-0) 88%, var(--mo-cobalt-700))",
	// Overlay panel — top tonal tier, cooled into the same lattice navy.
	"--mo-intent-surface-overlay":
		"color-mix(in srgb, var(--mo-neutral-6) 84%, var(--mo-cobalt-700))",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	// Muted on-surface at 74% (the Archive's AA fix): clears 4.5:1 on every tier
	// of the cooled stack while staying visibly quieter than full on-surface.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 74%, transparent)",
	// The outline IS the lattice: a faint wireframe stroke in the plates' own
	// blue, not the Archive's dissolved warm ghost.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-cobalt-500) 38%, transparent)",
	// A deep scrim — the constellation dims to near-black around an overlay.
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 70%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, re-read for the plate world. Same eight names; one hue, many
 * depths. Every intent carries all seven channels (incl. the action
 * active/disabled states) so the fixed point holds and no pressed/disabled
 * state falls through to the warm Archive defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/**
	 * The beacon is the lattice light itself — the bright electric 500 of the
	 * plates' wireframes, with near-black navy text. Same scarcity discipline
	 * as the amber: a beacon, used sparingly, never decoration.
	 */
	"primary-action": {
		surface: "var(--mo-cobalt-500)",
		on: "var(--mo-cobalt-on)",
		hover: "var(--mo-cobalt-400)",
		border: "var(--mo-cobalt-600)",
		ring: "var(--mo-cobalt-500)",
		active: "var(--mo-cobalt-600)",
		disabled: "color-mix(in srgb, var(--mo-cobalt-500) 38%, var(--mo-neutral-3))",
	},
	/** Quiet constellation chrome — the neutral steps cooled into the navy. */
	neutral: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 84%, var(--mo-cobalt-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 84%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 55%, var(--mo-cobalt-400))",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 84%, var(--mo-cobalt-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 46%, var(--mo-neutral-2))",
	},
	/** Provenance — the wire of the constellation: deep lattice navy, full depth. */
	provenance: {
		surface: "var(--mo-cobalt-700)",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 86%, var(--mo-cobalt-300))",
		border: "var(--mo-cobalt-500)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 78%, var(--mo-cobalt-500))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 40%, var(--mo-neutral-3))",
	},
	/** Evidence — the record register; near-neutral, cooled to sit in the ground. */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-neutral-3) 86%, var(--mo-cobalt-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-4) 86%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 55%, var(--mo-cobalt-400))",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-neutral-5) 86%, var(--mo-cobalt-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 58%, var(--mo-neutral-1))",
	},
	/**
	 * Accession — the catalog accent echoes the lattice dimly (a half-lit node
	 * of the constellation), not the Archive's amber shelfmark. Depth, not hue,
	 * separates it from provenance.
	 */
	accession: {
		surface: "color-mix(in srgb, var(--mo-cobalt-700) 46%, var(--mo-neutral-3))",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 58%, var(--mo-neutral-3))",
		border: "var(--mo-cobalt-600)",
		ring: "var(--mo-cobalt-500)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 66%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 18%, var(--mo-neutral-3))",
	},
	/** Caution — red survives the monochrome: functional color is never a mood. */
	caution: {
		surface: "var(--mo-red-700)",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 84%, var(--mo-red-300))",
		border: "var(--mo-red-400)",
		ring: "var(--mo-red-400)",
		active: "color-mix(in srgb, var(--mo-red-700) 76%, var(--mo-red-400))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-neutral-3))",
	},
	/** Success — likewise: green stays green, quiet in the constellation dark. */
	success: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 84%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 76%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-3))",
	},
	/** Info — a brighter panel of the same lattice, lifted out of provenance. */
	info: {
		surface: "color-mix(in srgb, var(--mo-cobalt-700) 66%, var(--mo-neutral-3))",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 78%, var(--mo-neutral-3))",
		border: "var(--mo-cobalt-400)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 86%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 36%, var(--mo-neutral-3))",
	},
};

/* ------------------------------------------------------------------------- *
 * The SAME register-extension names the other dialects contribute, re-read for
 * the plate world. Identical NAMES (so an authored `intent: "seal"` keeps
 * resolving), different scale mapping — the fixed-point demonstration at the
 * extension tier. The plates already speak this register: each carries its
 * plate number ("B7") as a folio mark in the lattice blue.
 * ------------------------------------------------------------------------- */

const TIMAEUS_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → the plate-number register: a dim lattice-blue mono label. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-cobalt-400) 78%, transparent)",
		hover: "color-mix(in srgb, var(--mo-neutral-2) 82%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-cobalt-500) 40%, transparent)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-neutral-3) 82%, var(--mo-cobalt-700))",
		disabled: "transparent",
	},
	/** Marginalia → annotation/aside register: a half-lit aside in the ground. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 74%, var(--mo-cobalt-700))",
		on: "var(--mo-neutral-9)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 74%, var(--mo-cobalt-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 55%, var(--mo-cobalt-400))",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 74%, var(--mo-cobalt-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 42%, var(--mo-neutral-2))",
	},
	/**
	 * Seal → the Aition mark. B7 is explicit: the Philosopher-King "seals the
	 * act in an Aition" — so the authority mark is the energized deep stamp of
	 * the lattice (navy charged toward the beacon), same name, same slot as the
	 * Archive's grave amber seal, its own world.
	 */
	seal: {
		surface: "color-mix(in srgb, var(--mo-cobalt-700) 76%, var(--mo-cobalt-500))",
		on: "var(--mo-cobalt-300)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 64%, var(--mo-cobalt-500))",
		border: "var(--mo-cobalt-500)",
		ring: "var(--mo-cobalt-400)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 56%, var(--mo-cobalt-500))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 40%, var(--mo-neutral-3))",
	},
};

export const timaeus: Dialect = {
	id: "timaeus",
	label: "Timaeus",
	persona: { vertical: "editorial-narrative", role: "cosmology" },
	intents: {
		...CORE,
		...TIMAEUS_REGISTER,
	},
	surfaces: TIMAEUS_SURFACES,
	priors: {
		// Plate pages are contemplative: regular density, the top of the tree
		// allowed display drama (the plates carry display headlines), and a TIGHT
		// emphasis budget — the plates themselves are the loudest objects on a
		// Timaeus page, so the substrate claims less. All inside the provider's
		// clamp range (budget 1..6, scaleTier 2..4), so Lemma 2's laws hold.
		rootDensity: "regular",
		rootScaleTier: 4,
		rootBudget: 2,
	},
	compounds: [],
};

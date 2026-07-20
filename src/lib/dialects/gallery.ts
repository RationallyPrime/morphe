/**
 * A FIFTH dialect: 'gallery' — the museum ground (ADR-0005, D6).
 *
 * The first LIGHT dialect, and one half of the plate-derived pair (`night` is
 * the other). The nine Timaeus plates — luminous cobalt wireframes on
 * blue-black — are self-luminous art, and self-luminous art reads strongest
 * against a calm light ground: the gallery wall, not another dark room. So
 * this dialect is the wall: warm bone/plaster paper surfaces, ink-navy text
 * drawn from the plates' own shadows, and ONE accent — electric cobalt, the
 * same hue family as the plate light. Plates sit in dark vitrine wells and
 * glow against the calm; the ground itself never competes.
 *
 * The register is the museum, monochrome + cobalt by conviction:
 *
 *   - PAPER GROUND / INK TEXT / SINGLE COBALT ACCENT. The relationships are
 *     the decision (ADR-0005): no second accent, ever — a warm metal next to
 *     the cobalt would reintroduce the two-master problem the amber
 *     retirement solved.
 *   - The beacon is the ELECTRIC COBALT on paper: the deep 600 step (the 500
 *     lattice light is tuned for dark grounds and goes thin on bone), with
 *     ice text. Same scarcity discipline as every beacon before it.
 *   - The dark registers INVERT: provenance and seal become solid navy panels
 *     on the paper — museum wall labels and stamps — so the vitrine darkness
 *     has typographic echoes on the wall around it.
 *   - FUNCTIONAL color flips to light-theme form: caution/success/info become
 *     pale washes with deep functional text, never dark panels — but they
 *     keep their red/green families (functional color is never a mood).
 *
 * PARITY (CONTRACT §8 fixed point): globally shipped and globally selectable,
 * so it meets the same bar as the other shipped dialects — all EIGHT core
 * intents, all SEVEN channels each, the same register extensions
 * (folio/marginalia/seal), and a full surface stack.
 *
 * THE DISCIPLINE (Lemma 3): every value below references a NEUTRAL scale var
 * (`--mo-bone-*`, `--mo-cobalt-*`, `--mo-red-*`, `--mo-green-*`) or a
 * `color-mix` of them. The paper band the gallery demands is the `--mo-bone-*`
 * ramp minted in scales.css — a raw, vertical-neutral progression; "gallery"
 * exists ONLY here, at the intent layer. No hex, no scale rename, no grammar
 * change: selecting this dialect re-themes the page without touching one
 * authored node.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import { DIALECT_COMPOUND_CONSTRAINTS } from "./constraints.generated.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The gallery surface stack — paper tonal layering (no shadows). Raised goes
 * LIGHTER and sunken goes DEEPER into the plaster, the light-theme reading of
 * the Archive's tonal-depth rule. Text and outlines are the plate-shadow ink.
 * ------------------------------------------------------------------------- */

export const GALLERY_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "var(--mo-bone-4)",
	"--mo-intent-surface-raised": "var(--mo-bone-5)",
	"--mo-intent-surface-sunken": "var(--mo-bone-2)",
	// Overlay panel — the brightest paper tier (light themes lift overlays UP).
	"--mo-intent-surface-overlay": "var(--mo-bone-6)",
	"--mo-intent-on-surface": "var(--mo-cobalt-800)",
	// Muted ink at 72%: composites to ≈6.5:1 on the brightest paper tier, well
	// clear of AA while staying visibly quieter than full ink.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-cobalt-800) 72%, transparent)",
	// The outline is dissolved ink — a pencil hairline on paper, never a hue.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-cobalt-800) 24%, transparent)",
	// The scrim dims the wall toward the vitrine darkness, not toward grey.
	"--mo-scrim": "color-mix(in srgb, var(--mo-cobalt-950) 46%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, the museum reading. Every intent carries all seven channels
 * (incl. the action active/disabled states) so the fixed point holds and no
 * pressed/disabled state falls through to the warm Archive defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/**
	 * The beacon: electric cobalt on paper. The deep 600 step (AA with ice text
	 * where the dark-ground 500 is not), under the same scarcity discipline as
	 * the amber it replaces — a beacon, used sparingly, never decoration.
	 */
	"primary-action": {
		surface: "var(--mo-cobalt-600)",
		on: "var(--mo-cobalt-100)",
		hover: "var(--mo-cobalt-500)",
		border: "var(--mo-cobalt-700)",
		ring: "var(--mo-cobalt-600)",
		active: "var(--mo-cobalt-700)",
		disabled: "color-mix(in srgb, var(--mo-cobalt-600) 38%, var(--mo-bone-2))",
		ink: "var(--mo-cobalt-700)",
		"ink-hover": "color-mix(in srgb, var(--mo-cobalt-700) 80%, var(--mo-cobalt-500))",
	},
	/** Quiet paper chrome — plaster steps, ink text, no chroma. */
	neutral: {
		surface: "var(--mo-bone-2)",
		on: "var(--mo-cobalt-800)",
		hover: "var(--mo-bone-1)",
		border: "color-mix(in srgb, var(--mo-cobalt-800) 30%, var(--mo-bone-1))",
		ring: "var(--mo-cobalt-600)",
		active: "var(--mo-bone-0)",
		disabled: "color-mix(in srgb, var(--mo-bone-2) 60%, var(--mo-bone-4))",
		ink: "var(--mo-cobalt-800)",
		"ink-hover": "var(--mo-cobalt-700)",
	},
	/**
	 * Provenance — the wall label: a solid ink-navy panel on the paper, the
	 * typographic echo of the vitrine well. Ice text, lattice-navy ground.
	 */
	provenance: {
		surface: "var(--mo-cobalt-800)",
		on: "var(--mo-cobalt-100)",
		hover: "color-mix(in srgb, var(--mo-cobalt-800) 86%, var(--mo-cobalt-600))",
		border: "var(--mo-cobalt-700)",
		ring: "var(--mo-cobalt-600)",
		active: "color-mix(in srgb, var(--mo-cobalt-800) 76%, var(--mo-cobalt-600))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-800) 40%, var(--mo-bone-2))",
		ink: "var(--mo-cobalt-800)",
		"ink-hover": "var(--mo-cobalt-700)",
	},
	/** Evidence — the record register: near-paper, ink forward, no chroma. */
	evidence: {
		surface: "var(--mo-bone-3)",
		on: "var(--mo-cobalt-800)",
		hover: "var(--mo-bone-2)",
		border: "color-mix(in srgb, var(--mo-cobalt-800) 22%, var(--mo-bone-1))",
		ring: "var(--mo-cobalt-600)",
		active: "var(--mo-bone-1)",
		disabled: "color-mix(in srgb, var(--mo-bone-3) 60%, var(--mo-bone-4))",
		ink: "var(--mo-cobalt-800)",
		"ink-hover": "var(--mo-cobalt-700)",
	},
	/**
	 * Accession — the catalog accent: the faintest cobalt wash on the paper
	 * (a shelfmark in blue pencil), deep lattice-navy text. Depth of wash, not
	 * a second hue, separates it from info.
	 */
	accession: {
		surface: "color-mix(in srgb, var(--mo-cobalt-500) 14%, var(--mo-bone-4))",
		on: "var(--mo-cobalt-700)",
		hover: "color-mix(in srgb, var(--mo-cobalt-500) 20%, var(--mo-bone-4))",
		border: "color-mix(in srgb, var(--mo-cobalt-600) 45%, var(--mo-bone-1))",
		ring: "var(--mo-cobalt-600)",
		active: "color-mix(in srgb, var(--mo-cobalt-500) 26%, var(--mo-bone-4))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-500) 6%, var(--mo-bone-3))",
		ink: "var(--mo-cobalt-700)",
		"ink-hover": "var(--mo-cobalt-800)",
	},
	/** Caution — light-theme form: a pale red wash, deep red text. Functional. */
	caution: {
		surface: "color-mix(in srgb, var(--mo-red-500) 16%, var(--mo-bone-5))",
		on: "var(--mo-red-700)",
		hover: "color-mix(in srgb, var(--mo-red-500) 22%, var(--mo-bone-5))",
		border: "color-mix(in srgb, var(--mo-red-500) 55%, var(--mo-bone-1))",
		ring: "var(--mo-red-500)",
		active: "color-mix(in srgb, var(--mo-red-500) 28%, var(--mo-bone-5))",
		disabled: "color-mix(in srgb, var(--mo-red-500) 8%, var(--mo-bone-3))",
		ink: "var(--mo-red-700)",
		"ink-hover": "color-mix(in srgb, var(--mo-red-700) 82%, var(--mo-red-500))",
	},
	/** Success — likewise: a pale green wash, deep green text. */
	success: {
		surface: "color-mix(in srgb, var(--mo-green-500) 18%, var(--mo-bone-5))",
		on: "var(--mo-green-on)",
		hover: "color-mix(in srgb, var(--mo-green-500) 24%, var(--mo-bone-5))",
		border: "color-mix(in srgb, var(--mo-green-500) 60%, var(--mo-bone-1))",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-500) 30%, var(--mo-bone-5))",
		disabled: "color-mix(in srgb, var(--mo-green-500) 8%, var(--mo-bone-3))",
		ink: "var(--mo-green-700)",
		"ink-hover": "color-mix(in srgb, var(--mo-green-700) 78%, var(--mo-green-500))",
	},
	/** Info — a present cobalt wash, a step louder than the accession pencil. */
	info: {
		surface: "color-mix(in srgb, var(--mo-cobalt-500) 24%, var(--mo-bone-5))",
		on: "var(--mo-cobalt-700)",
		hover: "color-mix(in srgb, var(--mo-cobalt-500) 30%, var(--mo-bone-5))",
		border: "color-mix(in srgb, var(--mo-cobalt-500) 60%, var(--mo-bone-1))",
		ring: "var(--mo-cobalt-500)",
		active: "color-mix(in srgb, var(--mo-cobalt-500) 36%, var(--mo-bone-5))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-500) 10%, var(--mo-bone-3))",
		ink: "var(--mo-cobalt-700)",
		"ink-hover": "color-mix(in srgb, var(--mo-cobalt-700) 80%, var(--mo-cobalt-500))",
	},
};

/* ------------------------------------------------------------------------- *
 * The SAME register-extension names the other dialects contribute, re-read for
 * the museum wall. Identical NAMES (an authored `intent: "seal"` keeps
 * resolving), different scale mapping — the fixed point at the extension tier.
 * ------------------------------------------------------------------------- */

const GALLERY_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → the catalogue number: dim ink, mono, the quietest mark on the wall. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-cobalt-800) 64%, transparent)",
		hover: "var(--mo-bone-3)",
		border: "color-mix(in srgb, var(--mo-cobalt-800) 20%, transparent)",
		ring: "var(--mo-cobalt-600)",
		active: "var(--mo-bone-2)",
		disabled: "transparent",
		ink: "var(--mo-cobalt-800)",
		"ink-hover": "var(--mo-cobalt-700)",
	},
	/** Marginalia → the curator's pencil aside: a plaster panel, softened ink. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-bone-2) 70%, var(--mo-bone-4))",
		on: "color-mix(in srgb, var(--mo-cobalt-800) 80%, transparent)",
		hover: "var(--mo-bone-2)",
		border: "color-mix(in srgb, var(--mo-cobalt-800) 18%, var(--mo-bone-1))",
		ring: "var(--mo-cobalt-600)",
		active: "var(--mo-bone-1)",
		disabled: "color-mix(in srgb, var(--mo-bone-2) 50%, var(--mo-bone-4))",
		ink: "var(--mo-cobalt-800)",
		"ink-hover": "var(--mo-cobalt-700)",
	},
	/**
	 * Seal → the authority stamp: deep lattice navy pressed into the paper —
	 * the grave sibling of the cobalt beacon, same slot the Archive's grave
	 * amber held, its own world.
	 */
	seal: {
		surface: "var(--mo-cobalt-700)",
		on: "var(--mo-cobalt-100)",
		hover: "color-mix(in srgb, var(--mo-cobalt-700) 84%, var(--mo-cobalt-500))",
		border: "var(--mo-cobalt-600)",
		ring: "var(--mo-cobalt-600)",
		active: "color-mix(in srgb, var(--mo-cobalt-700) 70%, var(--mo-cobalt-500))",
		disabled: "color-mix(in srgb, var(--mo-cobalt-700) 40%, var(--mo-bone-2))",
		ink: "var(--mo-cobalt-700)",
		"ink-hover": "var(--mo-cobalt-800)",
	},
};

export const gallery: Dialect = {
	id: "gallery",
	label: "Gallery",
	persona: { vertical: "editorial-gallery", role: "museum" },
	intents: {
		...CORE,
		...GALLERY_REGISTER,
	},
	surfaces: GALLERY_SURFACES,
	priors: {
		// The museum register: regular density, the top of the tree allowed
		// display drama (gallery walls carry display type), and a TIGHT emphasis
		// budget — the plates in their vitrines are the loudest objects on the
		// wall, so the calm ground claims less. Inside the provider's clamp range
		// (budget 1..6, scaleTier 2..4), so Lemma 2's laws hold.
		rootDensity: "regular",
		rootScaleTier: 4,
		rootBudget: 2,
	},
	compounds: DIALECT_COMPOUND_CONSTRAINTS.gallery.compounds,
};

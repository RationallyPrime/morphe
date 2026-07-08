/**
 * A dialect: 'ledger' — the financial-controls register.
 *
 * A precise, cool instrument-panel reading of the SAME core intents, voiced for a
 * controller's ledger: the vertical vocabulary (the teal control accent, the
 * recorded/affirmed states, the audit caution) lives ONLY here, at the intent
 * layer, mapped onto the NEUTRAL scales. The scale names stay vertical-neutral;
 * the finance vocabulary is an injection (Lemma 4).
 *
 * Selecting this dialect re-themes the page WITHOUT changing one authored node —
 * the on-screen proof of the fixed point (Lemma 3). Each shipped dialect is pulled
 * apart at the loudest signals (the §8 beacon + surface differentiation): where the
 * Archive reads warm (AMBER beacon, warm graphite), the Clinical cold (steel-BLUE
 * beacon, slate), and the Registry amethyst (a VIOLET beacon on a violet-cooled
 * substrate), the Ledger reads TEAL — a controller's ledger accent on a substrate
 * cooled toward a deep blue-green — with citation-blue retained only for the
 * lineage intents (provenance/info) and red caution. Values are scale vars only —
 * never hex — keeping the vertical out of the scale layer.
 *
 * PARITY (CONTRACT §8 fixed point): this is a globally-shipped, globally-
 * selectable dialect, so it MUST meet the same channel/intent/surface bar the
 * other shipped dialects meet — otherwise everything it omits falls through the
 * cascade to the `:root` (warm Archive) block and selecting it yields a PARTIAL
 * re-theme. So, exactly as the Registry does:
 *   - it defines all EIGHT core intents (incl. `evidence`, the record register);
 *   - every intent carries all SEVEN channels (surface/on/hover/border/ring +
 *     the action `active`/`disabled` pressed/disabled states);
 *   - it contributes the SAME register extensions the others do (folio /
 *     marginalia / seal), re-read for a financial ledger;
 *   - it ships a surface stack (LEDGER_SURFACES) so the page substrate cools to
 *     the instrument-panel reading too, instead of staying Archive-warm.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The Ledger surface stack — a cool instrument-panel substrate. Still tonal
 * layering (no shadows), still pure neutral-scale references; the cool blue-green
 * cast comes from mixing a touch of teal into the neutral steps.
 * ------------------------------------------------------------------------- */

export const LEDGER_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-neutral-1) 90%, var(--mo-teal-700))",
	"--mo-intent-surface-raised": "color-mix(in srgb, var(--mo-neutral-4) 88%, var(--mo-teal-700))",
	"--mo-intent-surface-sunken": "var(--mo-neutral-0)",
	// Overlay panel — top tonal tier, cooled toward the teal control accent.
	"--mo-intent-surface-overlay": "color-mix(in srgb, var(--mo-neutral-6) 88%, var(--mo-teal-700))",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	// Muted on-surface held at 74% (matching the Archive's AA fix): at 62% it dipped
	// under 4.5:1 on the highest raised tier. 74% clears AA on every tier while staying
	// visibly quieter than full on-surface.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 74%, transparent)",
	// A crisp outline toned to the teal accent — an instrument panel wants visible
	// structure in its own colour.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-neutral-8) 64%, var(--mo-teal-600))",
	// A denser scrim — a controls console dims the field harder.
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 68%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, re-read for a financial-controls register. Same eight names; cool,
 * teal-led mapping. Every intent carries all seven channels (incl. the action
 * active/disabled states) so the fixed point holds and no pressed/disabled state
 * falls through to the warm Archive defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/**
	 * primary-action: the TEAL beacon — the controller's ledger accent. This is the
	 * differentiator: where the Archive's beacon is warm amber, the Clinical's a cold
	 * steel-blue, and the Registry's an amethyst violet, the Ledger's is a distinct
	 * blue-green teal, so flipping the dialect re-reads the page's single loudest
	 * signal into a wholly different hue. A bright 500 fill, dark text.
	 */
	"primary-action": {
		surface: "var(--mo-teal-500)",
		on: "var(--mo-teal-on)",
		hover: "var(--mo-teal-400)",
		border: "var(--mo-teal-600)",
		ring: "var(--mo-teal-500)",
		active: "var(--mo-teal-600)",
		disabled: "color-mix(in srgb, var(--mo-teal-500) 38%, var(--mo-neutral-3))",
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
	},
	/** provenance: citation-blue, forward (the lineage of a posting). */
	provenance: {
		surface: "var(--mo-blue-700)",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 85%, var(--mo-blue-300))",
		border: "var(--mo-blue-400)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 78%, var(--mo-blue-400))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 40%, var(--mo-neutral-3))",
	},
	/**
	 * evidence: the record register — near-neutral but cooled toward the teal
	 * substrate, so an authored `intent: "evidence"` resolves to the ledger's own
	 * record tone here instead of falling through to the warm Archive evidence.
	 */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-neutral-3) 86%, var(--mo-teal-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-4) 86%, var(--mo-teal-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-teal-400)",
		active: "color-mix(in srgb, var(--mo-neutral-5) 86%, var(--mo-teal-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 58%, var(--mo-neutral-1))",
	},
	/** accession: the catalog accent echoes the teal beacon (a ledger account tag). */
	accession: {
		surface: "color-mix(in srgb, var(--mo-teal-700) 42%, var(--mo-neutral-3))",
		on: "var(--mo-teal-300)",
		hover: "color-mix(in srgb, var(--mo-teal-700) 54%, var(--mo-neutral-3))",
		border: "var(--mo-teal-600)",
		ring: "var(--mo-teal-500)",
		active: "color-mix(in srgb, var(--mo-teal-700) 62%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-teal-700) 18%, var(--mo-neutral-3))",
	},
	/** caution: a louder ledger red — a variance/exception flag. */
	caution: {
		surface: "var(--mo-red-700)",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 82%, var(--mo-red-300))",
		border: "var(--mo-red-500)",
		ring: "var(--mo-red-500)",
		active: "color-mix(in srgb, var(--mo-red-700) 74%, var(--mo-red-400))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-neutral-3))",
	},
	/** success: keep green, slightly cooler (a reconciled/affirmed state). */
	success: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 84%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 74%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-3))",
	},
	/** info: blue family, brighter (an open line-item note). */
	info: {
		surface: "color-mix(in srgb, var(--mo-blue-700) 60%, var(--mo-neutral-2))",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 72%, var(--mo-neutral-2))",
		border: "var(--mo-blue-400)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 80%, var(--mo-neutral-2))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 36%, var(--mo-neutral-3))",
	},
};

/* ------------------------------------------------------------------------- *
 * The SAME register-extension names the Archive and Clinical contribute, re-read
 * for a financial ledger. Identical NAMES (so an authored `intent: "seal"` keeps
 * resolving), different scale mapping — the fixed-point demonstration at the
 * extension tier. Without these, an authored `intent: "folio"` would fall through
 * to the warm Archive register while the rest of the page reads cool.
 * ------------------------------------------------------------------------- */

const LEDGER_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → account-number/reference register: a teal-toned mono label. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-teal-300) 72%, transparent)",
		hover: "color-mix(in srgb, var(--mo-neutral-2) 82%, var(--mo-teal-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 50%, transparent)",
		ring: "var(--mo-teal-400)",
		active: "color-mix(in srgb, var(--mo-neutral-3) 82%, var(--mo-teal-700))",
		disabled: "transparent",
	},
	/** Marginalia → annotation/footnote register: a teal-toned aside. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 72%, var(--mo-teal-700))",
		on: "var(--mo-neutral-10)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 72%, var(--mo-teal-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-teal-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 72%, var(--mo-teal-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 42%, var(--mo-neutral-2))",
	},
	/**
	 * Seal → the controller's sign-off / authority mark. The Ledger's authority mark
	 * is a deliberate TEAL stamp — the blue-green counterpart of the Archive's grave
	 * amber seal and the Registry's amethyst stamp, same name, same slot, its own hue.
	 */
	seal: {
		surface: "var(--mo-teal-700)",
		on: "var(--mo-teal-300)",
		hover: "color-mix(in srgb, var(--mo-teal-700) 82%, var(--mo-teal-300))",
		border: "var(--mo-teal-600)",
		ring: "var(--mo-teal-400)",
		active: "color-mix(in srgb, var(--mo-teal-700) 70%, var(--mo-teal-300))",
		disabled: "color-mix(in srgb, var(--mo-teal-700) 40%, var(--mo-neutral-3))",
	},
};

export const ledger: Dialect = {
	id: "ledger",
	label: "Ledger",
	persona: { vertical: "finance", role: "controller" },
	intents: {
		...CORE,
		...LEDGER_REGISTER,
	},
	surfaces: LEDGER_SURFACES,
	// A controller prior: exception-led, slightly denser, a marginally tighter top
	// tier than the editorial Archive. Clamped by the provider so Lemma 2 holds.
	priors: {
		rootDensity: "compact",
		rootScaleTier: 3,
		rootBudget: 3,
	},
	// The compounds field is inert (Phase 0); the library must not reference a
	// demo-coupled compound, so this dialect declares none.
	compounds: [],
};

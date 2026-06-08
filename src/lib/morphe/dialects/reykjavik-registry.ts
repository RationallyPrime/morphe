/**
 * A THIRD dialect: 'reykjavik-registry' — the legal/judicial register.
 *
 * Promoted from the demo into the library so the app's active-dialect set is a
 * single global fact (registry.ts), not a value defined inline next to one page.
 * It is the legal/judicial reading of the SAME core intents, lifted from the
 * legacy's mono-vertical palette (judicial-crimson / citation-blue /
 * amendment-gold) but done the elegant way: those vertical names live ONLY here,
 * at the intent layer, mapped onto the NEUTRAL scales. The scale names stay
 * vertical-neutral; the vertical vocabulary is an injection (Lemma 4).
 *
 * Selecting this dialect re-themes the page WITHOUT changing one authored node —
 * the on-screen proof of the fixed point (Lemma 3). Where the Archive reads warm
 * (amber beacon, warm neutrals), the Registry reads as a cool court record:
 * citation-blue forward, judicial-crimson caution, a denser registrar prior.
 * Values are scale vars only — never hex — keeping the vertical out of the scale
 * layer.
 *
 * PARITY (CONTRACT §8 fixed point): this is a globally-shipped, globally-
 * selectable dialect, so it MUST meet the same channel/intent/surface bar the
 * other two shipped dialects meet — otherwise everything it omits falls through
 * the cascade to the `:root` (warm Archive) block and selecting it yields a
 * PARTIAL re-theme. So, exactly as `clinical` does:
 *   - it defines all EIGHT core intents (incl. `evidence`, the record register);
 *   - every intent carries all SEVEN channels (surface/on/hover/border/ring +
 *     the action `active`/`disabled` pressed/disabled states);
 *   - it contributes the SAME register extensions the others do (folio /
 *     marginalia / seal), re-read for a court record;
 *   - it ships a surface stack (REYKJAVIK_SURFACES) so the page substrate cools
 *     to the court-record reading too, instead of staying Archive-warm.
 */

import type { CoreIntent } from "../grammar/types.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The Reykjavík Registry surface stack — a cool court-record substrate. Still
 * tonal layering (no shadows), still pure neutral-scale references; the cool
 * cast comes from mixing a touch of citation-blue into the neutral steps.
 * ------------------------------------------------------------------------- */

export const REYKJAVIK_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-neutral-1) 90%, var(--mo-blue-700))",
	"--mo-intent-surface-raised": "color-mix(in srgb, var(--mo-neutral-4) 88%, var(--mo-blue-700))",
	"--mo-intent-surface-sunken": "var(--mo-neutral-0)",
	// Overlay panel — top tonal tier, cooled toward citation-blue.
	"--mo-intent-surface-overlay": "color-mix(in srgb, var(--mo-neutral-6) 88%, var(--mo-blue-700))",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 62%, transparent)",
	// A crisper, cooler outline than the Archive's warm ghost — a court record
	// wants visible structure.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-neutral-8) 64%, var(--mo-blue-500))",
	// A denser scrim — a registrar console dims the field harder.
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 68%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, re-read for a legal/judicial register. Same eight names; cool,
 * citation-led mapping. Every intent carries all seven channels (incl. the
 * action active/disabled states) so the fixed point holds and no pressed/disabled
 * state falls through to the warm Archive defaults.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/** primary-action: amendment-gold beacon, cooler/dimmer than the Archive. */
	"primary-action": {
		surface: "var(--mo-amber-600)",
		on: "var(--mo-amber-on)",
		hover: "var(--mo-amber-500)",
		border: "var(--mo-amber-700)",
		ring: "var(--mo-amber-600)",
		active: "var(--mo-amber-700)",
		disabled: "color-mix(in srgb, var(--mo-amber-600) 38%, var(--mo-neutral-3))",
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
	/** provenance: citation-blue, forward (the lineage of a ruling). */
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
	 * evidence: the court-record register — near-neutral but cooled toward slate,
	 * so an authored `intent: "evidence"` resolves to a cool record tone here
	 * instead of falling through to the warm Archive evidence.
	 */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-neutral-3) 86%, var(--mo-blue-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-4) 86%, var(--mo-blue-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-5) 86%, var(--mo-blue-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 58%, var(--mo-neutral-1))",
	},
	/** accession: the catalog accent reads as citation-blue (a court folio). */
	accession: {
		surface: "color-mix(in srgb, var(--mo-blue-700) 38%, var(--mo-neutral-3))",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 50%, var(--mo-neutral-3))",
		border: "var(--mo-blue-500)",
		ring: "var(--mo-blue-500)",
		active: "color-mix(in srgb, var(--mo-blue-700) 58%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 16%, var(--mo-neutral-3))",
	},
	/** caution: judicial-crimson — a louder court red. */
	caution: {
		surface: "var(--mo-red-700)",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 82%, var(--mo-red-300))",
		border: "var(--mo-red-500)",
		ring: "var(--mo-red-500)",
		active: "color-mix(in srgb, var(--mo-red-700) 74%, var(--mo-red-400))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-neutral-3))",
	},
	/** success: keep green, slightly cooler (a recorded/affirmed state). */
	success: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 84%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 74%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-3))",
	},
	/** info: blue family, brighter (an open docket note). */
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
 * for a court record. Identical NAMES (so an authored `intent: "seal"` keeps
 * resolving), different scale mapping — the fixed-point demonstration at the
 * extension tier. Without these, an authored `intent: "folio"` would fall through
 * to the warm Archive register while the rest of the page reads cool.
 * ------------------------------------------------------------------------- */

const REYKJAVIK_REGISTER: Readonly<Record<string, IntentDefinition>> = {
	/** Folio → docket/case-number register: a cool mono label tone. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-blue-300) 72%, transparent)",
		hover: "color-mix(in srgb, var(--mo-neutral-2) 82%, var(--mo-blue-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 50%, transparent)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-3) 82%, var(--mo-blue-700))",
		disabled: "transparent",
	},
	/** Marginalia → annotation/aside register: a citation-toned aside. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 72%, var(--mo-blue-700))",
		on: "var(--mo-neutral-10)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 72%, var(--mo-blue-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 72%, var(--mo-blue-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 42%, var(--mo-neutral-2))",
	},
	/**
	 * Seal → the registrar's stamp / authority mark. In a court record the
	 * authority mark is a deliberate citation-blue stamp — the cool counterpart of
	 * the Archive's grave amber seal and the clinical green sign-off, same name,
	 * same slot.
	 */
	seal: {
		surface: "var(--mo-blue-700)",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 82%, var(--mo-blue-300))",
		border: "var(--mo-blue-500)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 70%, var(--mo-blue-300))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 40%, var(--mo-neutral-3))",
	},
};

export const reykjavikRegistry: Dialect = {
	id: "reykjavik-registry",
	label: "Reykjavík Registry",
	persona: { vertical: "legal", role: "registrar" },
	intents: {
		...CORE,
		...REYKJAVIK_REGISTER,
	},
	// A registrar prior: exception-led, slightly denser, a marginally tighter top
	// tier than the editorial Archive. Clamped by the provider so Lemma 2 holds.
	priors: {
		rootDensity: "compact",
		rootScaleTier: 3,
		rootBudget: 3,
	},
	// The compounds field is inert (Phase 0); the library must not reference a
	// demo-coupled compound, so the promoted dialect declares none.
	compounds: [],
};

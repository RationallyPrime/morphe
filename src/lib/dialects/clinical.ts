/**
 * A SECOND, contrasting dialect: 'clinical'.
 *
 * This exists to PROVE Lemma 4's central claim: re-dialecting is a fixed point
 * for anything authored. A dialect is an injection at the INTENT layer plus
 * bounded algebra priors — and NOTHING ELSE. Swapping `icelandic-archive` for
 * `clinical` over a subtree must change only the colour/density character of
 * that subtree; it must NOT require editing a single authored Node, must NOT
 * touch the neutral scales, and must NOT add or rename a primitive.
 *
 * The register is deliberately opposite to the Archive's Doxa tier:
 *
 *   - REGULATED / EXCEPTION-FORWARD. This is the register of a controlled
 *     console — batch release, deviation review, audit trail — where status
 *     leads and the calm editorial beacon is the wrong instrument.
 *   - COOLER, status-led intent mapping. The amber "beacon" is demoted to a
 *     cold steel-blue primary action (a console button, not a lantern); caution
 *     and success are pushed FORWARD (brighter, higher-contrast surfaces) so
 *     exceptions read at a glance; provenance/evidence cool toward slate.
 *   - DENSER priors: compact root density, a lower root scale tier (no display
 *     drama), and a larger emphasis budget so multiple live statuses can coexist
 *     without the renormalizer starving the later ones.
 *
 * THE PROOF, mechanically:
 *   1. Every value below references a NEUTRAL scale var (`--mo-neutral-*`,
 *      `--mo-blue-*`, `--mo-green-*`, `--mo-red-*`, `--mo-amber-*`) or a
 *      `color-mix` of them. There is NO literal hex, NO new scale, NO scale
 *      rename. The scales stay vertical-neutral (Lemma 3).
 *   2. The intent NAMES are exactly the core eight plus the same register slots
 *      the Archive uses (`folio`/`marginalia`/`seal`) re-read for a console, so
 *      an authored tree referencing `intent: "caution"` (or `"seal"`) keeps
 *      working unchanged — only the channel→scale map underneath moves.
 *   3. The only other surface a dialect touches is `priors`, which the provider
 *      CLAMPS into the design system's range (budget 1..6, scaleTier 2..4), so
 *      Lemma 2's four laws survive this dialect by construction.
 *
 * `applyDialect(clinical)` flattens `intents` into the CSS-var overrides
 * `MorpheRoot` spreads at its boundary; because those var names are identical to
 * the Archive's, dropping a `clinical`-bearing boundary INSIDE an Archive tree
 * re-dialects exactly that subtree via the cascade — the subtree-boundary swap.
 */

import type { CoreIntent, RegisterIntent } from "../grammar/types.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * The clinical surface stack — cooler than the Archive's warm graphite. Still
 * tonal layering (no shadows), still pure neutral-scale references; the cool
 * cast comes from mixing a touch of slate-blue into the neutral steps.
 * ------------------------------------------------------------------------- */

export const CLINICAL_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "color-mix(in srgb, var(--mo-neutral-1) 88%, var(--mo-blue-700))",
	"--mo-intent-surface-raised": "color-mix(in srgb, var(--mo-neutral-4) 86%, var(--mo-blue-700))",
	"--mo-intent-surface-sunken": "var(--mo-neutral-0)",
	// Overlay panel — top tonal tier, cooled toward slate to match the console.
	"--mo-intent-surface-overlay": "color-mix(in srgb, var(--mo-neutral-6) 86%, var(--mo-blue-700))",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	// Muted on-surface raised to 74% (matching the Archive's AA fix): at 64% it dipped
	// under 4.5:1 on the highest raised tier of the cool slate stack.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 74%, transparent)",
	// A crisper outline than the Archive's warm, low-opacity ghost — a console
	// wants visible structure, not dissolved sectioning.
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-neutral-8) 60%, var(--mo-blue-500))",
	// A denser scrim — an exception-review console dims the field harder.
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 70%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * CORE intents, re-read for a regulated console. Same eight names; cooler,
 * status-led mapping. Caution and success are pushed forward; the beacon cools.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/**
	 * The beacon, demoted to a cold steel primary action — a console control,
	 * not a lantern. Blue, not amber: the register's signal colour is reserved
	 * for STATUS, so the action chrome must step back out of the status palette.
	 */
	"primary-action": {
		surface: "var(--mo-blue-500)",
		on: "var(--mo-blue-on)",
		hover: "var(--mo-blue-400)",
		border: "var(--mo-blue-700)",
		ring: "var(--mo-blue-400)",
		active: "var(--mo-blue-700)",
		disabled: "color-mix(in srgb, var(--mo-blue-500) 38%, var(--mo-neutral-3))",
	},
	/** Quiet console chrome — cooler neutral than the Archive's warm graphite. */
	neutral: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 84%, var(--mo-blue-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 84%, var(--mo-blue-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 84%, var(--mo-blue-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 46%, var(--mo-neutral-2))",
	},
	/** Provenance — chain-of-custody slate; cooler, more legal than lyrical. */
	provenance: {
		surface: "color-mix(in srgb, var(--mo-blue-700) 80%, var(--mo-neutral-3))",
		on: "var(--mo-blue-300)",
		hover: "var(--mo-blue-700)",
		border: "var(--mo-blue-500)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 92%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 40%, var(--mo-neutral-3))",
	},
	/** Evidence — the record register; near-neutral but cooled toward slate. */
	evidence: {
		surface: "color-mix(in srgb, var(--mo-neutral-3) 88%, var(--mo-blue-700))",
		on: "var(--mo-neutral-11)",
		hover: "color-mix(in srgb, var(--mo-neutral-4) 88%, var(--mo-blue-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-5) 88%, var(--mo-blue-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 58%, var(--mo-neutral-1))",
	},
	/**
	 * Accession — in a controlled console this is the LOT / batch accent. Amber
	 * survives but only here (the one warm note), as a sample/lot identifier, not
	 * as primary chrome.
	 */
	accession: {
		surface: "color-mix(in srgb, var(--mo-amber-600) 26%, var(--mo-neutral-3))",
		on: "var(--mo-amber-300)",
		hover: "color-mix(in srgb, var(--mo-amber-600) 38%, var(--mo-neutral-3))",
		border: "var(--mo-amber-700)",
		ring: "var(--mo-amber-500)",
		active: "color-mix(in srgb, var(--mo-amber-600) 46%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-amber-600) 12%, var(--mo-neutral-3))",
	},
	/**
	 * Caution — pushed FORWARD. In an exception-forward register a deviation must
	 * read instantly, so the surface is the brighter red step (not the dim 700)
	 * and on-colour is darkened for high contrast.
	 */
	caution: {
		surface: "var(--mo-red-500)",
		on: "var(--mo-red-on)",
		hover: "var(--mo-red-400)",
		border: "var(--mo-red-300)",
		ring: "var(--mo-red-400)",
		active: "color-mix(in srgb, var(--mo-red-500) 84%, var(--mo-red-700))",
		disabled: "color-mix(in srgb, var(--mo-red-500) 40%, var(--mo-neutral-3))",
	},
	/** Success — likewise forward: a released/passing state should glow, calmly. */
	success: {
		surface: "var(--mo-green-500)",
		on: "var(--mo-green-on)",
		hover: "var(--mo-green-400)",
		border: "var(--mo-green-400)",
		ring: "var(--mo-green-400)",
		active: "color-mix(in srgb, var(--mo-green-500) 84%, var(--mo-green-700))",
		disabled: "color-mix(in srgb, var(--mo-green-500) 40%, var(--mo-neutral-3))",
	},
	/** Info — bright clinical blue, distinct from the cooled provenance slate. */
	info: {
		surface: "var(--mo-blue-700)",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 84%, var(--mo-blue-300))",
		border: "var(--mo-blue-400)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-blue-700) 92%, var(--mo-blue-300))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 38%, var(--mo-neutral-3))",
	},
};

/* ------------------------------------------------------------------------- *
 * The SAME register-extension names the Archive contributes, re-read for the
 * console. Identical NAMES (so an authored `intent: "seal"` keeps resolving),
 * different scale mapping — the fixed-point demonstration at the extension tier.
 * ------------------------------------------------------------------------- */

const CLINICAL_REGISTER: Readonly<Record<RegisterIntent, IntentDefinition>> = {
	/** Folio → row/record-id register: a cold mono label tone. */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-blue-300) 70%, transparent)",
		hover: "color-mix(in srgb, var(--mo-neutral-2) 80%, var(--mo-blue-700))",
		border: "color-mix(in srgb, var(--mo-neutral-8) 50%, transparent)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-3) 80%, var(--mo-blue-700))",
		disabled: "transparent",
	},
	/** Marginalia → reviewer-note register: an aside, slate-toned. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 70%, var(--mo-blue-700))",
		on: "var(--mo-neutral-10)",
		hover: "color-mix(in srgb, var(--mo-neutral-5) 70%, var(--mo-blue-700))",
		border: "var(--mo-neutral-8)",
		ring: "var(--mo-blue-400)",
		active: "color-mix(in srgb, var(--mo-neutral-6) 70%, var(--mo-blue-700))",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 42%, var(--mo-neutral-2))",
	},
	/**
	 * Seal → SIGN-OFF / electronic-signature mark. In a regulated console the
	 * authority mark is a deliberate, high-contrast green commit — the opposite
	 * of the Archive's grave amber seal, same name, same slot.
	 */
	seal: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 82%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-400)",
		active: "color-mix(in srgb, var(--mo-green-700) 70%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-3))",
	},
};

export const clinical: Dialect = {
	id: "clinical",
	label: "Clinical Console",
	persona: { vertical: "regulated-operations", role: "exception-review" },
	intents: {
		...CORE,
		...CLINICAL_REGISTER,
	},
	surfaces: CLINICAL_SURFACES,
	priors: {
		// Exception-forward console: pack the rows, cap the drama, widen the
		// budget so several live statuses coexist. All three are inside the
		// provider's clamp range, so Lemma 2's laws hold unchanged.
		rootDensity: "compact",
		rootScaleTier: 3,
		rootBudget: 5,
	},
	compounds: [],
};

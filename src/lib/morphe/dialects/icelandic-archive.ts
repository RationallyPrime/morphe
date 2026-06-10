/**
 * The DEFAULT dialect: 'icelandic-archive'.
 *
 * This is the working default injection (Lemma 4 / Corollary 1: "a single
 * default dialect, and the system is exactly v0.2's"). It is the Doxa-tier
 * editorial register of the Sokrates "Icelandic Archive": restrained numbers, a
 * quiet/regular density, the amber beacon used sparingly. Every specialized
 * dialect (e.g. `clinical`) is a REFINEMENT of this template — it remaps the
 * intent layer and adjusts the bounded priors, and nothing else.
 *
 * Why declare the intent map explicitly here when tokens/intents.css already
 * holds a `[data-mo-dialect="icelandic-archive"]` block?
 *
 *   The CSS block is the *static* fallback (it paints before any JS, and it is
 *   what the cascade resolves to when no boundary overrides a channel). This
 *   file is the *data* source of truth for the SAME mapping: `applyDialect`
 *   flattens it into the CSS-var overrides `MorpheRoot` spreads at its boundary.
 *   The two agree by construction — every value below is the identical neutral
 *   `var(--mo-…scale…)` chain the CSS block uses — so the rendered colour is
 *   byte-identical whether the cascade resolves the static block or a boundary
 *   override. Making the default explicit as data is what lets a SUBTREE swap to
 *   another dialect (the contrasting `clinical` dialect re-sets these exact var
 *   names at its own boundary) and lets the dialect set be read, diffed, and
 *   refined as plain data instead of as scattered CSS.
 *
 * THE DISCIPLINE (Lemma 3 fixed point): every channel value references a NEUTRAL
 * scale var (`--mo-neutral-*`, `--mo-amber-*`, `--mo-blue-*`, …) or a
 * `color-mix` of them. There is NOT a single literal hex here, and NOT a single
 * vertical word welded into a scale name. The vertical reading lives ONLY at
 * this intent layer; the scales stay neutral and back any dialect. That is the
 * exact mistake the legacy made (`--dl-color-judicial-crimson` as a *scale*)
 * and the exact mistake this layer exists to never repeat.
 */

import type { CoreIntent } from "../grammar/types.js";
import type { Dialect, IntentDefinition } from "./types.js";

/* ------------------------------------------------------------------------- *
 * Base surface channels (not intent-scoped, but carried as data here so the
 * full default surface stack is a single readable record). These mirror the
 * SURFACE_VARS naming in tokens/intents.ts; the provider emits them verbatim.
 * ------------------------------------------------------------------------- */

/**
 * The Archive surface stack — tonal layering, no shadows (the Archive rule).
 * Spread under the (non-intent) `surface`/`on-surface`/`outline` channel names
 * so a refining dialect could shift the whole substrate by overriding these.
 */
export const ARCHIVE_SURFACES: Readonly<Record<string, string>> = {
	"--mo-intent-surface-base": "var(--mo-neutral-1)",
	"--mo-intent-surface-raised": "var(--mo-neutral-4)",
	"--mo-intent-surface-sunken": "var(--mo-neutral-0)",
	// Overlay panel surface — the highest tonal tier (Dialog/Popover); depth via
	// tone, not shadow. Scrim is the one translucent-fill backdrop token.
	"--mo-intent-surface-overlay": "var(--mo-neutral-6)",
	"--mo-intent-on-surface": "var(--mo-neutral-11)",
	// Muted on-surface, raised to 74%: at 60% it resolved to ~#8F9092 and dipped to
	// ~3.95:1 on the highest raised card tier (under WCAG AA). 74% clears 4.5:1 on
	// every surface tier while staying visibly quieter than full on-surface.
	"--mo-intent-on-surface-muted": "color-mix(in srgb, var(--mo-neutral-11) 74%, transparent)",
	"--mo-intent-outline": "color-mix(in srgb, var(--mo-neutral-7) 70%, transparent)",
	"--mo-scrim": "color-mix(in srgb, var(--mo-neutral-0) 62%, transparent)",
};

/* ------------------------------------------------------------------------- *
 * The CORE intent set (vertical-neutral), in the Archive reading. These are the
 * eight names the grammar's `CoreIntent` type fixes; a dialect may re-map their
 * channels but never rename or drop one. Authored trees reference these by name.
 * ------------------------------------------------------------------------- */

const CORE: Readonly<Record<CoreIntent, IntentDefinition>> = {
	/** The amber beacon (#f2ca50) — a beacon, used sparingly, never decoration. */
	"primary-action": {
		surface: "var(--mo-amber-500)",
		on: "var(--mo-amber-on)",
		hover: "var(--mo-amber-400)",
		border: "var(--mo-amber-600)",
		ring: "var(--mo-amber-500)",
		active: "var(--mo-amber-600)",
		disabled: "color-mix(in srgb, var(--mo-amber-500) 38%, var(--mo-neutral-3))",
	},
	/** Quiet surface-tone controls — the workhorse, no chroma. */
	neutral: {
		surface: "var(--mo-neutral-4)",
		on: "var(--mo-neutral-11)",
		hover: "var(--mo-neutral-5)",
		border: "var(--mo-neutral-7)",
		ring: "var(--mo-neutral-8)",
		active: "var(--mo-neutral-6)",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 50%, var(--mo-neutral-2))",
	},
	/** Lineage / citation blue — "where this came from". */
	provenance: {
		surface: "var(--mo-blue-700)",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 88%, var(--mo-blue-300))",
		border: "var(--mo-blue-500)",
		ring: "var(--mo-blue-500)",
		active: "color-mix(in srgb, var(--mo-blue-700) 80%, var(--mo-blue-500))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 40%, var(--mo-neutral-3))",
	},
	/** The document register; on-surface forward, near-neutral. */
	evidence: {
		surface: "var(--mo-neutral-3)",
		on: "var(--mo-neutral-10)",
		hover: "var(--mo-neutral-4)",
		border: "var(--mo-neutral-7)",
		ring: "var(--mo-neutral-8)",
		active: "var(--mo-neutral-5)",
		disabled: "color-mix(in srgb, var(--mo-neutral-3) 60%, var(--mo-neutral-1))",
	},
	/** The catalog accent — amber-dim, the archival shelfmark colour. */
	accession: {
		surface: "color-mix(in srgb, var(--mo-amber-600) 30%, var(--mo-neutral-3))",
		on: "var(--mo-amber-300)",
		hover: "color-mix(in srgb, var(--mo-amber-600) 42%, var(--mo-neutral-3))",
		border: "var(--mo-amber-700)",
		ring: "var(--mo-amber-500)",
		active: "color-mix(in srgb, var(--mo-amber-600) 50%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-amber-600) 14%, var(--mo-neutral-3))",
	},
	/** Caution — the red family, quiet by default in the Doxa register. */
	caution: {
		surface: "var(--mo-red-700)",
		on: "var(--mo-red-300)",
		hover: "color-mix(in srgb, var(--mo-red-700) 86%, var(--mo-red-300))",
		border: "var(--mo-red-400)",
		ring: "var(--mo-red-400)",
		active: "color-mix(in srgb, var(--mo-red-700) 78%, var(--mo-red-400))",
		disabled: "color-mix(in srgb, var(--mo-red-700) 40%, var(--mo-neutral-3))",
	},
	/** Success — the green family. */
	success: {
		surface: "var(--mo-green-700)",
		on: "var(--mo-green-400)",
		hover: "color-mix(in srgb, var(--mo-green-700) 86%, var(--mo-green-400))",
		border: "var(--mo-green-500)",
		ring: "var(--mo-green-500)",
		active: "color-mix(in srgb, var(--mo-green-700) 78%, var(--mo-green-400))",
		disabled: "color-mix(in srgb, var(--mo-green-700) 40%, var(--mo-neutral-3))",
	},
	/** Info — blue, brighter / more present than provenance. */
	info: {
		surface: "color-mix(in srgb, var(--mo-blue-700) 70%, var(--mo-neutral-3))",
		on: "var(--mo-blue-300)",
		hover: "color-mix(in srgb, var(--mo-blue-700) 80%, var(--mo-neutral-3))",
		border: "var(--mo-blue-500)",
		ring: "var(--mo-blue-500)",
		active: "color-mix(in srgb, var(--mo-blue-700) 88%, var(--mo-neutral-3))",
		disabled: "color-mix(in srgb, var(--mo-blue-700) 36%, var(--mo-neutral-3))",
	},
};

/* ------------------------------------------------------------------------- *
 * Archive-REGISTER extensions (vertical discourse roles). These are the
 * intent-layer vocabulary the editorial/archive register needs beyond the core
 * eight — the proof that a dialect EXTENDS the intent set (never the scale set).
 * Each is still a pure neutral-scale mapping. Authored trees opt into them by
 * name (`intent: "folio"`); they degrade to their `, fallback` in `slot()` when
 * a non-Archive dialect is active, so portability is preserved.
 * ------------------------------------------------------------------------- */

const ARCHIVE_REGISTER: Readonly<Record<string, IntentDefinition>> = {
	/** Folio / page-number register — the quietest label tone (mono, dim). */
	folio: {
		surface: "transparent",
		on: "color-mix(in srgb, var(--mo-neutral-10) 72%, transparent)",
		hover: "var(--mo-neutral-2)",
		border: "color-mix(in srgb, var(--mo-neutral-7) 50%, transparent)",
		ring: "var(--mo-neutral-8)",
		active: "var(--mo-neutral-3)",
		disabled: "transparent",
	},
	/** Marginalia — annotation/aside tone, a hair warmer than evidence. */
	marginalia: {
		surface: "color-mix(in srgb, var(--mo-neutral-4) 60%, var(--mo-neutral-2))",
		on: "var(--mo-neutral-9)",
		hover: "var(--mo-neutral-4)",
		border: "var(--mo-neutral-7)",
		ring: "var(--mo-neutral-8)",
		active: "var(--mo-neutral-5)",
		disabled: "color-mix(in srgb, var(--mo-neutral-4) 40%, var(--mo-neutral-2))",
	},
	/** Seal / authority mark — the amber beacon's grave sibling (deep, rare). */
	seal: {
		surface: "var(--mo-amber-700)",
		on: "var(--mo-amber-300)",
		hover: "color-mix(in srgb, var(--mo-amber-700) 84%, var(--mo-amber-500))",
		border: "var(--mo-amber-600)",
		ring: "var(--mo-amber-500)",
		active: "color-mix(in srgb, var(--mo-amber-700) 70%, var(--mo-amber-500))",
		disabled: "color-mix(in srgb, var(--mo-amber-700) 40%, var(--mo-neutral-3))",
	},
};

export const icelandicArchive: Dialect = {
	id: "icelandic-archive",
	label: "Icelandic Archive",
	persona: { vertical: "editorial-archive", role: "doxa" },
	intents: {
		...CORE,
		...ARCHIVE_REGISTER,
	},
	surfaces: ARCHIVE_SURFACES,
	priors: {
		// Doxa register: quiet density, the top of the tree allowed to be loud
		// (display headlines) but the beacon-budget kept to a single strong claim.
		rootDensity: "regular",
		rootScaleTier: 4,
		rootBudget: 3,
	},
	compounds: [],
};

/** The default dialect handle used when no persona-specialized dialect applies. */
export const DEFAULT_DIALECT: Dialect = icelandicArchive;

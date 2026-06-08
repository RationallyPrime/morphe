/**
 * The DEFAULT dialect: 'icelandic-archive'.
 *
 * This is the working default injection (Lemma 4 / Corollary 1: "a single
 * default dialect, and the system is exactly v0.2's"). It carries the Icelandic
 * Archive reading of the core intents as algebra priors; the actual core-intent
 * color values are the `:root`/`[data-mo-dialect="icelandic-archive"]` block in
 * tokens/intents.css, so this dialect's `intents` map is intentionally EMPTY of
 * overrides (it inherits the default CSS) — it exists to (a) name itself, (b)
 * set algebra priors, and (c) be the template every specialized dialect refines.
 *
 * A specialized dialect (e.g. hospitality-cfo, pharmaceutical-cto) would supply
 * an `intents` map adding vertical discourse roles mapped onto NEUTRAL scales,
 * and adjust priors — never escaping the bounds the provider clamps.
 */

import type { Dialect } from "./types.js";

export const icelandicArchive: Dialect = {
	id: "icelandic-archive",
	label: "Icelandic Archive",
	intents: {
		// No overrides: the core intents are defined in tokens/intents.css under
		// the matching [data-mo-dialect] selector. A specialized dialect would add
		// entries here, e.g. (illustrative):
		//   "accession-hold": { surface: "var(--mo-amber-700)", on: "var(--mo-amber-300)" }
	},
	priors: {
		rootDensity: "regular",
		rootScaleTier: 4,
		rootBudget: 3,
	},
	compounds: [],
};

/** The default dialect handle used when no persona-specialized dialect applies. */
export const DEFAULT_DIALECT: Dialect = icelandicArchive;

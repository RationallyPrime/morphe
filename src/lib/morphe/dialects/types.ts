/**
 * Morphe DIALECTS — Lemma 4 ("the persona stratum"), the type layer.
 *
 * A dialect is the τ_frame injection: an intent extension + bounded algebra
 * priors (+ a compound subset, which arrives with Phase 1's registry; the type
 * carries it now so the shape is stable). Re-dialecting is a fixed point for
 * anything authored (Lemma 3): authored trees reference intents, never scales,
 * so swapping the dialect only remaps the intent layer.
 *
 * Declarative only. The apply mechanism lives in provider.svelte.ts.
 */

import type { Density } from "../grammar/types.js";
import type { ScaleTier } from "../context/algebra.js";
import type { IntentChannel } from "../tokens/intents.js";

/**
 * An intent contributed/overridden by a dialect. The values are CSS color
 * expressions that MUST reference neutral SCALE vars (e.g.
 * `var(--mo-red-700)`), never literal hex — that is the discipline that keeps
 * the vertical out of the scale layer.
 */
export type IntentDefinition = Readonly<Partial<Record<IntentChannel, string>>>;

/**
 * The intent dialect: a map of intent name -> channel definitions. May extend
 * the core set with vertical discourse roles (e.g. `batch-release`) and may
 * override core intents' channel values, but (by the Lemma-4 refinement rule)
 * never renames core intents.
 */
export type IntentDialect = Readonly<Record<string, IntentDefinition>>;

/**
 * Bounded algebra priors: the root context a dialect installs, plus bounded
 * adjustments to the transform family. Bounds are enforced by `clampPriors`
 * (provider.svelte.ts) so a dialect can never escape the design system's range
 * — preserving Lemma 2's laws under any dialect (Lemma 4).
 */
export interface AlgebraPriors {
	/** Root density the dialect prefers (CFO: dense; CTO: regular, exception-led). */
	readonly rootDensity?: Density;
	/** Root scale tier (caps how loud the top of the tree may be). */
	readonly rootScaleTier?: ScaleTier;
	/** Root emphasis budget B. Bounded to a sane range by the provider. */
	readonly rootBudget?: number;
}

/** A compound-subset reference by name (Phase 1 wires the registry to this). */
export type CompoundDialect = readonly string[];

export interface Dialect {
	/** Stable id; also the value of the `data-mo-dialect` attribute. */
	readonly id: string;
	/** Human-readable name. */
	readonly label: string;
	/** The (vertical, role) persona this dialect serves, if specialized. */
	readonly persona?: { readonly vertical: string; readonly role?: string };
	/** Intent extension/override — the heart of the τ_frame injection. */
	readonly intents: IntentDialect;
	/** Bounded algebra priors. */
	readonly priors: AlgebraPriors;
	/** Allowed compound subset (empty in Phase 0). */
	readonly compounds: CompoundDialect;
}

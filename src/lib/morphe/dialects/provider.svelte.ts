/**
 * Morphe DIALECT PROVIDER — applies a Dialect (Lemma 4).
 *
 * Applying a dialect does three things:
 *   1. CLAMP its algebra priors into the design system's bounds (so Lemma 2's
 *      laws are preserved under any dialect — priors are bounded by construction).
 *   2. Produce the ROOT context the tree starts from (priors -> MorpheContext).
 *   3. Produce the CSS custom-property OVERRIDES the dialect injects at the root
 *      boundary (its intent extensions/overrides), plus the `data-mo-dialect`
 *      attribute value selecting the base intent block in tokens/intents.css.
 *
 * The provider is intentionally pure data-in/data-out (no Svelte calls), so it is
 * trivially testable; the Renderer's root component spreads the result.
 */

import { type MorpheContext, ROOT_CONTEXT, type ScaleTier } from "../context/algebra.js";
import { intentVar } from "../tokens/intents.js";
import type { Dialect } from "./types.js";

/** Bounds within which a dialect's priors are clamped (the "bounded" in L4). */
const PRIOR_BOUNDS = {
	minBudget: 1,
	maxBudget: 6,
	minScaleTier: 2 as ScaleTier,
	maxScaleTier: 4 as ScaleTier,
} as const;

export interface AppliedDialect {
	/** Value for the `data-mo-dialect` attribute (selects the base intent block). */
	readonly attr: string;
	/** The clamped root context the tree starts from. */
	readonly rootContext: MorpheContext;
	/** CSS custom-property overrides to spread at the root boundary. */
	readonly vars: Readonly<Record<string, string>>;
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** Apply a dialect: clamp priors, build root context, collect intent overrides. */
export function applyDialect(dialect: Dialect): AppliedDialect {
	const priors = dialect.priors;

	const rootBudget = clamp(
		priors.rootBudget ?? ROOT_CONTEXT.emphasisBudget,
		PRIOR_BOUNDS.minBudget,
		PRIOR_BOUNDS.maxBudget,
	);
	const rootScaleTier = clamp(
		priors.rootScaleTier ?? ROOT_CONTEXT.scaleTier,
		PRIOR_BOUNDS.minScaleTier,
		PRIOR_BOUNDS.maxScaleTier,
	) as ScaleTier;

	const rootContext: MorpheContext = {
		...ROOT_CONTEXT,
		density: priors.rootDensity ?? ROOT_CONTEXT.density,
		scaleTier: rootScaleTier,
		emphasisBudget: rootBudget,
	};

	// Flatten the intent dialect into concrete CSS var overrides.
	const vars: Record<string, string> = {};
	for (const [intent, def] of Object.entries(dialect.intents)) {
		for (const [channel, value] of Object.entries(def)) {
			if (value !== undefined) {
				vars[intentVar(intent, channel as Parameters<typeof intentVar>[1])] = value;
			}
		}
	}

	return { attr: dialect.id, rootContext, vars };
}

/** Build the inline `style` string for the applied dialect's var overrides. */
export function dialectStyle(applied: AppliedDialect): string {
	return Object.entries(applied.vars)
		.map(([k, v]) => `${k}:${v}`)
		.join(";");
}

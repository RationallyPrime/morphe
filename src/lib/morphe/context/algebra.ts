/**
 * Morphe CONTEXT ALGEBRA — Lemma 2 ("Calm").
 *
 * A small context record is propagated DOWN the tree. Per-role transforms
 * compute `C_child = f(C_parent, role_child)`. The transforms belong to the
 * design system and are identical whether a human or a model authored the tree.
 *
 * THE FOUR LAWS (enforced by the STRUCTURE of these functions, and checkable as
 * property tests downstream):
 *
 *   1. LOCALITY — a node's resolved context is a function of (C_parent, own
 *      role/claim) ONLY. `transform()` takes exactly the parent context and the
 *      child's own descriptor; it reads nothing else. No action at a distance.
 *
 *   2. STABILITY — inserting a sibling changes a node's resolved tiers ONLY if
 *      an enumerated threshold rule fires. The only sibling-sensitive decision
 *      is `densityForCount()`, whose thresholds are an explicit, enumerated
 *      table (THRESHOLDS). Below/above a named threshold, results are constant,
 *      so adding a sibling that doesn't cross a boundary changes nothing.
 *
 *   3. MONOTONE-DEPTH — `scale_tier` is non-increasing as depth grows, UNTIL a
 *      Frame resets context. `transform()` for non-Frame roles never raises
 *      scale_tier; only `enterFrame()` may reset it upward.
 *
 *   4. BUDGET-CONSERVATION — rendered emphasis sums to <= B regardless of
 *      claims. Children CLAIM priority; `renormalizeBudget()` RENDERS emphasis
 *      by normalizing claims against the parent budget, with a hard cap on
 *      simultaneous top-tier emphasis. An author who marks everything critical
 *      gets a legible, renormalized view — not a wall of bold.
 *
 * Discrete tier decisions live in this record (carried via Svelte context).
 * Continuous values are emitted as CSS custom properties at boundaries
 * (see Context.svelte.ts -> boundaryVars). Container queries handle
 * browser-visible flex (a Stack with direction:auto), with no JS in that loop.
 */

import type { ContainerRole, Density, EmphasisClaim } from "../grammar/types.js";

/** Scale tier — a small discrete ladder; lower = smaller/quieter. */
export type ScaleTier = 0 | 1 | 2 | 3 | 4;

/** The propagated context record (Lemma 2, C = (...)). */
export interface MorpheContext {
	/** Nesting depth since the last Frame reset. */
	readonly depth: number;
	/** Discrete density tier. */
	readonly density: Density;
	/** Discrete scale tier (monotone non-increasing until a Frame reset). */
	readonly scaleTier: ScaleTier;
	/** Emphasis budget B available to the children of this node. */
	readonly emphasisBudget: number;
	/** Current surface this subtree paints onto. */
	readonly surface: "base" | "raised" | "sunken";
}

/** The root context every tree starts from (a dialect may override via priors). */
export const ROOT_CONTEXT: MorpheContext = {
	depth: 0,
	density: "regular",
	scaleTier: 4,
	emphasisBudget: 3,
	surface: "base",
};

/**
 * Enumerated STABILITY thresholds. The ONLY places where a sibling count is
 * allowed to change a resolved tier. Keeping them in one named table is what
 * makes the Stability law auditable: a change is stable unless it crosses one of
 * these boundaries.
 */
export const THRESHOLDS = {
	/** A container with >= this many children demotes density one step. */
	densityCrowdAt: 7,
	/** ...and a second step at this count. */
	densityPackAt: 13,
} as const;

/** Numeric weight a claim consumes from the budget. "muted" is free. */
const CLAIM_WEIGHT: Record<EmphasisClaim, number> = {
	muted: 0,
	normal: 1,
	strong: 2,
	critical: 3,
};

/** Hard cap on how many children may simultaneously render at top tier. */
export const TOP_TIER_CAP = 1;

/* ------------------------------------------------------------------------- *
 * Per-role density step on crowding (STABILITY law, the only count-sensitive
 * decision). Returns the density a container resolves to given its parent
 * density and its child count.
 * ------------------------------------------------------------------------- */
export function densityForCount(parent: Density, childCount: number): Density {
	const steps = ["spacious", "regular", "compact"] as const;
	let idx = steps.indexOf(parent);
	if (childCount >= THRESHOLDS.densityPackAt) idx += 2;
	else if (childCount >= THRESHOLDS.densityCrowdAt) idx += 1;
	const clamped = Math.min(idx, steps.length - 1);
	// idx is always >= 0 because parent is a valid Density; clamp guards the top.
	return steps[clamped] ?? "compact";
}

/** Lower a scale tier by `n`, never below 0 (MONOTONE-DEPTH helper). */
function lowerTier(tier: ScaleTier, n: number): ScaleTier {
	const next = Math.max(0, tier - n);
	return next as ScaleTier;
}

/**
 * The per-role transform family `f(C_parent, role_child)`. LOCALITY: depends on
 * exactly the parent context and the child's own role + claim + child count.
 * MONOTONE-DEPTH: scaleTier is only ever lowered here, never raised.
 */
export function transform(
	parent: MorpheContext,
	role: ContainerRole,
	opts: { readonly childCount?: number; readonly claim?: EmphasisClaim } = {},
): MorpheContext {
	const childCount = opts.childCount ?? 0;
	const density = densityForCount(parent.density, childCount);

	// Each role demotes scale tier by a fixed, role-specific amount. This is the
	// "intent compiled into space" map; it is monotone (always >= 0 demotion).
	const demotion: Record<ContainerRole, number> = {
		page: 0,
		section: 1,
		panel: 1,
		toolbar: 2,
		list: 1,
		form: 1,
		"field-group": 1,
		inline: 0,
	};

	return {
		depth: parent.depth + 1,
		density,
		scaleTier: lowerTier(parent.scaleTier, demotion[role]),
		// The child's children inherit the (possibly reduced) budget of this node.
		emphasisBudget: parent.emphasisBudget,
		surface: parent.surface,
	};
}

/**
 * Frame reset (MONOTONE-DEPTH law's escape hatch). A Frame is the ONLY thing
 * permitted to re-root depth, reset scaleTier upward, and re-grant a budget.
 */
export function enterFrame(
	parent: MorpheContext,
	opts: {
		readonly surface?: "base" | "raised" | "sunken";
		readonly density?: Density;
		readonly budget?: number;
	} = {},
): MorpheContext {
	return {
		depth: 0,
		density: opts.density ?? parent.density,
		scaleTier: ROOT_CONTEXT.scaleTier,
		emphasisBudget: opts.budget ?? parent.emphasisBudget,
		surface: opts.surface ?? parent.surface,
	};
}

/** The rendered emphasis of a single child after renormalization. */
export type RenderedEmphasis = "muted" | "normal" | "strong" | "critical";

/**
 * BUDGET-CONSERVATION law. Children claim; this renders. Given the parent budget
 * B and the ordered list of child claims, return the rendered emphasis per child
 * such that the total weight is <= B and at most TOP_TIER_CAP children render at
 * the top tier. Excess claims are demoted in order (earlier children keep their
 * claim; later ones are renormalized down) so the result is deterministic and
 * stable under re-emission.
 */
export function renormalizeBudget(
	budget: number,
	claims: readonly EmphasisClaim[],
): RenderedEmphasis[] {
	let remaining = Math.max(0, budget);
	let topTierUsed = 0;
	const out: RenderedEmphasis[] = [];

	for (const claim of claims) {
		let rendered: EmphasisClaim = claim;

		// Cap simultaneous top-tier emphasis first.
		if (rendered === "critical" && topTierUsed >= TOP_TIER_CAP) {
			rendered = "strong";
		}

		// Then fit within the remaining budget by stepping down until it fits.
		while (CLAIM_WEIGHT[rendered] > remaining && rendered !== "muted") {
			rendered = stepDown(rendered);
		}

		remaining -= CLAIM_WEIGHT[rendered];
		if (rendered === "critical") topTierUsed += 1;
		out.push(rendered);
	}

	return out;
}

/** One step down the emphasis ladder. */
function stepDown(claim: EmphasisClaim): EmphasisClaim {
	switch (claim) {
		case "critical":
			return "strong";
		case "strong":
			return "normal";
		case "normal":
			return "muted";
		case "muted":
			return "muted";
	}
}

/**
 * Resolve a scale tier to the type-scale step name used by the CSS vars. Pure
 * mapping; the continuous value is emitted at the boundary.
 */
export function tierToTypeStep(tier: ScaleTier): string {
	// 0..4 -> type steps 4..8 (body..display). Quieter contexts read smaller.
	const map: Record<ScaleTier, string> = {
		0: "var(--mo-type-3)",
		1: "var(--mo-type-4)",
		2: "var(--mo-type-5)",
		3: "var(--mo-type-6)",
		4: "var(--mo-type-7)",
	};
	return map[tier];
}

/** Resolve density to the space-scale step used for a container's gap/padding. */
export function densityToSpaceStep(density: Density): string {
	switch (density) {
		case "compact":
			return "var(--mo-space-3)";
		case "regular":
			return "var(--mo-space-5)";
		case "spacious":
			return "var(--mo-space-7)";
	}
}

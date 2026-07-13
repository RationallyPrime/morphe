import type { Density, EmphasisClaim, Node, Vary, Within } from "../grammar/types.js";
import type { ChoiceMap } from "./envelope.js";

export type ResolvedWithin =
	| { readonly dimension: "density"; readonly choice: number; readonly value: Density }
	| { readonly dimension: "emphasis"; readonly choice: number; readonly value: EmphasisClaim }
	| { readonly dimension: "collapse"; readonly choice: number; readonly value: boolean };

const DENSITY_VALUES: readonly Density[] = ["compact", "regular", "spacious"];
const EMPHASIS_VALUES: readonly EmphasisClaim[] = ["muted", "normal", "strong", "critical"];

/** Resolve a Vary node to the selected option, falling back to its authored default. */
export function resolveVaryOption(node: Vary, choices: ChoiceMap | undefined): Node | undefined {
	if (node.options.length === 0) return undefined;
	const index = clampedIntegerChoice(
		node.id,
		node.default ?? 0,
		[0, node.options.length - 1],
		choices,
	);
	return node.options[index];
}

/**
 * Resolve a Within node to the existing algebra input it controls. This never
 * emits CSS; it maps bounded numeric movement back into the typed substrate.
 */
export function resolveWithin(node: Within, choices: ChoiceMap | undefined): ResolvedWithin {
	const choice = clampedIntegerChoice(node.id, node.default, node.range, choices);
	switch (node.dimension) {
		case "density":
			return { dimension: "density", choice, value: quantized(choice, node.range, DENSITY_VALUES) };
		case "emphasis":
			return {
				dimension: "emphasis",
				choice,
				value: quantized(choice, node.range, EMPHASIS_VALUES),
			};
		case "collapse":
			return { dimension: "collapse", choice, value: choice >= midpoint(node.range) };
	}
}

/**
 * Resolve the claim a parent should budget for the child it actually renders.
 * Vary delegates to its selected option. A targeted Within(emphasis) is itself
 * the claim socket. Density preserves its target's claim. Collapse establishes
 * a new visible disclosure boundary: its hidden target is budgeted locally by
 * that disclosure and consumes nothing from the outer sibling economy. Legacy
 * targetless Within leaves remain inert and claim nothing.
 */
export function resolveNodeEmphasisClaim(
	node: Node,
	choices: ChoiceMap | undefined,
): EmphasisClaim | undefined {
	if (node.kind === "vary") {
		const selected = resolveVaryOption(node, choices);
		return selected ? resolveNodeEmphasisClaim(selected, choices) : undefined;
	}
	if (node.kind === "within") {
		if (!node.target) return undefined;
		if (node.dimension === "collapse") return undefined;
		if (node.dimension === "emphasis") {
			const resolved = resolveWithin(node, choices);
			return resolved.dimension === "emphasis" ? resolved.value : undefined;
		}
		return resolveNodeEmphasisClaim(node.target, choices);
	}
	return "emphasis" in node && node.emphasis ? node.emphasis : undefined;
}

function clampedIntegerChoice(
	id: string,
	fallback: number,
	range: readonly [number, number],
	choices: ChoiceMap | undefined,
): number {
	const [lo, hi] = normalized(range);
	const raw = choices?.[id] ?? fallback;
	const integer = Number.isFinite(raw) ? Math.trunc(raw) : fallback;
	return Math.min(Math.max(integer, lo), hi);
}

function normalized(range: readonly [number, number]): readonly [number, number] {
	const [a, b] = range;
	return a <= b ? [a, b] : [b, a];
}

function midpoint(range: readonly [number, number]): number {
	const [lo, hi] = normalized(range);
	return lo + (hi - lo) / 2;
}

function quantized<T>(choice: number, range: readonly [number, number], values: readonly T[]): T {
	const [lo, hi] = normalized(range);
	if (values.length === 0) {
		throw new Error("Cannot quantize against an empty scale.");
	}
	if (hi === lo) return values[0] as T;
	const ratio = (choice - lo) / (hi - lo);
	const index = Math.min(Math.max(Math.round(ratio * (values.length - 1)), 0), values.length - 1);
	return values[index] as T;
}

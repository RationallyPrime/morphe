import type { Node, VaryId } from "../grammar/types.js";

/** Choices chosen by the mid loop, keyed by live variation ids in the tree. */
export type ChoiceMap = Readonly<Record<VaryId, number>>;

/**
 * Delegation-time wrapper around a pure authored tree.
 *
 * ADR-0004: epochs live here, never in `grammar/` and never in the renderer.
 */
export interface EmissionEnvelope {
	readonly epoch: number;
	readonly tree: Node;
	readonly choices: ChoiceMap;
}

/** A proposed mid-loop movement within the slow-loop-authorized variation space. */
export interface Delta {
	readonly id: VaryId;
	readonly choice: number;
	readonly epoch: number;
}

import { childrenOf } from "../compounds/factory.js";
import type { Node, VaryId } from "../grammar/types.js";
import type { Delta, EmissionEnvelope } from "./envelope.js";

export type ApplyDeltaResult = "applied" | "stale-epoch" | "unknown-id" | "out-of-range";

export interface ApplyDeltaOutcome {
	readonly envelope: EmissionEnvelope;
	readonly result: ApplyDeltaResult;
}

type ChoiceBounds = readonly [number, number];

/** Walk the authored tree and collect every live variation id. */
export function liveVaryIds(tree: Node): ReadonlySet<VaryId> {
	return new Set(choiceBoundsFor(tree).keys());
}

/**
 * Validate and apply a mid-loop delta against a slow-loop emission envelope.
 *
 * ADR-0004 boundary: epochs are consumed here, host-side and pre-render. The
 * tree is never mutated; accepted choices live only on the envelope.
 */
export function applyDelta(envelope: EmissionEnvelope, delta: Delta): ApplyDeltaOutcome {
	if (delta.epoch !== envelope.epoch) {
		return { envelope, result: "stale-epoch" };
	}

	const liveBounds = choiceBoundsFor(envelope.tree).get(delta.id);
	if (!liveBounds) {
		return { envelope, result: "unknown-id" };
	}

	if (!choiceFitsAll(liveBounds, delta.choice)) {
		return { envelope, result: "out-of-range" };
	}

	return {
		envelope: {
			...envelope,
			choices: { ...envelope.choices, [delta.id]: delta.choice },
		},
		result: "applied",
	};
}

function choiceBoundsFor(tree: Node): ReadonlyMap<VaryId, readonly ChoiceBounds[]> {
	const bounds = new Map<VaryId, ChoiceBounds[]>();
	const push = (id: VaryId, next: ChoiceBounds): void => {
		bounds.set(id, [...(bounds.get(id) ?? []), next]);
	};
	const walk = (node: Node): void => {
		switch (node.kind) {
			case "vary":
				push(node.id, [0, node.options.length - 1]);
				break;
			case "within":
				push(node.id, node.range);
				break;
		}
		for (const child of childrenOf(node)) walk(child);
	};
	walk(tree);
	return bounds;
}

function choiceFitsAll(bounds: readonly ChoiceBounds[], choice: number): boolean {
	return Number.isInteger(choice) && bounds.every(([lo, hi]) => choice >= lo && choice <= hi);
}

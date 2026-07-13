import { childrenOf, isNodeLike } from "../compounds/factory.js";
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
			// CompoundRef slot fills and node args are authored data the renderer
			// expands and honors choices inside — they are live (same walk contract
			// as unknownIntentsIn). Template internals need the registry and stay
			// out: applyDelta is pure and registry-free.
			case "compound":
				for (const fills of Object.values(node.slots ?? {})) {
					if (!Array.isArray(fills)) continue;
					for (const fill of fills) {
						if (isNodeLike(fill)) walk(fill);
					}
				}
				for (const arg of Object.values(node.args)) {
					if (isNodeLike(arg)) {
						walk(arg);
					} else if (Array.isArray(arg)) {
						for (const item of arg) {
							if (isNodeLike(item)) walk(item);
						}
					}
				}
				break;
		}
		for (const child of childrenOf(node)) walk(child);
	};
	walk(tree);
	return bounds;
}

function choiceFitsAll(bounds: readonly ChoiceBounds[], choice: number): boolean {
	return (
		Number.isInteger(choice) &&
		bounds.every(([first, second]) => {
			const lo = Math.min(first, second);
			const hi = Math.max(first, second);
			return choice >= lo && choice <= hi;
		})
	);
}

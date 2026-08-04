import type { CompoundResolver } from "../compounds/factory.js";
import { childrenOf, isNodeLike } from "../compounds/factory.js";
import type { Node, VaryId, Within } from "../grammar/types.js";
import type { Delta, EmissionEnvelope } from "./envelope.js";

export type ApplyDeltaResult = "applied" | "stale-epoch" | "unknown-id" | "out-of-range";

export interface ApplyDeltaOutcome {
	readonly envelope: EmissionEnvelope;
	readonly result: ApplyDeltaResult;
}

export type ChoiceBounds = readonly [number, number];

/** One authored socket occurrence. Duplicate ids intentionally retain every occurrence. */
export type LiveVariationOccurrence = LiveVaryOccurrence | LiveWithinOccurrence;

export interface LiveVaryOccurrence {
	readonly id: VaryId;
	readonly kind: "vary";
	readonly bounds: ChoiceBounds;
	readonly default: number;
	readonly objective?: "salience" | "density" | "compactness";
}

export interface LiveWithinOccurrence {
	readonly id: VaryId;
	readonly kind: "within";
	/** The authored range, preserved even when written high-to-low. */
	readonly range: ChoiceBounds;
	/** Alias used by shared Delta validation. */
	readonly bounds: ChoiceBounds;
	readonly default: number;
	readonly dimension: Within["dimension"];
}

/** All currently render-authorized occurrences for one variation id. */
export interface LiveVariationDescriptor {
	readonly id: VaryId;
	readonly occurrences: readonly LiveVariationOccurrence[];
}

/**
 * Pure evidence of the variation authority visible for one tree/resolver pair.
 * The descriptor order follows structural traversal, which makes duplicate-id
 * validation and evidence deterministic.
 */
export interface LiveVariationIndex {
	readonly descriptors: readonly LiveVariationDescriptor[];
}

/**
 * Resolver-aware discovery is opt-in so the historical registry-free behaviour
 * remains available to callers that only have authored data.
 */
export interface LiveVariationOptions {
	readonly resolver?: CompoundResolver;
}

/** A host that already bound one live index may reuse it for canonical admission. */
export interface ApplyDeltaOptions extends LiveVariationOptions {
	readonly index?: LiveVariationIndex;
}

/**
 * Collect the live variation authority for a tree.
 *
 * With a resolver, compound refs follow the renderer's exact admission rule:
 * invisible, unknown, and failed expansions render empty and authorize nothing.
 * Without one, retain the original registry-free walk: direct nodes plus authored
 * compound args/slots are visible, while template internals remain unavailable.
 */
export function liveVariationIndex(
	tree: Node,
	options: LiveVariationOptions = {},
): LiveVariationIndex {
	const occurrences = new Map<VaryId, LiveVariationOccurrence[]>();
	const add = (occurrence: LiveVariationOccurrence): void => {
		occurrences.set(occurrence.id, [...(occurrences.get(occurrence.id) ?? []), occurrence]);
	};

	const walkAuthored = (node: Node): void => {
		if (node.kind === "compound") {
			for (const fills of Object.values(node.slots ?? {})) {
				if (!Array.isArray(fills)) continue;
				for (const fill of fills) if (isNodeLike(fill)) walkAuthored(fill);
			}
			for (const arg of Object.values(node.args)) {
				if (isNodeLike(arg)) {
					walkAuthored(arg);
				} else if (Array.isArray(arg)) {
					for (const item of arg) if (isNodeLike(item)) walkAuthored(item);
				}
			}
			return;
		}
		addNodeOccurrence(node, add);
		for (const child of childrenOf(node)) walkAuthored(child);
	};

	const resolver = options.resolver;
	const walkResolved = (node: Node): void => {
		if (node.kind === "compound") {
			if (!resolver?.has(node.name)) return;
			try {
				walkResolved(resolver.expand(node));
			} catch {
				// Node.svelte catches the same corrupt visible reference and renders empty.
			}
			return;
		}
		addNodeOccurrence(node, add);
		for (const child of childrenOf(node)) walkResolved(child);
	};

	if (resolver) walkResolved(tree);
	else walkAuthored(tree);

	return freezeIndex(
		[...occurrences.entries()].map(([id, current]) => ({
			id,
			occurrences: current,
		})),
	);
}

/** Find one descriptor without exposing mutable lookup state. */
export function liveVariationFor(
	index: LiveVariationIndex,
	id: VaryId,
): LiveVariationDescriptor | undefined {
	return index.descriptors.find((descriptor) => descriptor.id === id);
}

/** Walk the authorized tree and collect every live variation id. */
export function liveVaryIds(tree: Node, options: LiveVariationOptions = {}): ReadonlySet<VaryId> {
	return new Set(liveVariationIndex(tree, options).descriptors.map((descriptor) => descriptor.id));
}

/**
 * Validate and apply a mid-loop delta against a slow-loop emission envelope.
 *
 * ADR-0004 boundary: epochs are consumed here, host-side and pre-render. The
 * tree is never mutated; accepted choices live only on the envelope.
 */
export function applyDelta(
	envelope: EmissionEnvelope,
	delta: Delta,
	options: ApplyDeltaOptions = {},
): ApplyDeltaOutcome {
	if (delta.epoch !== envelope.epoch) {
		return { envelope, result: "stale-epoch" };
	}

	const index = options.index ?? liveVariationIndex(envelope.tree, options);
	const descriptor = liveVariationFor(index, delta.id);
	if (!descriptor) {
		return { envelope, result: "unknown-id" };
	}

	if (
		!choiceFitsAll(
			descriptor.occurrences.map((occurrence) => occurrence.bounds),
			delta.choice,
		)
	) {
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

function addNodeOccurrence(node: Node, add: (occurrence: LiveVariationOccurrence) => void): void {
	switch (node.kind) {
		case "vary":
			add({
				id: node.id,
				kind: "vary",
				bounds: [0, node.options.length - 1],
				default: node.default ?? 0,
				objective: node.objective,
			});
			break;
		case "within":
			// A targetless Within is the documented compatibility leaf. It renders
			// inertly and therefore cannot mint mid-loop choice authority.
			if (node.target === undefined) break;
			add({
				id: node.id,
				kind: "within",
				range: node.range,
				bounds: node.range,
				default: node.default,
				dimension: node.dimension,
			});
			break;
	}
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

function freezeIndex(descriptors: readonly LiveVariationDescriptor[]): LiveVariationIndex {
	return Object.freeze({
		descriptors: Object.freeze(
			descriptors.map((descriptor) =>
				Object.freeze({
					id: descriptor.id,
					occurrences: Object.freeze(descriptor.occurrences.map(freezeOccurrence)),
				}),
			),
		),
	});
}

function freezeOccurrence(occurrence: LiveVariationOccurrence): LiveVariationOccurrence {
	if (occurrence.kind === "vary") {
		return Object.freeze({ ...occurrence, bounds: freezeBounds(occurrence.bounds) });
	}
	return Object.freeze({
		...occurrence,
		range: freezeBounds(occurrence.range),
		bounds: freezeBounds(occurrence.bounds),
	});
}

function freezeBounds(bounds: ChoiceBounds): ChoiceBounds {
	return Object.freeze([bounds[0], bounds[1]]) as ChoiceBounds;
}

import type { VaryId } from "../grammar/types.js";
import type { ContextDigest, ContextDigestVersion } from "../state/digest.js";
import type { Tier1Event, Tier1Kind } from "../state/events.js";
import type { JsonRecord, JsonValue } from "../state/json.js";
import {
	type LiveVariationDescriptor,
	type LiveVariationIndex,
	liveVariationFor,
} from "./applyDelta.js";
import type { Delta } from "./envelope.js";
import type { MidLoopDelegate } from "./midLoop.js";

export type DeterministicObjective = "salience" | "density" | "compactness";

/** Explicit authority granted to one deterministic policy target. */
export interface DeterministicPolicyTarget {
	readonly id: VaryId;
	readonly objective: DeterministicObjective;
	readonly allowedChoices: readonly number[];
}

/** The only interaction data a policy choice function may observe. */
export interface ProjectedContextDigest {
	readonly digestVersion: ContextDigestVersion;
	readonly state: JsonRecord;
	readonly recentEvents: readonly Tier1Event[];
}

export interface BoundDeterministicPolicyTarget extends DeterministicPolicyTarget {
	readonly variation: LiveVariationDescriptor;
}

export interface DeterministicPolicyChoiceInput {
	readonly digest: ProjectedContextDigest;
	readonly target: BoundDeterministicPolicyTarget;
}

/**
 * A deliberately small deterministic policy seam. It names authority directly;
 * it never derives authority or objectives from labels, prose, clicks, or ids.
 */
export interface DeterministicObjectivePolicy {
	readonly id: string;
	readonly targets: readonly DeterministicPolicyTarget[];
	readonly observableStorePaths: readonly string[];
	readonly observableTier1Kinds: readonly Tier1Kind[];
	readonly choose: (input: DeterministicPolicyChoiceInput) => number | undefined;
}

/** A policy bound once to the exact live variation authority of one emission. */
export interface BoundDeterministicObjectivePolicy {
	readonly id: string;
	readonly targets: readonly BoundDeterministicPolicyTarget[];
	readonly observableStorePaths: readonly string[];
	readonly observableTier1Kinds: readonly Tier1Kind[];
	readonly index: LiveVariationIndex;
	readonly choose: DeterministicObjectivePolicy["choose"];
}

export interface DeterministicObjectiveDelegateOptions {
	readonly policy: BoundDeterministicObjectivePolicy;
	readonly epoch: number;
}

/**
 * Bind policy targets to the tree/resolver-specific live index before any digest
 * arrives. Dead targets stay out of the delegate rather than gaining authority.
 */
export function bindDeterministicObjectivePolicy(
	policy: DeterministicObjectivePolicy,
	index: LiveVariationIndex,
): BoundDeterministicObjectivePolicy {
	const seen = new Set<VaryId>();
	const targets: BoundDeterministicPolicyTarget[] = [];
	for (const target of policy.targets) {
		if (seen.has(target.id)) {
			throw new Error(`Deterministic policy "${policy.id}" repeats target "${target.id}".`);
		}
		seen.add(target.id);
		const variation = liveVariationFor(index, target.id);
		if (!variation) continue;
		targets.push(
			Object.freeze({
				id: target.id,
				objective: target.objective,
				allowedChoices: Object.freeze([...target.allowedChoices]),
				variation,
			}),
		);
	}

	return Object.freeze({
		id: policy.id,
		targets: Object.freeze(targets),
		observableStorePaths: Object.freeze([...policy.observableStorePaths]),
		observableTier1Kinds: Object.freeze([...policy.observableTier1Kinds]),
		index,
		choose: policy.choose,
	});
}

/**
 * Project a complete digest into the exact visibility declared by the policy.
 * Values and events are cloned and frozen so a choice function cannot mutate its
 * input or hold a live reference to host state.
 */
export function projectContextDigest(
	digest: ContextDigest,
	policy: Pick<BoundDeterministicObjectivePolicy, "observableStorePaths" | "observableTier1Kinds">,
): ProjectedContextDigest {
	// Bind paths are opaque strings, so records are built via own-property
	// definition (fromEntries) — plain assignment would lose magic keys like
	// "__proto__" to the inherited setter.
	const stateEntries: [string, JsonValue][] = [];
	const paths = new Set(unique(policy.observableStorePaths));
	for (const path of paths) {
		if (Object.hasOwn(digest.state, path)) {
			stateEntries.push([path, cloneJson(digest.state[path] as JsonValue)]);
		}
	}
	const state = Object.fromEntries(stateEntries);
	const kinds = new Set(policy.observableTier1Kinds);
	const recentEvents = digest.recentEvents
		.filter((event) => kinds.has(event.kind) && paths.has(event.path))
		.map((event) =>
			Object.freeze({
				tier: 1 as const,
				kind: event.kind,
				path: event.path,
				value: cloneJson(event.value),
				at: event.at,
			}),
		);

	return Object.freeze({
		digestVersion: digest.digestVersion,
		state: freezeJsonRecord(state),
		recentEvents: Object.freeze(recentEvents),
	});
}

/**
 * Adapt a bound policy to the deliberately narrow `MidLoopDelegate` interface.
 * The delegate sees only the projected digest and policy-bound live descriptors.
 */
export function createDeterministicObjectiveDelegate(
	options: DeterministicObjectiveDelegateOptions,
): MidLoopDelegate {
	return {
		propose(digest, liveVaryIds): readonly Delta[] {
			const projected = projectContextDigest(digest, options.policy);
			const deltas: Delta[] = [];
			for (const target of options.policy.targets) {
				if (!liveVaryIds.has(target.id)) continue;
				const choice = options.policy.choose({ digest: projected, target });
				if (choice === undefined) continue;
				deltas.push({ id: target.id, choice, epoch: options.epoch });
			}
			return deltas;
		},
	};
}

function unique<T>(values: readonly T[]): readonly T[] {
	return [...new Set(values)];
}

function cloneJson(value: JsonValue): JsonValue {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}
	if (Array.isArray(value)) return value.map(cloneJson);
	// fromEntries: JSON.parse can mint own "__proto__" keys; assignment would drop them.
	return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]));
}

function freezeJsonRecord(value: Record<string, JsonValue>): JsonRecord {
	for (const child of Object.values(value)) freezeJson(child);
	return Object.freeze(value);
}

function freezeJson<T extends JsonValue>(value: T): T {
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) freezeJson(child);
		Object.freeze(value);
	}
	return value;
}

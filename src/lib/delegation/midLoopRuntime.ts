import type { VaryId } from "../grammar/types.js";
import type { ContextDigest } from "../state/digest.js";
import type {
	ApplyDeltaResult,
	ChoiceBounds,
	LiveVariationDescriptor,
	LiveVariationOccurrence,
} from "./applyDelta.js";
import { applyDelta } from "./applyDelta.js";
import type { ChoiceMap, Delta, EmissionEnvelope } from "./envelope.js";
import type { MidLoopDelegate } from "./midLoop.js";
import {
	type BoundDeterministicObjectivePolicy,
	type BoundDeterministicPolicyTarget,
	type DeterministicObjective,
	type ProjectedContextDigest,
	projectContextDigest,
} from "./objectivePolicy.js";

export type MidLoopEvidenceStatus = "proposed" | "accepted" | "rejected" | "superseded";
export type MidLoopEvidenceSource = "delegate" | "user" | "host";
export type MidLoopEvidenceReason =
	| ApplyDeltaResult
	| "delegate-threw"
	| "malformed-proposals"
	| "malformed-proposal"
	| "out-of-policy-target"
	| "out-of-policy-choice"
	| "user-lock"
	| "user-override"
	| "epoch-reemitted"
	| "invalid-reemission-epoch";

/**
 * A pure, externally-owned runtime state. It deliberately contains no clock,
 * I/O handle, store, Svelte state, or mutable global process state.
 */
export interface MidLoopRuntimeState {
	readonly envelope: EmissionEnvelope;
	readonly lockedIds: readonly VaryId[];
	readonly nextSequence: number;
	readonly nextGroup: number;
}

export interface MidLoopRuntime {
	readonly delegate: MidLoopDelegate;
	readonly policy: BoundDeterministicObjectivePolicy;
}

/** Immutable evidence for one ingress/proposal disposition. */
export interface MidLoopEvidenceRecord {
	readonly sequence: number;
	readonly group: number;
	readonly status: MidLoopEvidenceStatus;
	readonly source: MidLoopEvidenceSource;
	readonly policyId: string;
	readonly objective?: DeterministicObjective;
	readonly digest: ProjectedContextDigest;
	readonly envelopeEpoch: number;
	readonly proposal?: Delta;
	readonly liveVariations: readonly LiveVariationDescriptor[];
	/** The canonical structural admission result when a parseable Delta reached it. */
	readonly result?: ApplyDeltaResult;
	readonly reason?: MidLoopEvidenceReason;
	/** The prior accepted choice when a user override replaces it. */
	readonly supersededChoice?: number;
	readonly choices: ChoiceMap;
}

export interface MidLoopRuntimeResult {
	readonly state: MidLoopRuntimeState;
	readonly records: readonly MidLoopEvidenceRecord[];
}

/** Start a pure host-owned runtime state for one emitted envelope. */
export function createMidLoopRuntimeState(envelope: EmissionEnvelope): MidLoopRuntimeState {
	return Object.freeze({
		envelope,
		lockedIds: Object.freeze([]),
		nextSequence: 0,
		nextGroup: 0,
	});
}

/**
 * Run one delegate ingress. The delegate receives the projected digest, never
 * the host's complete ContextDigest, and all runtime-unknown output fails closed.
 */
export function runMidLoop(
	runtime: MidLoopRuntime,
	state: MidLoopRuntimeState,
	digest: ContextDigest,
): MidLoopRuntimeResult {
	const group = state.nextGroup;
	const projected = projectContextDigest(digest, runtime.policy);
	const liveVariations = snapshotLiveVariations(runtime.policy);
	const ids = new Set(liveVariations.map((descriptor) => descriptor.id));

	let returned: unknown;
	try {
		returned = runtime.delegate.propose(projected, ids);
	} catch {
		return rejectIngress(
			runtime,
			state,
			group,
			projected,
			liveVariations,
			"delegate",
			"delegate-threw",
		);
	}
	const proposed = snapshotProposalArray(returned);
	if (!proposed) {
		return rejectIngress(
			runtime,
			state,
			group,
			projected,
			liveVariations,
			"delegate",
			"malformed-proposals",
		);
	}

	return admitProposals(runtime, state, group, projected, liveVariations, "delegate", proposed);
}

/** A native/user proposal follows the same parser, policy gate, and Delta admission path. */
export function applyUserOverride(
	runtime: MidLoopRuntime,
	state: MidLoopRuntimeState,
	digest: ContextDigest,
	proposal: unknown,
): MidLoopRuntimeResult {
	const group = state.nextGroup;
	const projected = projectContextDigest(digest, runtime.policy);
	const liveVariations = snapshotLiveVariations(runtime.policy);
	return admitProposals(runtime, state, group, projected, liveVariations, "user", [proposal]);
}

/**
 * Only a strictly higher safe-integer epoch supersedes the old control turn and
 * clears user locks. Callers rebind the policy when the new envelope has a
 * different tree/resolver.
 */
export function reemitMidLoop(
	runtime: MidLoopRuntime,
	state: MidLoopRuntimeState,
	envelope: EmissionEnvelope,
	digest: ContextDigest,
): MidLoopRuntimeResult {
	if (!isStrictlyNewEpoch(state.envelope.epoch, envelope.epoch)) {
		const projected = projectContextDigest(digest, runtime.policy);
		const record = evidence({
			sequence: state.nextSequence,
			group: state.nextGroup,
			status: "rejected",
			source: "host",
			policyId: runtime.policy.id,
			digest: projected,
			envelopeEpoch: state.envelope.epoch,
			liveVariations: snapshotLiveVariations(runtime.policy),
			reason: "invalid-reemission-epoch",
			choices: state.envelope.choices,
		});
		return Object.freeze({
			state: Object.freeze({
				...state,
				nextSequence: state.nextSequence + 1,
				nextGroup: state.nextGroup + 1,
			}),
			records: Object.freeze([record]),
		});
	}
	const projected = projectContextDigest(digest, runtime.policy);
	const record = evidence({
		sequence: state.nextSequence,
		group: state.nextGroup,
		status: "superseded",
		source: "host",
		policyId: runtime.policy.id,
		digest: projected,
		envelopeEpoch: envelope.epoch,
		liveVariations: snapshotLiveVariations(runtime.policy),
		reason: "epoch-reemitted",
		choices: envelope.choices,
	});
	return Object.freeze({
		state: Object.freeze({
			envelope,
			lockedIds: Object.freeze([]),
			nextSequence: state.nextSequence + 1,
			nextGroup: state.nextGroup + 1,
		}),
		records: Object.freeze([record]),
	});
}

function admitProposals(
	runtime: MidLoopRuntime,
	initial: MidLoopRuntimeState,
	group: number,
	digest: ProjectedContextDigest,
	liveVariations: readonly LiveVariationDescriptor[],
	source: Extract<MidLoopEvidenceSource, "delegate" | "user">,
	proposals: readonly unknown[],
): MidLoopRuntimeResult {
	let envelope = initial.envelope;
	let lockedIds = initial.lockedIds;
	let sequence = initial.nextSequence;
	const records: MidLoopEvidenceRecord[] = [];

	for (const raw of proposals) {
		const proposal = parseDelta(raw);
		if (!proposal) {
			records.push(
				evidence({
					sequence,
					group,
					status: "rejected",
					source,
					policyId: runtime.policy.id,
					digest,
					envelopeEpoch: envelope.epoch,
					liveVariations,
					reason: "malformed-proposal",
					choices: envelope.choices,
				}),
			);
			sequence += 1;
			continue;
		}

		const target = targetFor(runtime.policy, proposal.id);
		records.push(
			evidence({
				sequence,
				group,
				status: "proposed",
				source,
				policyId: runtime.policy.id,
				objective: target?.objective,
				digest,
				envelopeEpoch: envelope.epoch,
				proposal,
				liveVariations,
				choices: envelope.choices,
			}),
		);
		sequence += 1;

		// Structural validation remains canonical, even for a proposal policy later rejects.
		const structural = applyDelta(envelope, proposal, { index: runtime.policy.index });
		if (structural.result !== "applied") {
			records.push(
				evidence({
					sequence,
					group,
					status: structural.result === "stale-epoch" ? "superseded" : "rejected",
					source,
					policyId: runtime.policy.id,
					objective: target?.objective,
					digest,
					envelopeEpoch: envelope.epoch,
					proposal,
					liveVariations,
					result: structural.result,
					reason: structural.result,
					choices: envelope.choices,
				}),
			);
			sequence += 1;
			continue;
		}

		if (!target) {
			records.push(
				evidence({
					sequence,
					group,
					status: "rejected",
					source,
					policyId: runtime.policy.id,
					digest,
					envelopeEpoch: envelope.epoch,
					proposal,
					liveVariations,
					result: structural.result,
					reason: "out-of-policy-target",
					choices: envelope.choices,
				}),
			);
			sequence += 1;
			continue;
		}
		if (!target.allowedChoices.includes(proposal.choice)) {
			records.push(
				evidence({
					sequence,
					group,
					status: "rejected",
					source,
					policyId: runtime.policy.id,
					objective: target.objective,
					digest,
					envelopeEpoch: envelope.epoch,
					proposal,
					liveVariations,
					result: structural.result,
					reason: "out-of-policy-choice",
					choices: envelope.choices,
				}),
			);
			sequence += 1;
			continue;
		}
		if (source === "delegate" && lockedIds.includes(proposal.id)) {
			records.push(
				evidence({
					sequence,
					group,
					status: "superseded",
					source,
					policyId: runtime.policy.id,
					objective: target.objective,
					digest,
					envelopeEpoch: envelope.epoch,
					proposal,
					liveVariations,
					result: structural.result,
					reason: "user-lock",
					choices: envelope.choices,
				}),
			);
			sequence += 1;
			continue;
		}

		const previousChoice = envelope.choices[proposal.id];
		if (source === "user" && previousChoice !== undefined && previousChoice !== proposal.choice) {
			records.push(
				evidence({
					sequence,
					group,
					status: "superseded",
					source,
					policyId: runtime.policy.id,
					objective: target.objective,
					digest,
					envelopeEpoch: envelope.epoch,
					proposal,
					liveVariations,
					result: structural.result,
					reason: "user-override",
					supersededChoice: previousChoice,
					choices: envelope.choices,
				}),
			);
			sequence += 1;
		}

		envelope = structural.envelope;
		if (source === "user") lockedIds = lock(lockedIds, proposal.id);
		records.push(
			evidence({
				sequence,
				group,
				status: "accepted",
				source,
				policyId: runtime.policy.id,
				objective: target.objective,
				digest,
				envelopeEpoch: envelope.epoch,
				proposal,
				liveVariations,
				result: structural.result,
				choices: envelope.choices,
			}),
		);
		sequence += 1;
	}

	return Object.freeze({
		state: Object.freeze({
			envelope,
			lockedIds,
			nextSequence: sequence,
			nextGroup: group + 1,
		}),
		records: Object.freeze(records),
	});
}

function rejectIngress(
	runtime: MidLoopRuntime,
	state: MidLoopRuntimeState,
	group: number,
	digest: ProjectedContextDigest,
	liveVariations: readonly LiveVariationDescriptor[],
	source: Extract<MidLoopEvidenceSource, "delegate" | "user">,
	reason: Extract<MidLoopEvidenceReason, "delegate-threw" | "malformed-proposals">,
): MidLoopRuntimeResult {
	const record = evidence({
		sequence: state.nextSequence,
		group,
		status: "rejected",
		source,
		policyId: runtime.policy.id,
		digest,
		envelopeEpoch: state.envelope.epoch,
		liveVariations,
		reason,
		choices: state.envelope.choices,
	});
	return Object.freeze({
		state: Object.freeze({
			...state,
			nextSequence: state.nextSequence + 1,
			nextGroup: group + 1,
		}),
		records: Object.freeze([record]),
	});
}

function targetFor(
	policy: BoundDeterministicObjectivePolicy,
	id: VaryId,
): BoundDeterministicPolicyTarget | undefined {
	return policy.targets.find((target) => target.id === id);
}

function parseDelta(value: unknown): Delta | undefined {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
	try {
		const id = ownDataProperty(value, "id");
		const choice = ownDataProperty(value, "choice");
		const epoch = ownDataProperty(value, "epoch");
		if (typeof id !== "string" || typeof choice !== "number" || typeof epoch !== "number") {
			return undefined;
		}
		if (!Number.isFinite(choice) || !Number.isFinite(epoch)) return undefined;
		return Object.freeze({ id, choice, epoch });
	} catch {
		return undefined;
	}
}

/**
 * Upper bound on a single proposal packet. A meaningful packet carries at most
 * one delta per live variation, and admission emits up to two evidence records
 * per element, so an unbounded packet is a memory/event-loop exhaustion route.
 * Far above any real envelope; anything larger is malformed ingress.
 */
export const MAX_PROPOSAL_PACKET_LENGTH = 64;

/**
 * Detach an untrusted delegate's array before admission. A revoked proxy,
 * throwing iterator, oversized packet, or non-array response is malformed
 * ingress rather than a route to a host exception or mutable proposal list.
 * The copy is an index loop bounded by the checked length so a hostile
 * Symbol.iterator can never feed it more elements than declared.
 */
function snapshotProposalArray(value: unknown): readonly unknown[] | undefined {
	try {
		if (!Array.isArray(value)) return undefined;
		const length = value.length;
		if (!Number.isSafeInteger(length) || length < 0 || length > MAX_PROPOSAL_PACKET_LENGTH) {
			return undefined;
		}
		const snapshot: unknown[] = [];
		for (let index = 0; index < length; index += 1) snapshot.push(value[index]);
		return Object.freeze(snapshot);
	} catch {
		return undefined;
	}
}

function ownDataProperty(value: object, key: string): unknown {
	const descriptor = Object.getOwnPropertyDescriptor(value, key);
	return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function lock(ids: readonly VaryId[], id: VaryId): readonly VaryId[] {
	return Object.freeze(ids.includes(id) ? [...ids] : [...ids, id]);
}

function snapshotLiveVariations(
	policy: BoundDeterministicObjectivePolicy,
): readonly LiveVariationDescriptor[] {
	return Object.freeze(
		policy.index.descriptors.map((descriptor) =>
			Object.freeze({
				id: descriptor.id,
				occurrences: Object.freeze(descriptor.occurrences.map(snapshotOccurrence)),
			}),
		),
	);
}

function snapshotOccurrence(occurrence: LiveVariationOccurrence): LiveVariationOccurrence {
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

function isStrictlyNewEpoch(current: number, next: number): boolean {
	return Number.isSafeInteger(current) && Number.isSafeInteger(next) && next > current;
}

function evidence(
	input: Omit<MidLoopEvidenceRecord, "choices" | "liveVariations"> & {
		readonly choices: ChoiceMap;
		readonly liveVariations: readonly LiveVariationDescriptor[];
	},
): MidLoopEvidenceRecord {
	const proposal = input.proposal === undefined ? undefined : Object.freeze({ ...input.proposal });
	return Object.freeze({
		...input,
		...(proposal === undefined ? {} : { proposal }),
		liveVariations: input.liveVariations,
		choices: snapshotChoices(input.choices),
	});
}

function snapshotChoices(choices: ChoiceMap): ChoiceMap {
	// Vary ids are opaque strings: own-property definition (fromEntries) keeps
	// magic keys like "__proto__" that plain assignment would lose.
	const entries: [string, number][] = [];
	for (const id of Object.keys(choices).sort()) {
		const choice = choices[id];
		if (choice !== undefined) entries.push([id, choice]);
	}
	return Object.freeze(Object.fromEntries(entries)) as ChoiceMap;
}

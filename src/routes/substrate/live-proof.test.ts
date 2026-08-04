import { describe, expect, it } from "vitest";
import {
	applyUserOverride,
	bindDeterministicObjectivePolicy,
	commitTier1,
	createDeterministicObjectiveDelegate,
	createInMemoryMorpheStore,
	createMidLoopRuntimeState,
	digestOf,
	getDialect,
	liveVariationIndex,
	reemitMidLoop,
	registry,
	restrictCompounds,
	runMidLoop,
} from "$lib";
import { LIVE_PROOF_IDS, LIVE_PROOF_STORE_PATH } from "../_playground/live-proof-contract.js";
import { presentVaryDelta } from "../_playground/presenters.js";
import { LIVE_PROOF_POLICY } from "./live-proof.js";

const tree = presentVaryDelta();
const resolver = restrictCompounds(registry, { allow: getDialect("gallery").compounds });
const index = liveVariationIndex(tree, { resolver });
const policy = bindDeterministicObjectivePolicy(LIVE_PROOF_POLICY, index);

function runtimeFor(epoch: number) {
	return {
		policy,
		delegate: createDeterministicObjectiveDelegate({ policy, epoch }),
	};
}

function evidenceStore(preference: "compact" | "evidence" | "decision" = "evidence") {
	return createInMemoryMorpheStore({ [LIVE_PROOF_STORE_PATH]: preference }, { now: () => 0 });
}

describe("/substrate deterministic live proof", () => {
	it("binds one declared policy to the resolver-authorized direct socket census", () => {
		expect(LIVE_PROOF_POLICY.observableStorePaths).toEqual([LIVE_PROOF_STORE_PATH]);
		expect(LIVE_PROOF_POLICY.observableTier1Kinds).toEqual(["selection"]);
		expect(policy.targets.map((target) => target.id)).toEqual([
			LIVE_PROOF_IDS.mode,
			LIVE_PROOF_IDS.density,
			LIVE_PROOF_IDS.emphasis,
			LIVE_PROOF_IDS.detail,
		]);
		expect(index.descriptors.map((descriptor) => descriptor.id)).toEqual([
			LIVE_PROOF_IDS.mode,
			LIVE_PROOF_IDS.density,
			LIVE_PROOF_IDS.emphasis,
			LIVE_PROOF_IDS.hostOnly,
			LIVE_PROOF_IDS.detail,
		]);
	});

	it("admits deterministic proposals and preserves structural failures in immutable evidence", () => {
		const store = evidenceStore();
		const digest = digestOf(store);
		let state = createMidLoopRuntimeState({ epoch: 1, tree, choices: {} });

		const initial = runMidLoop(runtimeFor(state.envelope.epoch), state, digest);
		state = initial.state;
		expect(initial.records.filter((record) => record.status === "accepted")).toHaveLength(4);
		expect(state.envelope.choices).toEqual({
			[LIVE_PROOF_IDS.mode]: 1,
			[LIVE_PROOF_IDS.density]: 1,
			[LIVE_PROOF_IDS.emphasis]: 1,
			[LIVE_PROOF_IDS.detail]: 0,
		});
		for (const record of initial.records) expect(Object.isFrozen(record)).toBe(true);

		const outOfPolicy = applyUserOverride(runtimeFor(state.envelope.epoch), state, digest, {
			id: LIVE_PROOF_IDS.hostOnly,
			choice: 1,
			epoch: state.envelope.epoch,
		});
		expect(outOfPolicy.records.at(-1)).toMatchObject({
			status: "rejected",
			result: "applied",
			reason: "out-of-policy-target",
			proposal: { id: LIVE_PROOF_IDS.hostOnly, choice: 1, epoch: 1 },
		});
		expect(outOfPolicy.state.envelope.choices[LIVE_PROOF_IDS.hostOnly]).toBeUndefined();

		const stale = applyUserOverride(runtimeFor(state.envelope.epoch), state, digest, {
			id: LIVE_PROOF_IDS.mode,
			choice: 0,
			epoch: state.envelope.epoch - 1,
		});
		expect(stale.records.at(-1)).toMatchObject({
			status: "superseded",
			result: "stale-epoch",
			reason: "stale-epoch",
		});
	});

	it("locks a user choice only for its epoch, then lets a newer re-emission clear it", () => {
		const store = evidenceStore("evidence");
		let state = createMidLoopRuntimeState({ epoch: 1, tree, choices: {} });
		state = runMidLoop(runtimeFor(1), state, digestOf(store)).state;

		commitTier1(store, LIVE_PROOF_STORE_PATH, "selection", "decision");
		const currentDigest = digestOf(store);
		const override = applyUserOverride(runtimeFor(1), state, currentDigest, {
			id: LIVE_PROOF_IDS.mode,
			choice: 0,
			epoch: 1,
		});
		state = override.state;
		expect(override.records.map((record) => record.reason)).toContain("user-override");
		expect(state.lockedIds).toEqual([LIVE_PROOF_IDS.mode]);

		const lockedRun = runMidLoop(runtimeFor(1), state, currentDigest);
		expect(lockedRun.records).toContainEqual(
			expect.objectContaining({
				status: "superseded",
				reason: "user-lock",
				proposal: expect.objectContaining({ id: LIVE_PROOF_IDS.mode, choice: 2, epoch: 1 }),
			}),
		);
		state = lockedRun.state;

		const reemitted = reemitMidLoop(
			runtimeFor(1),
			state,
			{ epoch: 2, tree, choices: {} },
			currentDigest,
		);
		state = reemitted.state;
		expect(reemitted.records).toContainEqual(
			expect.objectContaining({
				status: "superseded",
				reason: "epoch-reemitted",
				envelopeEpoch: 2,
			}),
		);
		expect(state.lockedIds).toEqual([]);

		const resumed = runMidLoop(runtimeFor(2), state, currentDigest);
		expect(resumed.records).toContainEqual(
			expect.objectContaining({
				status: "accepted",
				proposal: expect.objectContaining({ id: LIVE_PROOF_IDS.mode, choice: 2, epoch: 2 }),
			}),
		);
	});

	it("produces byte-stable results for identical state, digest, policy, and epoch", () => {
		const store = evidenceStore("decision");
		const digest = digestOf(store);
		const state = createMidLoopRuntimeState({ epoch: 8, tree, choices: {} });
		const runtime = runtimeFor(8);

		expect(JSON.stringify(runMidLoop(runtime, state, digest))).toBe(
			JSON.stringify(runMidLoop(runtime, state, digest)),
		);
	});
});

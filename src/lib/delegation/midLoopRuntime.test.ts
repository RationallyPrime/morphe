import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CompoundDef, CompoundRegistry, restrictCompounds } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { GRAMMAR_VERSION } from "../grammar/version.js";
import { CONTEXT_DIGEST_VERSION, type ContextDigest } from "../state/digest.js";
import type { Tier1Event } from "../state/events.js";
import {
	applyDelta,
	type LiveVariationIndex,
	liveVariationFor,
	liveVariationIndex,
	liveVaryIds,
} from "./applyDelta.js";
import type { ChoiceMap, EmissionEnvelope } from "./envelope.js";
import type { MidLoopDelegate } from "./midLoop.js";
import {
	applyUserOverride,
	createMidLoopRuntimeState,
	type MidLoopRuntime,
	reemitMidLoop,
	runMidLoop,
} from "./midLoopRuntime.js";
import {
	bindDeterministicObjectivePolicy,
	createDeterministicObjectiveDelegate,
	type DeterministicObjectivePolicy,
	type DeterministicPolicyTarget,
} from "./objectivePolicy.js";

const text = (value: string): Node => ({ kind: "text", value, as: "body" });

function vary(id: string): Node {
	return {
		kind: "vary",
		id,
		default: 0,
		options: [text(`${id}-a`), text(`${id}-b`)],
	};
}

function envelopeFor(tree: Node, epoch = 1, choices: ChoiceMap = {}): EmissionEnvelope {
	return { epoch, tree, choices };
}

function digest(
	state: ContextDigest["state"] = {},
	recentEvents: readonly Tier1Event[] = [],
): ContextDigest {
	return { digestVersion: CONTEXT_DIGEST_VERSION, state, recentEvents };
}

function policyFor(
	index: LiveVariationIndex,
	options: {
		readonly id?: string;
		readonly targets?: readonly DeterministicPolicyTarget[];
		readonly paths?: readonly string[];
		readonly kinds?: DeterministicObjectivePolicy["observableTier1Kinds"];
		readonly choose?: DeterministicObjectivePolicy["choose"];
	} = {},
) {
	return bindDeterministicObjectivePolicy(
		{
			id: options.id ?? "deterministic-test-policy",
			targets: options.targets ?? [
				{
					id: "mode",
					objective: "density",
					allowedChoices: [0, 1],
				},
			],
			observableStorePaths: options.paths ?? ["allowed"],
			observableTier1Kinds: options.kinds ?? ["selection"],
			choose: options.choose ?? (() => 1),
		},
		index,
	);
}

describe("deterministic mid-loop host core", () => {
	it("preserves the exact prior envelope for stale deltas", () => {
		const tree = vary("mode");
		const choices: ChoiceMap = Object.freeze({ mode: 0 });
		const envelope = envelopeFor(tree, 2, choices);

		const result = applyDelta(envelope, { id: "mode", choice: 1, epoch: 1 });

		expect(result.result).toBe("stale-epoch");
		expect(result.envelope).toBe(envelope);
		expect(result.envelope.tree).toBe(tree);
		expect(result.envelope.choices).toBe(choices);
	});

	it("discovers template sockets only through an authorized resolver expansion", () => {
		const registry = new CompoundRegistry();
		const definition = {
			name: "VariationTemplate",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: {
				type: "object",
				properties: { content: { type: "node", required: true } },
			},
			template: {
				kind: "stack",
				role: "section",
				children: [
					{
						kind: "vary",
						id: "template-mode",
						objective: "density",
						default: 0,
						options: [text("brief"), text("detailed")],
					},
					{
						kind: "within",
						id: "template-collapse",
						dimension: "collapse",
						range: [0, 1],
						default: 0,
						summary: "Details",
						target: text("Expanded details"),
					},
					{ kind: "param-ref", param: "content" },
					{ kind: "slot", name: "extension" },
				],
			},
		} satisfies CompoundDef;
		expect(registry.register(definition)).toMatchObject({ ok: true });

		const tree: Node = {
			kind: "compound",
			name: definition.name,
			args: { content: vary("call-site-arg-mode") },
			slots: { extension: [vary("call-site-mode")] },
		};
		const envelope = envelopeFor(tree);
		const visible = liveVariationIndex(tree, { resolver: registry });

		expect([...liveVaryIds(tree, { resolver: registry })]).toEqual([
			"template-mode",
			"template-collapse",
			"call-site-arg-mode",
			"call-site-mode",
		]);
		expect(liveVariationFor(visible, "template-mode")?.occurrences).toHaveLength(1);
		expect(liveVariationFor(visible, "template-collapse")?.occurrences).toHaveLength(1);
		expect(
			applyDelta(envelope, { id: "template-mode", choice: 1, epoch: 1 }, { resolver: registry })
				.result,
		).toBe("applied");
		expect(
			applyDelta(envelope, { id: "template-collapse", choice: 1, epoch: 1 }, { resolver: registry })
				.result,
		).toBe("applied");

		const invisible = restrictCompounds(registry, { allow: ["SomeOtherCompound"] });
		expect(liveVariationIndex(tree, { resolver: invisible }).descriptors).toEqual([]);
		for (const id of [
			"template-mode",
			"template-collapse",
			"call-site-arg-mode",
			"call-site-mode",
		]) {
			expect(
				applyDelta(envelope, { id, choice: 1, epoch: 1 }, { resolver: invisible }).result,
			).toBe("unknown-id");
		}

		const invalid: Node = {
			kind: "compound",
			name: definition.name,
			args: {
				content: vary("valid-content"),
				unexpected: vary("invalid-arg"),
			},
			slots: { extension: [vary("invalid-slot")] },
		};
		const unknown: Node = {
			kind: "compound",
			name: "MissingVariationTemplate",
			args: {},
			slots: { extension: [vary("unknown-slot")] },
		};
		expect(liveVariationIndex(invalid, { resolver: registry }).descriptors).toEqual([]);
		expect(liveVariationIndex(unknown, { resolver: registry }).descriptors).toEqual([]);
		expect(
			applyDelta(
				envelopeFor(invalid),
				{ id: "invalid-slot", choice: 1, epoch: 1 },
				{ resolver: registry },
			).result,
		).toBe("unknown-id");
		expect(
			applyDelta(
				envelopeFor(unknown),
				{ id: "unknown-slot", choice: 1, epoch: 1 },
				{ resolver: registry },
			).result,
		).toBe("unknown-id");
	});

	it("requires a choice to satisfy every duplicate-id occurrence", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				vary("shared"),
				{
					kind: "within",
					id: "shared",
					dimension: "density",
					range: [0, 2],
					default: 1,
					target: text("Duplicate authority target"),
				},
			],
		};
		const index = liveVariationIndex(tree);
		const envelope = envelopeFor(tree);

		expect(liveVariationFor(index, "shared")?.occurrences).toHaveLength(2);
		expect(applyDelta(envelope, { id: "shared", choice: 1, epoch: 1 }, { index }).result).toBe(
			"applied",
		);
		expect(applyDelta(envelope, { id: "shared", choice: 2, epoch: 1 }, { index }).result).toBe(
			"out-of-range",
		);
	});

	it("keeps legacy targetless Within leaves outside the live authority index", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{
					kind: "within",
					id: "legacy",
					dimension: "density",
					range: [0, 2],
					default: 1,
				},
				{
					kind: "within",
					id: "targeted",
					dimension: "density",
					range: [0, 2],
					default: 1,
					target: text("The actual target"),
				},
			],
		};
		const envelope = envelopeFor(tree);

		expect([...liveVaryIds(tree)]).toEqual(["targeted"]);
		expect(applyDelta(envelope, { id: "legacy", choice: 2, epoch: 1 }).result).toBe("unknown-id");
		expect(applyDelta(envelope, { id: "targeted", choice: 2, epoch: 1 }).result).toBe("applied");
	});

	it("copies and freezes authored variation bounds in live authority evidence", () => {
		const range: [number, number] = [0, 2];
		const tree: Node = {
			kind: "within",
			id: "targeted",
			dimension: "density",
			range,
			default: 1,
			target: text("Bounded target"),
		};
		const occurrence = liveVariationFor(liveVariationIndex(tree), "targeted")?.occurrences[0];

		expect(occurrence).toMatchObject({ range: [0, 2], bounds: [0, 2] });
		range[1] = 99;
		expect(occurrence).toMatchObject({ range: [0, 2], bounds: [0, 2] });
		expect(Object.isFrozen(occurrence?.bounds)).toBe(true);
		expect(Object.isFrozen(occurrence?.kind === "within" ? occurrence.range : undefined)).toBe(
			true,
		);
	});

	it("fails closed for thrown, malformed, dead, invalid, stale, and out-of-policy proposals", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [vary("mode"), vary("unowned")],
		};
		const envelope = envelopeFor(tree);
		const policy = policyFor(liveVariationIndex(tree), {
			targets: [{ id: "mode", objective: "density", allowedChoices: [0] }],
		});
		const initial = createMidLoopRuntimeState(envelope);

		const throws: MidLoopRuntime = {
			policy,
			delegate: {
				propose: () => {
					throw new Error("untrusted delegate");
				},
			},
		};
		const thrown = runMidLoop(throws, initial, digest());
		expect(thrown.state.envelope).toBe(envelope);
		expect(thrown.records).toHaveLength(1);
		expect(thrown.records[0]).toMatchObject({ status: "rejected", reason: "delegate-threw" });

		const malformedIngress: MidLoopRuntime = {
			policy,
			delegate: { propose: () => ({ not: "an array" }) as unknown as readonly [] },
		};
		const malformed = runMidLoop(malformedIngress, initial, digest());
		expect(malformed.state.envelope).toBe(envelope);
		expect(malformed.records[0]).toMatchObject({
			status: "rejected",
			reason: "malformed-proposals",
		});

		const revoked = Proxy.revocable<unknown[]>([], {});
		revoked.revoke();
		const hostileArray: MidLoopRuntime = {
			policy,
			delegate: { propose: () => revoked.proxy as unknown as readonly [] },
		};
		const hostile = runMidLoop(hostileArray, initial, digest());
		expect(hostile.state.envelope).toBe(envelope);
		expect(hostile.records[0]).toMatchObject({
			status: "rejected",
			reason: "malformed-proposals",
		});

		const adversarial: MidLoopDelegate = {
			propose: () =>
				[
					null,
					{ id: "dead", choice: 0, epoch: 1 },
					{ id: "mode", choice: 2, epoch: 1 },
					{ id: "mode", choice: 0, epoch: 0 },
					{ id: "unowned", choice: 1, epoch: 1 },
					{ id: "mode", choice: 1, epoch: 1 },
				] as unknown as readonly [],
		};
		const rejected = runMidLoop({ policy, delegate: adversarial }, initial, digest());

		expect(rejected.state.envelope).toBe(envelope);
		expect(rejected.records.map((record) => record.reason).filter(Boolean)).toEqual([
			"malformed-proposal",
			"unknown-id",
			"out-of-range",
			"stale-epoch",
			"out-of-policy-target",
			"out-of-policy-choice",
		]);
		expect(rejected.records.every((record) => record.status !== "accepted")).toBe(true);
	});

	it("projects declared evidence only and yields byte-stable receipts for equal inputs", () => {
		const tree = vary("mode");
		const policy = policyFor(liveVariationIndex(tree), {
			paths: ["allowed"],
			kinds: ["selection"],
			choose: ({ digest: visible }) =>
				visible.state.allowed === "go" && visible.recentEvents.length === 1 ? 1 : 0,
		});
		const runtime: MidLoopRuntime = {
			policy,
			delegate: createDeterministicObjectiveDelegate({ policy, epoch: 1 }),
		};
		const fullDigest = digest({ allowed: "go", hidden: "must not leak" }, [
			{ tier: 1, kind: "selection", path: "allowed", value: "go", at: 10 },
			{ tier: 1, kind: "selection", path: "hidden", value: "must not leak", at: 10 },
			{ tier: 1, kind: "filter-edit", path: "hidden", value: "must not leak", at: 11 },
		]);
		const ids = liveVaryIds(tree);
		const proposedFirst = runtime.delegate.propose(fullDigest, ids);
		const proposedSecond = runtime.delegate.propose(fullDigest, ids);

		expect(JSON.stringify(proposedFirst)).toBe(JSON.stringify(proposedSecond));
		expect(proposedFirst).toEqual([{ id: "mode", choice: 1, epoch: 1 }]);

		const first = runMidLoop(runtime, createMidLoopRuntimeState(envelopeFor(tree)), fullDigest);
		const second = runMidLoop(runtime, createMidLoopRuntimeState(envelopeFor(tree)), fullDigest);

		expect(JSON.stringify(first.records)).toBe(JSON.stringify(second.records));
		expect(JSON.stringify(first.state)).toBe(JSON.stringify(second.state));
		expect(first.records[0]?.digest).toStrictEqual({
			digestVersion: CONTEXT_DIGEST_VERSION,
			state: { allowed: "go" },
			recentEvents: [{ tier: 1, kind: "selection", path: "allowed", value: "go", at: 10 }],
		});
		expect(Object.isFrozen(first.records)).toBe(true);
		expect(Object.isFrozen(first.records[0]?.digest.state)).toBe(true);
		expect(first.state.envelope.choices).toEqual({ mode: 1 });
	});

	it("records delegate control, a user override lock, and epoch re-emission unlock", () => {
		const tree = vary("mode");
		const policy = policyFor(liveVariationIndex(tree));
		const initial = createMidLoopRuntimeState(envelopeFor(tree));
		const digestInput = digest({ allowed: "go" });
		const firstRuntime: MidLoopRuntime = {
			policy,
			delegate: createDeterministicObjectiveDelegate({ policy, epoch: 1 }),
		};

		const delegated = runMidLoop(firstRuntime, initial, digestInput);
		expect(delegated.records.map((record) => record.status)).toEqual(["proposed", "accepted"]);
		expect(delegated.records[1]).toMatchObject({
			proposal: { id: "mode", choice: 1, epoch: 1 },
			result: "applied",
		});
		expect(delegated.state.envelope.choices).toEqual({ mode: 1 });

		const overridden = applyUserOverride(firstRuntime, delegated.state, digestInput, {
			id: "mode",
			choice: 0,
			epoch: 1,
		});
		expect(overridden.records.map((record) => record.status)).toEqual([
			"proposed",
			"superseded",
			"accepted",
		]);
		expect(overridden.records[1]).toMatchObject({
			reason: "user-override",
			supersededChoice: 1,
		});
		expect(overridden.state.envelope.choices).toEqual({ mode: 0 });
		expect(overridden.state.lockedIds).toEqual(["mode"]);

		const blocked = runMidLoop(firstRuntime, overridden.state, digestInput);
		expect(blocked.records.map((record) => record.status)).toEqual(["proposed", "superseded"]);
		expect(blocked.records[1]).toMatchObject({ reason: "user-lock", result: "applied" });
		expect(blocked.state.envelope).toBe(overridden.state.envelope);

		for (const invalidEpoch of [1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
			const rejected = reemitMidLoop(
				firstRuntime,
				blocked.state,
				envelopeFor(tree, invalidEpoch),
				digestInput,
			);
			expect(rejected.records).toHaveLength(1);
			expect(rejected.records[0]).toMatchObject({
				status: "rejected",
				source: "host",
				reason: "invalid-reemission-epoch",
				envelopeEpoch: 1,
			});
			expect(rejected.state.envelope).toBe(blocked.state.envelope);
			expect(rejected.state.envelope.choices).toBe(blocked.state.envelope.choices);
			expect(rejected.state.lockedIds).toBe(blocked.state.lockedIds);
		}

		const reemittedEnvelope = envelopeFor(tree, 2);
		const reemitted = reemitMidLoop(firstRuntime, blocked.state, reemittedEnvelope, digestInput);
		expect(reemitted.records).toHaveLength(1);
		expect(reemitted.records[0]).toMatchObject({
			status: "superseded",
			source: "host",
			reason: "epoch-reemitted",
		});
		expect(reemitted.state.lockedIds).toEqual([]);

		const secondRuntime: MidLoopRuntime = {
			policy,
			delegate: createDeterministicObjectiveDelegate({ policy, epoch: 2 }),
		};
		const unlocked = runMidLoop(secondRuntime, reemitted.state, digestInput);
		expect(unlocked.records.map((record) => record.status)).toEqual(["proposed", "accepted"]);
		expect(unlocked.state.envelope.choices).toEqual({ mode: 1 });
	});

	it("keeps the host circuit out of renderer and grammar modules", () => {
		for (const source of [
			readFileSync(new URL("../render/Node.svelte", import.meta.url), "utf8"),
			readFileSync(new URL("../render/MorpheRoot.svelte", import.meta.url), "utf8"),
			readFileSync(new URL("../grammar/types.ts", import.meta.url), "utf8"),
		]) {
			expect(source).not.toContain("midLoopRuntime");
			expect(source).not.toContain("objectivePolicy");
		}
	});
});

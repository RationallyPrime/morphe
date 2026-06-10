import { describe, expect, it } from "vitest";
import type { Node, VaryId } from "../grammar/types.js";
import type { Delta, EmissionEnvelope } from "./envelope.js";

describe("delegation envelope types (ADR-0004)", () => {
	it("wrap a pure tree with epoch and choices outside the grammar", () => {
		const id = "density-panel" as VaryId;
		const tree: Node = { kind: "text", value: "slow-loop tree", as: "body" };
		const envelope = {
			epoch: 1,
			tree,
			choices: { [id]: 2 },
		} satisfies EmissionEnvelope;
		const delta = { epoch: 1, id, choice: 0 } satisfies Delta;

		expect(envelope.tree).toBe(tree);
		expect(envelope.choices[id]).toBe(2);
		expect(delta.id).toBe(id);
	});
});

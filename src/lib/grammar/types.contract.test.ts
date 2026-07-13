import { describe, expect, expectTypeOf, it } from "vitest";
import type { Within } from "./types.js";

const legacyCollapse: Within = {
	kind: "within",
	id: "legacy-collapse",
	dimension: "collapse",
	range: [0, 1],
	default: 1,
};

const targetedDensity: Within = {
	kind: "within",
	id: "targeted-density",
	dimension: "density",
	range: [0, 2],
	default: 1,
	target: { kind: "text", value: "Dense" },
};

const targetedCollapse: Within = {
	kind: "within",
	id: "targeted-collapse",
	dimension: "collapse",
	range: [0, 1],
	default: 1,
	target: { kind: "text", value: "Details" },
	summary: "More detail",
};

describe("generated Within contract", () => {
	it("keeps legacy and all valid targeted forms assignable", () => {
		expect([legacyCollapse, targetedDensity, targetedCollapse].map((node) => node.id)).toEqual([
			"legacy-collapse",
			"targeted-density",
			"targeted-collapse",
		]);
	});

	it("rejects target and summary combinations that the Pydantic contract rejects", () => {
		expectTypeOf<{
			kind: "within";
			id: "unnamed-targeted-collapse";
			dimension: "collapse";
			range: readonly [0, 1];
			default: 1;
			target: { kind: "text"; value: "Hidden without a label" };
		}>().not.toMatchTypeOf<Within>();
		expectTypeOf<{
			kind: "within";
			id: "summarized-density";
			dimension: "density";
			range: readonly [0, 2];
			default: 1;
			target: { kind: "text"; value: "Dense" };
			summary: "Unused";
		}>().not.toMatchTypeOf<Within>();
		expectTypeOf<{
			kind: "within";
			id: "targetless-summary";
			dimension: "collapse";
			range: readonly [0, 1];
			default: 1;
			summary: "Nothing owned";
		}>().not.toMatchTypeOf<Within>();
	});
});

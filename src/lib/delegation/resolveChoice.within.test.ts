import { describe, expect, it } from "vitest";
import type { Node } from "../grammar/types.js";
import { resolveNodeEmphasisClaim } from "./resolveChoice.js";

describe("choice-aware Within emphasis claims", () => {
	it("resolves a targeted emphasis socket from the current choice", () => {
		const node: Node = {
			kind: "within",
			id: "claim",
			dimension: "emphasis",
			range: [0, 3],
			default: 1,
			target: { kind: "text", value: "target", emphasis: "critical" },
		};
		expect(resolveNodeEmphasisClaim(node, { claim: 0 })).toBe("muted");
		expect(resolveNodeEmphasisClaim(node, { claim: 2 })).toBe("strong");
		expect(resolveNodeEmphasisClaim(node, { claim: 99 })).toBe("critical");
	});

	it("preserves density claims while collapse starts a local budget boundary", () => {
		const target: Node = { kind: "text", value: "target", emphasis: "strong" };
		const density: Node = {
			kind: "within",
			id: "density",
			dimension: "density",
			range: [0, 2],
			default: 1,
			target,
		};
		const collapse: Node = {
			kind: "within",
			id: "collapse",
			dimension: "collapse",
			range: [0, 1],
			default: 0,
			target,
			summary: "Target",
		};
		expect(resolveNodeEmphasisClaim(density, undefined)).toBe("strong");
		expect(resolveNodeEmphasisClaim(collapse, undefined)).toBeUndefined();
	});

	it("keeps legacy targetless Within leaves inert", () => {
		const node: Node = {
			kind: "within",
			id: "legacy",
			dimension: "emphasis",
			range: [0, 3],
			default: 3,
		};
		expect(resolveNodeEmphasisClaim(node, { legacy: 3 })).toBeUndefined();
	});
});

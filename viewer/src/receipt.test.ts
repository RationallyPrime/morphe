import { describe, expect, it } from "vitest";
import type { Sha256 } from "$lib/artifacts/source-types.generated.js";
import type { CompilationReceipt } from "$lib/surface-edge/spec.js";
import { createDeliveryReceipt } from "./receipt.js";

const sha = (digit: string): Sha256 => `sha256:${digit.repeat(64)}` as Sha256;

const compilation: CompilationReceipt = {
	sourceTestimonySha256: sha("1"),
	compilerVersion: "0.3.3",
	compilerBuildSha256: sha("2"),
	grammarVersion: "0.2.0",
	treeSha256: sha("3"),
	diagnosticsSha256: sha("4"),
};

describe("createDeliveryReceipt", () => {
	it("binds actual dialect policy and exact delivered tree without mutating compilation", async () => {
		const first = await createDeliveryReceipt(
			compilation,
			{ kind: "text", value: "first", as: "body" },
			"ledger",
		);
		const second = await createDeliveryReceipt(
			compilation,
			{ kind: "text", value: "second", as: "body" },
			"ledger",
		);
		expect(first.treeSha256).toBe(compilation.treeSha256);
		expect(first.deliveredTreeSha256).not.toBe(second.deliveredTreeSha256);
		expect(first.dialectPolicySha256).toBe(second.dialectPolicySha256);
		expect(first.dialectId).toBe("ledger");
		expect(Object.isFrozen(first)).toBe(true);
	});

	it("records the effective fallback dialect for an unknown hint", async () => {
		const receipt = await createDeliveryReceipt(
			compilation,
			{ kind: "text", value: "safe", as: "body" },
			"future-dialect",
		);
		expect(receipt.dialectId).toBe("gallery");
	});
});

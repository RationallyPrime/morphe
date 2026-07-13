import { describe, expect, it } from "vitest";
import { fromJSONSchema } from "zod";
import { validateNodeDocument, validateSurfaceArtifact } from "./surface.js";
import { SURFACE_ARTIFACT_JSON_SCHEMA } from "./surface-schema.generated.js";

const validArtifact = {
	artifact_version: "1.0.0",
	tree: { kind: "frame", role: "page", children: [{ kind: "spacer" }] },
	grammar_version: "0.1.0",
	producer_version: "0.2.0",
	compiler_version: "0.2.0",
	diagnostics: [],
	produced_at: "",
};

describe("validateSurfaceArtifact", () => {
	it("brands a complete generated-contract artifact", () => {
		const result = validateSurfaceArtifact(validArtifact);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.tree.kind).toBe("frame");
	});

	it("rejects a nested node failure", () => {
		const result = validateSurfaceArtifact({
			...validArtifact,
			tree: {
				kind: "frame",
				role: "page",
				children: [{ kind: "text", as: "heading" }],
			},
		});
		expect(result.ok).toBe(false);
	});

	it("preserves the Pydantic button accessible-name invariant", () => {
		expect(validateSurfaceArtifact({ ...validArtifact, tree: { kind: "button" } }).ok).toBe(false);
	});

	it("button invariant is walk-enforced: zod drops the generated top-level anyOf", () => {
		// Pins the zod `fromJSONSchema` gap that makes semanticNodeIssue load-bearing:
		// the schema alone ACCEPTS a bare button (the accessible-name anyOf is silently
		// dropped), while the composite gate rejects it. If zod ever honors the anyOf,
		// this test fails — revisit whether the walk is still the sole enforcer.
		const schemaAlone = fromJSONSchema({
			$schema: SURFACE_ARTIFACT_JSON_SCHEMA.$schema,
			$ref: "#/$defs/Node",
			$defs: SURFACE_ARTIFACT_JSON_SCHEMA.$defs,
		} as Parameters<typeof fromJSONSchema>[0]);
		expect(schemaAlone.safeParse({ kind: "button" }).success).toBe(true);
		expect(validateNodeDocument({ kind: "button" }).ok).toBe(false);
	});

	it("rejects producer metadata drift", () => {
		const result = validateSurfaceArtifact({ ...validArtifact, producer_version: "0.1.0" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues[0]?.code).toBe("metadata");
	});

	it("bounds input before recursive schema evaluation", () => {
		let tree: unknown = { kind: "spacer" };
		for (let depth = 0; depth < 20; depth += 1) {
			tree = { kind: "frame", role: "section", children: [tree] };
		}
		const result = validateSurfaceArtifact({ ...validArtifact, tree }, { maxDepth: 10 });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues[0]?.code).toBe("depth-limit");
	});
});

describe("validateNodeDocument", () => {
	it("shares the generated grammar gate with non-surface artifact readers", () => {
		expect(validateNodeDocument({ kind: "text", value: "valid" }).ok).toBe(true);
		expect(validateNodeDocument({ kind: "text" }).ok).toBe(false);
	});
});

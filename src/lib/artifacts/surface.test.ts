import { describe, expect, it } from "vitest";
import { fromJSONSchema } from "zod";
import { validateNodeDocument, validateSurfaceArtifact } from "./surface.js";
import { SURFACE_ARTIFACT_JSON_SCHEMA } from "./surface-schema.generated.js";

const validArtifact = {
	artifact_version: "1.0.0",
	tree: { kind: "frame", role: "page", children: [{ kind: "spacer" }] },
	grammar_version: "0.2.0",
	producer_version: "0.2.0",
	compiler_version: "0.2.0",
	diagnostics: [],
	produced_at: "",
};

function targetedCollapse(summary: string): Record<string, unknown> {
	return {
		kind: "within",
		id: "visible-summary",
		dimension: "collapse",
		range: [0, 1],
		default: 1,
		target: { kind: "text", value: "Details" },
		summary,
	};
}

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

	it("preserves semantic invariants inside a targeted Within", () => {
		const result = validateSurfaceArtifact({
			...validArtifact,
			tree: {
				kind: "within",
				id: "semantic-target",
				dimension: "density",
				range: [0, 2],
				default: 1,
				target: { kind: "button" },
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues[0]?.path).toEqual(["tree", "target"]);
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

	it.each([
		["density", undefined],
		["emphasis", undefined],
		["collapse", "More detail"],
	] as const)("accepts a targeted %s Within", (dimension, summary) => {
		const tree: Record<string, unknown> = {
			kind: "within",
			id: `targeted-${dimension}`,
			dimension,
			range: [0, 1],
			default: 1,
			target: { kind: "text", value: "Adapt me" },
		};
		if (summary !== undefined) tree.summary = summary;
		expect(validateNodeDocument(tree).ok).toBe(true);
	});

	it.each([
		{
			kind: "within",
			id: "missing-summary",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			target: { kind: "text", value: "Adapt me" },
		},
		{
			kind: "within",
			id: "null-summary",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary: null,
			target: { kind: "text", value: "Adapt me" },
		},
		{
			kind: "within",
			id: "blank-summary",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary: "  \t",
			target: { kind: "text", value: "Adapt me" },
		},
		{
			kind: "within",
			id: "null-target",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary: "More detail",
			target: null,
		},
		{
			kind: "within",
			id: "irrelevant-summary",
			dimension: "density",
			range: [0, 1],
			default: 1,
			summary: "Unused",
			target: { kind: "text", value: "Adapt me" },
		},
	])("rejects an inaccessible targeted Within: $id", (tree) => {
		expect(validateNodeDocument(tree).ok).toBe(false);
	});

	it.each([
		["U+0085", "\u0085"],
		["U+200B", "\u200b"],
		["U+FEFF", "\ufeff"],
	] as const)("rejects invisible collapse summary %s through the generated-schema ingress", (_label, summary) => {
		expect(validateNodeDocument(targetedCollapse(summary)).ok).toBe(false);
	});

	it.each([
		"Ísland",
		"東京",
		"😀",
		"\u200bÍsland\ufeff",
		"\u0085東京",
		"\ufeff😀",
	])("accepts visible Unicode collapse summary %s through the generated-schema ingress", (summary) => {
		expect(validateNodeDocument(targetedCollapse(summary)).ok).toBe(true);
	});

	it.each([
		[
			"container children",
			{ kind: "frame", role: "page", children: [{ kind: "button" }] },
			["children", 0],
		],
		["Vary options", { kind: "vary", id: "choice", options: [{ kind: "button" }] }, ["options", 0]],
		[
			"Slot fallback",
			{ kind: "slot", name: "body", fallback: [{ kind: "button" }] },
			["fallback", 0],
		],
		[
			"Within target",
			{
				kind: "within",
				id: "target",
				dimension: "density",
				range: [0, 2],
				default: 1,
				target: { kind: "button" },
			},
			["target"],
		],
		[
			"compound node argument",
			{
				kind: "compound",
				name: "ConsumerCard",
				args: { content: { kind: "button" } },
			},
			["args", "content"],
		],
		[
			"compound node-list argument",
			{
				kind: "compound",
				name: "ConsumerCard",
				args: { content: [{ kind: "button" }] },
			},
			["args", "content", 0],
		],
		[
			"compound slot fill",
			{
				kind: "compound",
				name: "ConsumerCard",
				args: {},
				slots: { body: [{ kind: "button" }] },
			},
			["slots", "body", 0],
		],
	] as const)("reports the semantic path through %s", (_label, tree, expectedPath) => {
		const result = validateNodeDocument(tree);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues[0]?.path).toEqual(expectedPath);
	});
});

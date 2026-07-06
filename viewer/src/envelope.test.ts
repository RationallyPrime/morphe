import { describe, expect, it } from "vitest";
import { isValidArtifactId, parseSurfaceEnvelope } from "./envelope.js";

const validBody = {
	artifact_id: "surface:capability-page:run-42",
	recipe_name: "capability-page",
	run_id: "run-42",
	trace_id: "trace-1",
	grammar_version: "0.1.0",
	compiler_version: "0.1.0",
	produced_at: "2026-07-06T00:00:00Z",
	dialect_hint: "ledger",
	diagnostic_count: 0,
	artifact_sequence: 1,
	stored_at: "2026-07-06T00:00:01Z",
	artifact: {
		tree: { kind: "frame", role: "page", surface: "base", children: [] },
		grammar_version: "0.1.0",
		producer_version: "0.1.0",
		diagnostics: [],
		produced_at: "2026-07-06T00:00:00Z",
		compiler_version: "0.1.0",
	},
};

describe("parseSurfaceEnvelope", () => {
	it("parses the topos SurfaceArtifactResponse shape", () => {
		const result = parseSurfaceEnvelope(validBody);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.artifactId).toBe("surface:capability-page:run-42");
		expect(result.envelope.grammarVersion).toBe("0.1.0");
		expect(result.envelope.dialectHint).toBe("ledger");
		expect(result.envelope.tree.kind).toBe("frame");
	});

	it.each([
		["non-object body", "nope"],
		["missing artifact_id", { ...validBody, artifact_id: undefined }],
		["missing grammar_version", { ...validBody, grammar_version: undefined }],
		["missing compiler_version", { ...validBody, compiler_version: undefined }],
		["missing dialect_hint", { ...validBody, dialect_hint: undefined }],
		["missing artifact", { ...validBody, artifact: undefined }],
		["artifact without tree", { ...validBody, artifact: { grammar_version: "0.1.0" } }],
		["tree without kind", { ...validBody, artifact: { tree: { role: "page" } } }],
		["empty grammar_version", { ...validBody, grammar_version: "" }],
	])("rejects %s", (_label, body) => {
		expect(parseSurfaceEnvelope(body).ok).toBe(false);
	});

	it("keeps the artifact's own grammar stamp out of the gate (envelope field wins)", () => {
		const drifted = {
			...validBody,
			grammar_version: "9.9.9",
			artifact: { ...validBody.artifact, grammar_version: "0.1.0" },
		};
		const result = parseSurfaceEnvelope(drifted);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.grammarVersion).toBe("9.9.9");
	});
});

describe("isValidArtifactId", () => {
	it.each(["surface:capability-page:run-42", "capability-page.demo", "a"])("accepts %s", (id) => {
		expect(isValidArtifactId(id)).toBe(true);
	});

	it.each([
		"",
		":leading-colon",
		"sp ace",
		"sl/ash",
		"a".repeat(300),
		"../escape",
	])("rejects %s", (id) => {
		expect(isValidArtifactId(id)).toBe(false);
	});
});

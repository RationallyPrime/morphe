import { describe, expect, it } from "vitest";
import {
	isValidArtifactId,
	MAX_SURFACE_ENVELOPE_BYTES,
	parseSurfaceEnvelope,
	parseSurfaceResponse,
} from "./envelope.js";

const validBody = {
	artifact_id: "surface:demo:revision-42",
	grammar_version: "0.2.0",
	compiler_version: "0.1.0",
	dialect_hint: "ledger",
	artifact: {
		artifact_version: "1.0.0",
		tree: { kind: "frame", role: "page", surface: "base", children: [] },
		grammar_version: "0.2.0",
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
		expect(result.envelope.artifactId).toBe("surface:demo:revision-42");
		expect(result.envelope.grammarVersion).toBe("0.2.0");
		expect(result.envelope.artifactVersion).toBe("1.0.0");
		expect(result.envelope.dialectHint).toBe("ledger");
		expect(result.envelope.tree.kind).toBe("frame");
	});

	it.each([
		["non-object body", "nope"],
		["missing artifact_id", { ...validBody, artifact_id: undefined }],
		["missing dialect_hint", { ...validBody, dialect_hint: undefined }],
		["missing artifact", { ...validBody, artifact: undefined }],
		["artifact without tree", { ...validBody, artifact: { grammar_version: "0.2.0" } }],
		["tree without kind", { ...validBody, artifact: { tree: { role: "page" } } }],
		["empty grammar_version", { ...validBody, grammar_version: "" }],
	])("rejects %s", (_label, body) => {
		expect(parseSurfaceEnvelope(body).ok).toBe(false);
	});

	it("treats the canonical artifact as the version source when lifted stamps are absent", () => {
		const { grammar_version: _grammar, compiler_version: _compiler, ...body } = validBody;
		const result = parseSurfaceEnvelope(body);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.grammarVersion).toBe(validBody.artifact.grammar_version);
	});

	it("rejects a returned id that differs from the requested id", () => {
		expect(parseSurfaceEnvelope(validBody, { expectedArtifactId: "surface:other:run-9" })).toEqual({
			ok: false,
			reason: "artifact_id does not match the requested artifact",
		});
	});

	it("rejects an unknown dialect hint", () => {
		expect(parseSurfaceEnvelope({ ...validBody, dialect_hint: "not-a-dialect" })).toEqual({
			ok: false,
			reason: "unknown dialect_hint",
		});
	});

	it("rejects inherited object properties as dialect hints", () => {
		expect(parseSurfaceEnvelope({ ...validBody, dialect_hint: "toString" })).toEqual({
			ok: false,
			reason: "unknown dialect_hint",
		});
	});

	it("rejects a tree outside its declared dialect grammar", () => {
		const result = parseSurfaceEnvelope({
			...validBody,
			dialect_hint: "clinical",
			artifact: {
				...validBody.artifact,
				tree: { kind: "compound", name: "consumer-private-card", args: {} },
			},
		});
		expect(result).toEqual({
			ok: false,
			reason: 'compound "consumer-private-card" is not permitted by dialect "clinical"',
		});
	});

	it("fully validates node-valued compound arguments at dialect ingress", () => {
		const result = parseSurfaceEnvelope({
			...validBody,
			dialect_hint: "clinical",
			artifact: {
				...validBody.artifact,
				tree: {
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: { kind: "text" },
						title: { kind: "text", value: "Valid title" },
					},
				},
			},
		});
		expect(result).toEqual({
			ok: false,
			reason: 'argument "kicker" must contain schema-valid nodes',
		});
	});

	it("rejects malformed recursive compound args without throwing", () => {
		const result = parseSurfaceEnvelope({
			...validBody,
			dialect_hint: "clinical",
			artifact: {
				...validBody.artifact,
				tree: {
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: { kind: "frame" },
						title: { kind: "text", value: "Valid title" },
					},
				},
			},
		});
		expect(result).toEqual({
			ok: false,
			reason: 'argument "kicker" must contain schema-valid nodes',
		});
	});

	it("fully validates known compound arguments under an unrestricted dialect", () => {
		const result = parseSurfaceEnvelope({
			...validBody,
			dialect_hint: "gallery",
			artifact: {
				...validBody.artifact,
				tree: {
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: { kind: "text" },
						title: { kind: "text", value: "Valid title" },
					},
				},
			},
		});
		expect(result).toEqual({
			ok: false,
			reason: 'argument "kicker" must contain schema-valid nodes',
		});
	});

	it("rejects a lifted grammar stamp that diverges from the artifact", () => {
		const drifted = {
			...validBody,
			grammar_version: "9.9.9",
		};
		expect(parseSurfaceEnvelope(drifted)).toEqual({
			ok: false,
			reason: "grammar_version does not match artifact.grammar_version",
		});
	});

	it("rejects an invalid node anywhere in the tree", () => {
		const invalid = {
			...validBody,
			artifact: {
				...validBody.artifact,
				tree: {
					kind: "frame",
					role: "page",
					children: [{ kind: "text", as: "heading" }],
				},
			},
		};
		const result = parseSurfaceEnvelope(invalid);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain("artifact.tree");
	});

	it("enforces grammar invariants represented in the generated schema", () => {
		const invalid = {
			...validBody,
			artifact: { ...validBody.artifact, tree: { kind: "button" } },
		};
		expect(parseSurfaceEnvelope(invalid).ok).toBe(false);
	});

	it("rejects extra properties inside a grammar node", () => {
		const invalid = {
			...validBody,
			artifact: {
				...validBody.artifact,
				tree: { kind: "spacer", style: "color: red" },
			},
		};
		expect(parseSurfaceEnvelope(invalid).ok).toBe(false);
	});

	it("bounds recursive input before schema validation", () => {
		let tree: unknown = { kind: "spacer" };
		for (let depth = 0; depth < 80; depth += 1) {
			tree = { kind: "frame", role: "section", children: [tree] };
		}
		const invalid = {
			...validBody,
			artifact: { ...validBody.artifact, tree },
		};
		const result = parseSurfaceEnvelope(invalid);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain("maximum depth");
	});
});

describe("parseSurfaceResponse", () => {
	it("parses a bounded JSON response", async () => {
		const response = new Response(JSON.stringify(validBody), {
			headers: { "content-type": "application/json" },
		});
		expect((await parseSurfaceResponse(response)).ok).toBe(true);
	});

	it("rejects an advertised body larger than the artifact budget", async () => {
		const response = new Response("{}", {
			headers: { "content-length": String(MAX_SURFACE_ENVELOPE_BYTES + 1) },
		});
		const result = await parseSurfaceResponse(response);
		expect(result).toEqual({
			ok: false,
			reason: `artifact response exceeds ${MAX_SURFACE_ENVELOPE_BYTES} bytes`,
		});
	});

	it("rejects an actually oversized body when content-length is absent", async () => {
		const response = new Response("x".repeat(MAX_SURFACE_ENVELOPE_BYTES + 1));
		const result = await parseSurfaceResponse(response);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain("exceeds");
	});

	it("rejects non-JSON within the byte budget", async () => {
		const result = await parseSurfaceResponse(new Response("not-json"));
		expect(result).toEqual({ ok: false, reason: "artifact response is not valid JSON" });
	});
});

describe("isValidArtifactId", () => {
	it.each(["surface:demo:revision-42", "capability-page.demo", "a"])("accepts %s", (id) => {
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

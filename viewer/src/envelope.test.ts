import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import {
	dialectGateReason,
	isValidArtifactId,
	MAX_SURFACE_ENVELOPE_BYTES,
	parseKernelSurfaceEnvelope,
	parseKernelSurfaceResponse,
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

	it("accepts an unknown dialect hint as soft metadata (render falls back to default)", () => {
		const result = parseSurfaceEnvelope({ ...validBody, dialect_hint: "not-a-dialect" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.dialectHint).toBe("not-a-dialect");
	});

	it("surfaces the raw grammar stamp when a schema-invalid artifact names a foreign grammar", () => {
		const result = parseSurfaceEnvelope({
			...validBody,
			grammar_version: "9.9.9",
			artifact: { grammar_version: "9.9.9", tree: { role: "page" } },
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.rawGrammarVersion).toBe("9.9.9");
	});

	it("treats inherited object properties as unknown hints (prototype-safe fallback)", () => {
		// "toString" is an inherited property of every object literal: a naive
		// DIALECTS[hint] lookup would resolve it to Object.prototype.toString. The
		// Object.hasOwn-guarded getDialect must treat it as merely unknown — soft
		// fallback to the default dialect, never a prototype-derived "dialect".
		const result = parseSurfaceEnvelope({ ...validBody, dialect_hint: "toString" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.dialectHint).toBe("toString");
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

describe("parseKernelSurfaceEnvelope", () => {
	const liftOptions = { artifactId: "taxis:roster", dialectHint: "timaeus" };

	it("lifts a bare CompiledSurface into the envelope contract", () => {
		const result = parseKernelSurfaceEnvelope(validBody.artifact, liftOptions);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.artifactId).toBe("taxis:roster");
		expect(result.envelope.dialectHint).toBe("timaeus");
		expect(result.envelope.grammarVersion).toBe("0.2.0");
		expect(result.envelope.artifactVersion).toBe("1.0.0");
		expect(result.envelope.tree.kind).toBe("frame");
	});

	it("runs the identical dialect mask gate on lifted surfaces", () => {
		const result = parseKernelSurfaceEnvelope(
			{
				...validBody.artifact,
				tree: { kind: "compound", name: "consumer-private-card", args: {} },
			},
			{ artifactId: "taxis:roster", dialectHint: "clinical" },
		);
		expect(result).toEqual({
			ok: false,
			reason: 'compound "consumer-private-card" is not permitted by dialect "clinical"',
		});
	});

	it("surfaces the raw grammar stamp when a foreign-grammar bare surface fails the schema pass", () => {
		const result = parseKernelSurfaceEnvelope(
			{ grammar_version: "9.9.9", tree: { role: "page" } },
			liftOptions,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.rawGrammarVersion).toBe("9.9.9");
	});

	it.each([
		["non-object body", "nope"],
		["missing tree", { ...validBody.artifact, tree: undefined }],
	])("rejects %s", (_label, body) => {
		expect(parseKernelSurfaceEnvelope(body, liftOptions).ok).toBe(false);
	});
});

describe("parseKernelSurfaceResponse", () => {
	it("lifts a valid HTTP kernel response", async () => {
		const response = new Response(JSON.stringify(validBody.artifact), {
			headers: { "content-type": "application/json" },
		});
		const result = await parseKernelSurfaceResponse(response, {
			artifactId: "taxis:orgs",
			dialectHint: "ledger",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.artifactId).toBe("taxis:orgs");
	});

	it("keeps the byte budget on the kernel path", async () => {
		const response = new Response("{}", {
			headers: { "content-length": String(MAX_SURFACE_ENVELOPE_BYTES + 1) },
		});
		const result = await parseKernelSurfaceResponse(response, {
			artifactId: "taxis:orgs",
			dialectHint: "ledger",
		});
		expect(result.ok).toBe(false);
	});
});

describe("foreign-grammar precedence over dialect rejection", () => {
	const foreignArtifact = {
		...validBody.artifact,
		grammar_version: "9.9.9",
		tree: { kind: "compound", name: "consumer-private-card", args: {} },
	};

	it("kernel lift: surfaces the grammar stamp when a schema-valid foreign artifact also violates the mask", () => {
		const result = parseKernelSurfaceEnvelope(foreignArtifact, {
			artifactId: "taxis:roster",
			dialectHint: "clinical",
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.rawGrammarVersion).toBe("9.9.9");
		expect(result.reason).toContain("grammar_version 9.9.9");
	});

	it("store path: surfaces the grammar stamp when a schema-valid foreign artifact also violates the mask", () => {
		const result = parseSurfaceEnvelope({
			...validBody,
			grammar_version: "9.9.9",
			dialect_hint: "clinical",
			artifact: foreignArtifact,
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.rawGrammarVersion).toBe("9.9.9");
	});
});

describe("dialectGateReason", () => {
	const frameTree = validBody.artifact.tree as unknown as Node;

	it("returns null for a tree the dialect permits", () => {
		expect(dialectGateReason(frameTree, "clinical")).toBeNull();
	});

	it("names the violation when the dialect forbids a compound", () => {
		const tree = { kind: "compound", name: "consumer-private-card", args: {} } as unknown as Node;
		expect(dialectGateReason(tree, "clinical")).toContain("not permitted");
	});

	it("validates under the total fallback for unknown dialect names", () => {
		expect(dialectGateReason(frameTree, "no-such-dialect")).toBeNull();
	});
});

describe("kernel lift sibling-metadata tolerance", () => {
	it("ignores sibling renderer metadata beside the artifact fields (zygos dialectId shape)", () => {
		const result = parseKernelSurfaceEnvelope(
			{ ...validBody.artifact, dialectId: "ledger" },
			{ artifactId: "zygos:books", dialectHint: "ledger" },
		);
		expect(result.ok).toBe(true);
	});

	it("still rejects extra properties INSIDE the artifact tree", () => {
		const result = parseKernelSurfaceEnvelope(
			{ ...validBody.artifact, tree: { kind: "spacer", style: "color: red" }, dialectId: "ledger" },
			{ artifactId: "zygos:books", dialectHint: "ledger" },
		);
		expect(result.ok).toBe(false);
	});
});

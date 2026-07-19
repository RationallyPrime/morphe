import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSurfaceArtifactV1 } from "../artifacts/source-types.generated.js";
import { canonicalJson, computeSourceEvidence, encodeBase64url, parseJcsJson } from "./attest.js";
import { compileSourceSurface } from "./compile.js";
import {
	admitSourceSurfaceJson,
	MAX_SOURCE_SURFACE_BYTES,
	type SourceAdmissionOptions,
} from "./source.js";
import { isValidSurfaceId, surfaceFamily } from "./spec.js";

interface GoldenVector {
	readonly private_key_seed_hex: string;
	readonly public_key_base64url: string;
	readonly artifact: SourceSurfaceArtifactV1;
}

type Mutable<T> = T extends readonly (infer Item)[]
	? Mutable<Item>[]
	: T extends object
		? { -readonly [Key in keyof T]: Mutable<T[Key]> }
		: T;

const VECTOR_URL = new URL(
	"../../../fixtures/source-surface/source-surface-v1.ed25519-vector.json",
	import.meta.url,
);
const VECTOR = JSON.parse(readFileSync(VECTOR_URL, "utf8")) as GoldenVector;
const PKCS8_ED25519_SEED_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function privateKeyForSeed(seedHex: string) {
	return createPrivateKey({
		key: Buffer.concat([PKCS8_ED25519_SEED_PREFIX, Buffer.from(seedHex, "hex")]),
		format: "der",
		type: "pkcs8",
	});
}

function publicKeyForSeed(seedHex: string): string {
	const spki = Buffer.from(
		createPublicKey(privateKeyForSeed(seedHex)).export({ format: "der", type: "spki" }),
	);
	return encodeBase64url(spki.subarray(-32));
}

function cloneArtifact(): Mutable<SourceSurfaceArtifactV1> {
	return structuredClone(VECTOR.artifact) as Mutable<SourceSurfaceArtifactV1>;
}

function options(overrides: Partial<SourceAdmissionOptions> = {}): SourceAdmissionOptions {
	return {
		expectedIssuer: "taxis",
		expectedSurfaceId: "taxis.roster:westfjords:2026-W29",
		publicKeys: {
			taxis: { "taxis-fixture-2026-01": VECTOR.public_key_base64url },
		},
		now: () => new Date("2026-07-17T12:10:00Z"),
		freshness: { maxAgeMs: 60 * 60 * 1_000 },
		...overrides,
	};
}

async function resign(
	artifact: Mutable<SourceSurfaceArtifactV1>,
	seedHex = VECTOR.private_key_seed_hex,
): Promise<void> {
	const evidence = await computeSourceEvidence({
		...artifact,
		valid_until: artifact.valid_until ?? null,
		diagnostics: (artifact.diagnostics ?? []).map((diagnostic) => ({
			...diagnostic,
			repair_hint: diagnostic.repair_hint ?? null,
		})),
		required_capabilities: artifact.required_capabilities ?? [],
	});
	artifact.seals.schema_sha256 = evidence.schemaSha256;
	artifact.seals.content_sha256 = evidence.contentSha256;
	artifact.seals.testimony_sha256 = evidence.testimonySha256;
	const key = privateKeyForSeed(seedHex);
	artifact.attestation.signature = encodeBase64url(sign(null, evidence.signingMessage, key));
}

describe("admitSourceSurfaceJson", () => {
	it("admits the cross-language vector into one deeply immutable snapshot", async () => {
		const result = await admitSourceSurfaceJson(JSON.stringify(VECTOR.artifact), options());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.sourceTestimonySha256).toBe(VECTOR.artifact.seals.testimony_sha256);
		expect(Object.isFrozen(result.value)).toBe(true);
		expect(Object.isFrozen(result.value.schema)).toBe(true);
		expect(Object.isFrozen(result.value.data)).toBe(true);
		expect(() => {
			(result.value.data as { name: string }).name = "tampered";
		}).toThrow();
	});

	it("rejects more than 2 MiB before parsing otherwise valid signed JSON", async () => {
		const oversized = `${JSON.stringify(VECTOR.artifact)}${" ".repeat(MAX_SOURCE_SURFACE_BYTES)}`;
		const result = await admitSourceSurfaceJson(oversized, options());
		expect(result).toEqual({
			ok: false,
			issue: {
				code: "bounds",
				reason: `source response exceeds ${MAX_SOURCE_SURFACE_BYTES} bytes`,
			},
		});
	});

	it("checks expected issuer and concrete surface identity before crypto", async () => {
		const wrongIssuer = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({ expectedIssuer: "obolos" }),
		);
		expect(wrongIssuer).toEqual({
			ok: false,
			issue: { code: "identity", reason: "source issuer does not match the expected issuer" },
		});
		const wrongSurface = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({ expectedSurfaceId: "taxis.roster:other" }),
		);
		expect(wrongSurface.ok).toBe(false);
		if (!wrongSurface.ok) expect(wrongSurface.issue.code).toBe("identity");
	});

	it("pins signing keys by issuer and key_id so a co-issuer cannot forge testimony", async () => {
		const coIssuerSeed = "42".repeat(32);
		const forged = cloneArtifact();
		await resign(forged, coIssuerSeed);
		const keyId = forged.attestation.key_id;
		const publicKeys = new Map([
			["taxis", new Map([[keyId, VECTOR.public_key_base64url]])],
			["obolos", new Map([[keyId, publicKeyForSeed(coIssuerSeed)]])],
		]);

		const result = await admitSourceSurfaceJson(JSON.stringify(forged), options({ publicKeys }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.issue.code).toBe("signature");

		const wrongIssuerOnly = await admitSourceSurfaceJson(
			JSON.stringify(forged),
			options({ publicKeys: { obolos: { [keyId]: publicKeyForSeed(coIssuerSeed) } } }),
		);
		expect(wrongIssuerOnly.ok).toBe(false);
		if (!wrongIssuerOnly.ok) expect(wrongIssuerOnly.issue.code).toBe("key");
	});

	it("rejects seal, key, and signature failures without compiling the schema", async () => {
		const tampered = cloneArtifact();
		(tampered.data as { name: string }).name = "tampered";
		const seal = await admitSourceSurfaceJson(JSON.stringify(tampered), options());
		expect(seal.ok).toBe(false);
		if (!seal.ok) expect(seal.issue.code).toBe("seal");

		const missingKey = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({ publicKeys: {} }),
		);
		expect(missingKey.ok).toBe(false);
		if (!missingKey.ok) expect(missingKey.issue.code).toBe("key");

		const badSignature = cloneArtifact();
		badSignature.attestation.signature = `${
			badSignature.attestation.signature.startsWith("A") ? "B" : "A"
		}${badSignature.attestation.signature.slice(1)}`;
		const signature = await admitSourceSurfaceJson(JSON.stringify(badSignature), options());
		expect(signature.ok).toBe(false);
		if (!signature.ok) expect(signature.issue.code).toBe("signature");
	});

	it("rejects unsafe integer tokens before JSON parsing rounds them", async () => {
		const raw = JSON.stringify(VECTOR.artifact).replace(
			'"source_revision":"taxis-fixture-rev-0001"',
			'"unsafe":9007199254740992,"source_revision":"taxis-fixture-rev-0001"',
		);
		const result = await admitSourceSurfaceJson(raw, options());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issue.code).toBe("json");
			expect(result.issue.reason).toContain("unsafe integer-form JSON token");
		}
	});

	it("accepts RFC 8785 doubles while rejecting only unsafe integer-form tokens", () => {
		expect(parseJcsJson('{"number":9007199254740992.0}').ok).toBe(true);
		expect(parseJcsJson('{"number":1e30}').ok).toBe(true);
		expect(canonicalJson({ number: 1e30 })).toBe('{"number":1e+30}');
	});

	it("rejects duplicate object members before JSON.parse applies last-member-wins", async () => {
		const raw = JSON.stringify(VECTOR.artifact).replace(
			'"kind":"morphe.source-surface"',
			'"kind":"morphe.source-surface","\\u006bind":"morphe.source-surface"',
		);
		const result = await admitSourceSurfaceJson(raw, options());
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issue.code).toBe("json");
			expect(result.issue.reason).toContain("duplicate object member");
		}
	});

	it("applies expiry, future-clock, and replay policy after signature verification", async () => {
		const expired = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({
				now: () => new Date("2026-07-19T12:00:00Z"),
				freshness: { maxAgeMs: 24 * 60 * 60 * 1_000 },
			}),
		);
		expect(expired.ok).toBe(false);
		if (!expired.ok) expect(expired.issue.code).toBe("freshness");

		const future = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({ now: () => new Date("2026-07-17T11:00:00Z") }),
		);
		expect(future.ok).toBe(false);
		if (!future.ok) expect(future.issue.code).toBe("freshness");

		const replay = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({ replayGuard: () => false }),
		);
		expect(replay.ok).toBe(false);
		if (!replay.ok) expect(replay.issue.code).toBe("replay");
	});

	it("verifies local-reference, data-schema, and required-capability contracts", async () => {
		const remote = cloneArtifact();
		remote.schema.$ref = "https://example.invalid/schema.json";
		await resign(remote);
		const remoteResult = await admitSourceSurfaceJson(JSON.stringify(remote), options());
		expect(remoteResult.ok).toBe(false);
		if (!remoteResult.ok) expect(remoteResult.issue.code).toBe("schema");

		const invalidData = cloneArtifact();
		(invalidData.data as { workers: unknown }).workers = "not-an-array";
		await resign(invalidData);
		const dataResult = await admitSourceSurfaceJson(JSON.stringify(invalidData), options());
		expect(dataResult.ok).toBe(false);
		if (!dataResult.ok) expect(dataResult.issue.code).toBe("schema");

		const capability = cloneArtifact();
		capability.required_capabilities = ["morphe.future-proof"];
		await resign(capability);
		const capabilityResult = await admitSourceSurfaceJson(JSON.stringify(capability), options());
		expect(capabilityResult.ok).toBe(false);
		if (!capabilityResult.ok) expect(capabilityResult.issue.code).toBe("capability");
		const supportedResult = await admitSourceSurfaceJson(
			JSON.stringify(capability),
			options({ supportedCapabilities: new Set(["morphe.future-proof"]) }),
		);
		expect(supportedResult.ok).toBe(true);
	});

	it("enforces minimized schema policy before compilation", async () => {
		const recursive = cloneArtifact();
		recursive.schema = {
			type: "object",
			"x-morphe": { order: ["node"] },
			properties: { node: { $ref: "#/$defs/Node" } },
			$defs: {
				Node: {
					type: "object",
					"x-morphe": { order: ["value", "child"] },
					properties: {
						value: { type: "string" },
						child: { $ref: "#/$defs/Node" },
					},
					required: ["value"],
				},
			},
			required: ["node"],
		};
		recursive.data = { node: { value: "parent", child: { value: "signed child" } } };
		await resign(recursive);
		const recursiveResult = await admitSourceSurfaceJson(JSON.stringify(recursive), options());
		expect(recursiveResult.ok).toBe(false);
		if (!recursiveResult.ok) {
			expect(recursiveResult.issue.code).toBe("schema");
			expect(recursiveResult.issue.reason).toContain("recursive local $ref cycle");
		}
		const sharedDefinition = cloneArtifact();
		sharedDefinition.schema = {
			type: "object",
			"x-morphe": { order: ["left", "right"] },
			properties: {
				left: { $ref: "#/$defs/Leaf" },
				right: { $ref: "#/$defs/Leaf" },
			},
			$defs: { Leaf: { type: "string" } },
			required: ["left", "right"],
		};
		sharedDefinition.data = { left: "L", right: "R" };
		await resign(sharedDefinition);
		const sharedDefinitionResult = await admitSourceSurfaceJson(
			JSON.stringify(sharedDefinition),
			options(),
		);
		expect(sharedDefinitionResult.ok).toBe(true);

		const broadPointer = cloneArtifact();
		broadPointer.schema.$ref = "#/properties/name";
		await resign(broadPointer);
		const broadPointerResult = await admitSourceSurfaceJson(
			JSON.stringify(broadPointer),
			options(),
		);
		expect(broadPointerResult.ok).toBe(false);
		if (!broadPointerResult.ok) {
			expect(broadPointerResult.issue.code).toBe("schema");
			expect(broadPointerResult.issue.reason).toContain("#/$defs/...");
		}

		const percentEncoded = cloneArtifact();
		percentEncoded.schema = {
			$defs: {
				"A B": { type: "string" },
				"A%20B": { type: "integer" },
			},
			$ref: "#/$defs/A%20B",
		};
		percentEncoded.data = "TEXT";
		await resign(percentEncoded);
		const percentEncodedResult = await admitSourceSurfaceJson(
			JSON.stringify(percentEncoded),
			options(),
		);
		expect(percentEncodedResult.ok).toBe(false);
		if (!percentEncodedResult.ok) {
			expect(percentEncodedResult.issue.code).toBe("schema");
			expect(percentEncodedResult.issue.reason).toContain("percent encoding");
		}

		const nestedId = cloneArtifact();
		const nestedProperties = nestedId.schema.properties as Record<string, Record<string, unknown>>;
		const nestedProperty = Object.values(nestedProperties)[0];
		if (nestedProperty === undefined) throw new Error("fixture must have a property schema");
		nestedProperty.$id = "https://example.invalid/nested";
		await resign(nestedId);
		const nestedIdResult = await admitSourceSurfaceJson(JSON.stringify(nestedId), options());
		expect(nestedIdResult.ok).toBe(false);
		if (!nestedIdResult.ok) expect(nestedIdResult.issue.reason).toContain("$id");

		const missingOrder = cloneArtifact();
		const rootHint = missingOrder.schema["x-morphe"] as Record<string, unknown>;
		delete rootHint.order;
		await resign(missingOrder);
		const missingOrderResult = await admitSourceSurfaceJson(
			JSON.stringify(missingOrder),
			options(),
		);
		expect(missingOrderResult.ok).toBe(false);
		if (!missingOrderResult.ok)
			expect(missingOrderResult.issue.reason).toContain("signed x-morphe.order");

		const residualHidden = cloneArtifact();
		residualHidden.schema = {
			$defs: {
				Secret: { type: "string", "x-morphe": { hidden: true } },
			},
			type: "array",
			items: { $ref: "#/$defs/Secret" },
		};
		residualHidden.data = ["SIGNED-ARRAY-SECRET"];
		await resign(residualHidden);
		const hiddenResult = await admitSourceSurfaceJson(JSON.stringify(residualHidden), options());
		expect(hiddenResult.ok).toBe(false);
		if (!hiddenResult.ok) {
			expect(hiddenResult.issue.code).toBe("schema");
			expect(hiddenResult.issue.reason).toContain("residual hidden policy");
		}
	});

	it("bounds generic JSON before the recursive generated schema", async () => {
		let value: unknown = "leaf";
		for (let index = 0; index < 8; index += 1) value = { nested: value };
		const result = await admitSourceSurfaceJson(
			JSON.stringify(value),
			options({ limits: { maxDepth: 4 } }),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.issue.code).toBe("bounds");
	});

	// KRA-765 F1 teeth: the oracle-suite F1 admits pre-minimized conformance fixtures
	// (taxis/obolos), so it can only ever be a regression tripwire — it holds no kernel
	// private key to forge a leaky variant, and a clean fixture cannot leak. Here the
	// ed25519 test vector DOES hold a private seed, so we plant a hidden-marked property
	// and RE-SIGN so the residue rides a *validly signed* source (signature + seals all
	// pass) into the admission gate. The gate is the teeth: a residual hidden policy is
	// REJECTED before compilation, so a sentinel that slipped minimization can never
	// reach a renderer — signature validity does not buy a hidden field a way in.
	it("rejects a validly signed source that still carries a residual hidden field", async () => {
		const sentinel = "MORPHE-F1-RESIDUAL-HIDDEN-9E17AA";
		const artifact = cloneArtifact();
		const schema = artifact.schema as unknown as {
			properties: Record<string, unknown>;
			"x-morphe": { order: string[] };
		};
		schema.properties.residualLeak = { type: "string", "x-morphe": { hidden: true } };
		schema["x-morphe"].order.push("residualLeak");
		(artifact.data as Record<string, unknown>).residualLeak = sentinel;
		await resign(artifact);

		const admitted = await admitSourceSurfaceJson(JSON.stringify(artifact), options());
		// The gate refuses a residual hidden policy even on a validly signed source, so
		// the sentinel that slipped minimization never reaches compilation. Compiler-side
		// pruning of hidden classes is proven adversarially in totality (F3).
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) {
			expect(admitted.issue.reason.toLowerCase()).toContain("residual hidden");
		}
	});
});

// KRA-776 family-mode identity gate. The live defect: a drill-through link forwards a
// filter (`?party_id=`), the kernel correctly emits a PARAM-SCOPED surface_id, and the
// strict pinned equality gate then 502s every parameterized drill-through. Family mode
// relaxes ONLY the surface_id check to a family-prefix match for a derived instance —
// the family segment is the `<source>.<pane>` token before the first `:`. The vector's
// expected id is `taxis.roster:westfjords:2026-W29`, so its family is `taxis.roster`.
// Everything else (issuer, seals, key, signature, freshness, schema) stays fully strict.
describe("admitSourceSurfaceJson family-mode identity gate (KRA-776)", () => {
	const PARAM_SCOPED = "taxis.roster:party-50548990";
	const CROSS_FAMILY = "taxis.horizon:party-50548990";

	it("admits a correctly-signed same-family param-scoped artifact (the live drill-through)", async () => {
		const scoped = cloneArtifact();
		scoped.surface_id = PARAM_SCOPED;
		await resign(scoped);
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(scoped),
			options({ surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(true);
		if (admitted.ok) {
			expect(admitted.value.surface_id).toBe(PARAM_SCOPED);
			expect(admitted.value.surfaceIdGate).toBe("family");
		}
	});

	it("exact mode still 502s that same param-scoped id — the defect this fix removes", async () => {
		const scoped = cloneArtifact();
		scoped.surface_id = PARAM_SCOPED;
		await resign(scoped);
		const exact = await admitSourceSurfaceJson(JSON.stringify(scoped), options());
		expect(exact.ok).toBe(false);
		if (!exact.ok) {
			expect(exact.issue.code).toBe("identity");
			expect(exact.issue.reason).toBe("surface_id does not match the requested surface");
		}
	});

	it("family mode rejects a cross-family surface_id even when validly signed", async () => {
		// Default expected id family is `taxis.roster`; this artifact is a different pane.
		const foreign = cloneArtifact();
		foreign.surface_id = CROSS_FAMILY;
		await resign(foreign);
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(foreign),
			options({ surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) {
			expect(admitted.issue.code).toBe("identity");
			expect(admitted.issue.reason).toBe("surface_id is outside the requested surface family");
		}
	});

	it("family mode rejects a same-prefix near-miss family (the family token compares whole)", async () => {
		// `taxis.roster` is the expected family; `taxis.rosterx:` shares the prefix but is a
		// DIFFERENT pane. Seed-proof that the family match compares the WHOLE grammar-parsed
		// `<source>.<pane>` token — a bare `startsWith(family)` would wrongly admit this
		// validly-signed forgery. (KRA-777 made the compare a parsed-family equality.)
		const nearMiss = cloneArtifact();
		nearMiss.surface_id = "taxis.rosterx:party-50548990";
		await resign(nearMiss);
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(nearMiss),
			options({ surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) {
			expect(admitted.issue.code).toBe("identity");
			expect(admitted.issue.reason).toBe("surface_id is outside the requested surface family");
		}
	});

	it("rejects a case-variant of the expected family at the schema gate (no uppercase family)", async () => {
		// `Taxis.Roster:` differs from `taxis.roster:` only in case. The KRA-777 grammar makes
		// an uppercase family token UNREPRESENTABLE, so this validly-signed forgery is now
		// refused at the envelope schema gate — before the family compare is even reached —
		// which is strictly stronger than the earlier case-sensitive family compare.
		const caseVariant = cloneArtifact();
		caseVariant.surface_id = "Taxis.Roster:party-50548990";
		await resign(caseVariant);
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(caseVariant),
			options({ surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) {
			expect(admitted.issue.code).toBe("envelope");
			expect(admitted.issue.reason).toContain("surface_id");
		}
	});

	it("family mode rejects a valid-family artifact whose signature does not verify", async () => {
		const tamperedSignature = cloneArtifact();
		tamperedSignature.surface_id = PARAM_SCOPED;
		await resign(tamperedSignature);
		const signature = tamperedSignature.attestation.signature;
		tamperedSignature.attestation.signature = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(tamperedSignature),
			options({ surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) expect(admitted.issue.code).toBe("signature");
	});

	it("family mode rejects a valid-family artifact signed by an untrusted key", async () => {
		const foreignSeed = "42".repeat(32);
		const forged = cloneArtifact();
		forged.surface_id = PARAM_SCOPED;
		// Re-seal AND re-sign under a co-issuer seed while keeping the pinned issuer and
		// key_id, so seals match but the trusted taxis key cannot verify the signature.
		await resign(forged, foreignSeed);
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(forged),
			options({ surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) expect(admitted.issue.code).toBe("signature");
	});

	it("records the gate mode on the receipt in both modes", async () => {
		const exactAdmit = await admitSourceSurfaceJson(JSON.stringify(VECTOR.artifact), options());
		expect(exactAdmit.ok).toBe(true);
		if (exactAdmit.ok) {
			expect(exactAdmit.value.surfaceIdGate).toBe("exact");
			expect(compileSourceSurface(exactAdmit.value).receipt.surfaceIdGate).toBe("exact");
		}

		const scoped = cloneArtifact();
		scoped.surface_id = PARAM_SCOPED;
		await resign(scoped);
		const familyAdmit = await admitSourceSurfaceJson(
			JSON.stringify(scoped),
			options({ surfaceIdMatch: "family" }),
		);
		expect(familyAdmit.ok).toBe(true);
		if (familyAdmit.ok) {
			expect(familyAdmit.value.surfaceIdGate).toBe("family");
			expect(compileSourceSurface(familyAdmit.value).receipt.surfaceIdGate).toBe("family");
		}
	});
});

// KRA-777 surface_id family grammar. The loki6 finding: the family is derived as the token
// before the FIRST `:`, assuming `<source>.<pane>:<instance…>`. A producer emitting
// `<source>:<pane>:…` collapses the family to `<source>` — every pane of that source becomes
// same-family, admitting cross-pane traffic under family mode. The grammar closes it at the
// schema gate AND at the runtime parse rule (the SAME grammar, one constant per language).
describe("surface_id family grammar (KRA-777)", () => {
	const VALID = [
		"krates.budget:krates-ehf",
		"obolos.evidence:settlement-2026-07-17",
		"taxis.roster:westfjords:2026-W29",
		"taxis.roster:party-50548990",
	];
	const INVALID = [
		"krates:budget:krates-ehf", // the collapse attack: no family dot before the first colon
		"krates.budget", // missing the `:instance` segment
		"kratesbudget:krates-ehf", // missing the family `.`
		"krates.budget:", // empty instance segment
		"Krates.Budget:krates-ehf", // uppercase family token
		"krat:es.budget:krates-ehf", // a colon inside the family token
		"",
	];

	it.each(VALID)("runtime parse accepts %s and derives its family", (id) => {
		expect(isValidSurfaceId(id)).toBe(true);
		expect(surfaceFamily(id)).toBe(id.slice(0, id.indexOf(":")));
	});

	it.each(INVALID)("runtime parse rejects %s (no collapsible family)", (id) => {
		expect(isValidSurfaceId(id)).toBe(false);
		expect(surfaceFamily(id)).toBeNull();
	});

	it("rejects the collapse attack at the schema gate", async () => {
		const collapse = cloneArtifact();
		collapse.surface_id = "taxis:roster:party-50548990";
		await resign(collapse);
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(collapse),
			options({ expectedSurfaceId: "taxis:roster:party-50548990", surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) {
			expect(admitted.issue.code).toBe("envelope");
			expect(admitted.issue.reason).toContain("surface_id");
		}
	});

	it("rejects a malformed family-mode pin at the gate (defense in depth)", async () => {
		// A validly-signed, grammar-conforming artifact against a misconfigured collapse pin:
		// the artifact clears the schema gate, so the gate's own grammar assertion on the pin
		// is what must fire — never a family compare keyed off the collapsed `<source>`.
		const admitted = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			options({ expectedSurfaceId: "taxis:roster:westfjords", surfaceIdMatch: "family" }),
		);
		expect(admitted.ok).toBe(false);
		if (!admitted.ok) {
			expect(admitted.issue.code).toBe("identity");
			expect(admitted.issue.reason).toContain("family grammar");
		}
	});
});

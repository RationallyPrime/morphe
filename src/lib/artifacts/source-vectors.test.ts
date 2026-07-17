import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { readFileSync } from "node:fs";
import canonicalize from "canonicalize";
import { describe, expect, it } from "vitest";
import type { JsonValue, SourceSurfaceArtifactV1 } from "./source-types.generated.js";

interface GoldenVector {
	readonly public_key_hex: string;
	readonly artifact: SourceSurfaceArtifactV1;
	readonly canonical: {
		readonly schema_jcs_hex: string;
		readonly content_jcs_hex: string;
		readonly testimony_jcs_hex: string;
		readonly signing_message_hex: string;
	};
	readonly jcs_edge_case: {
		readonly input: JsonValue;
		readonly canonical_hex: string;
	};
	readonly jcs_rejection_cases: readonly {
		readonly name: string;
		readonly raw_json: string;
	}[];
	readonly expected: {
		readonly seals: SourceSurfaceArtifactV1["seals"];
		readonly signature: string;
	};
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
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const VECTOR = parseJcsJson(readFileSync(VECTOR_URL, "utf8")) as GoldenVector;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const ED25519_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{85}[AQgw]$/;

function assertSafeIntegerTokens(rawJson: string): void {
	let inString = false;
	let escaped = false;
	let cursor = 0;
	while (cursor < rawJson.length) {
		const character = rawJson[cursor];
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') inString = false;
			cursor += 1;
			continue;
		}
		if (character === '"') {
			inString = true;
			cursor += 1;
			continue;
		}
		if (character !== "-" && (character === undefined || character < "0" || character > "9")) {
			cursor += 1;
			continue;
		}

		const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rawJson.slice(cursor))?.[0];
		if (!token) {
			cursor += 1;
			continue;
		}
		if (!token.includes(".") && !/[eE]/.test(token)) {
			const integer = BigInt(token);
			if (integer > MAX_SAFE_INTEGER_BIGINT || integer < -MAX_SAFE_INTEGER_BIGINT) {
				throw new RangeError(`unsafe integer-form JSON token: ${token}`);
			}
		}
		cursor += token.length;
	}
}

function assertWellFormedUnicode(value: string): void {
	for (let index = 0; index < value.length; index += 1) {
		const codeUnit = value.charCodeAt(index);
		if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) {
				throw new TypeError("JCS strings must not contain unpaired UTF-16 surrogates");
			}
			index += 1;
		} else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
			throw new TypeError("JCS strings must not contain unpaired UTF-16 surrogates");
		}
	}
}

function assertJcsDomain(value: unknown): void {
	if (value === null || typeof value === "boolean") return;
	if (typeof value === "string") {
		assertWellFormedUnicode(value);
		return;
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new TypeError("JCS numbers must be finite");
		return;
	}
	if (Array.isArray(value)) {
		for (const child of value) assertJcsDomain(child);
		return;
	}
	if (typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			assertWellFormedUnicode(key);
			assertJcsDomain(child);
		}
		return;
	}
	throw new TypeError("value is outside the RFC 8785 JSON domain");
}

function parseJcsJson(rawJson: string): unknown {
	assertSafeIntegerTokens(rawJson);
	const value: unknown = JSON.parse(rawJson);
	assertJcsDomain(value);
	return value;
}

function jcs(value: unknown): string {
	assertJcsDomain(value);
	const encoded = canonicalize(value);
	if (encoded === undefined) throw new TypeError("value is outside the RFC 8785 JSON domain");
	return encoded;
}

function utf8Hex(value: string): string {
	return Buffer.from(value, "utf8").toString("hex");
}

function sha256(value: string): `sha256:${string}` {
	return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function normalizedDiagnostics(artifact: SourceSurfaceArtifactV1) {
	return (artifact.diagnostics ?? []).map((diagnostic) => ({
		code: diagnostic.code,
		severity: diagnostic.severity,
		path: diagnostic.path,
		message: diagnostic.message,
		repair_hint: diagnostic.repair_hint ?? null,
	}));
}

function evidenceFor(artifact: SourceSurfaceArtifactV1) {
	const schemaJcs = jcs(artifact.schema);
	const contentJcs = jcs({
		data: artifact.data,
		diagnostics: normalizedDiagnostics(artifact),
	});
	const schemaSha256 = sha256(schemaJcs);
	const contentSha256 = sha256(contentJcs);
	const testimonyJcs = jcs({
		kind: artifact.kind,
		wire_version: artifact.wire_version,
		issuer: artifact.issuer,
		surface_id: artifact.surface_id,
		source_revision: artifact.source_revision,
		produced_at: artifact.produced_at,
		valid_until: artifact.valid_until ?? null,
		view_model: artifact.view_model,
		required_capabilities: artifact.required_capabilities ?? [],
		signing: {
			algorithm: artifact.attestation.algorithm,
			key_id: artifact.attestation.key_id,
		},
		schema_sha256: schemaSha256,
		content_sha256: contentSha256,
	});
	const testimonySha256 = sha256(testimonyJcs);
	const signingMessage = `morphe-source-surface-v1:${testimonySha256}`;
	return {
		schemaJcs,
		contentJcs,
		testimonyJcs,
		signingMessage,
		seals: { schemaSha256, contentSha256, testimonySha256 },
	};
}

function canonicalSignatureBytes(signature: string): Buffer | undefined {
	if (!ED25519_SIGNATURE_PATTERN.test(signature)) return undefined;
	const decoded = Buffer.from(signature, "base64url");
	if (decoded.length !== 64 || decoded.toString("base64url") !== signature) return undefined;
	return decoded;
}

function verifiesOffline(artifact: SourceSurfaceArtifactV1, publicKeyHex: string): boolean {
	const signature = canonicalSignatureBytes(artifact.attestation.signature);
	if (!signature) return false;
	const evidence = evidenceFor(artifact);
	if (artifact.seals.schema_sha256 !== evidence.seals.schemaSha256) return false;
	if (artifact.seals.content_sha256 !== evidence.seals.contentSha256) return false;
	if (artifact.seals.testimony_sha256 !== evidence.seals.testimonySha256) return false;
	try {
		const publicKey = createPublicKey({
			key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
			format: "der",
			type: "spki",
		});
		return verifySignature(
			null,
			Buffer.from(evidence.signingMessage, "utf8"),
			publicKey,
			signature,
		);
	} catch {
		return false;
	}
}

function cloneArtifact(): Mutable<SourceSurfaceArtifactV1> {
	return structuredClone(VECTOR.artifact) as unknown as Mutable<SourceSurfaceArtifactV1>;
}

describe("SourceSurfaceArtifactV1 cross-language evidence", () => {
	it("matches Python RFC 8785 bytes, hashes, signing bytes, and Ed25519 signature", () => {
		const evidence = evidenceFor(VECTOR.artifact);

		expect(utf8Hex(evidence.schemaJcs)).toBe(VECTOR.canonical.schema_jcs_hex);
		expect(utf8Hex(evidence.contentJcs)).toBe(VECTOR.canonical.content_jcs_hex);
		expect(utf8Hex(evidence.testimonyJcs)).toBe(VECTOR.canonical.testimony_jcs_hex);
		expect(utf8Hex(evidence.signingMessage)).toBe(VECTOR.canonical.signing_message_hex);
		expect(evidence.seals).toEqual({
			schemaSha256: VECTOR.expected.seals.schema_sha256,
			contentSha256: VECTOR.expected.seals.content_sha256,
			testimonySha256: VECTOR.expected.seals.testimony_sha256,
		});
		expect(VECTOR.artifact.required_capabilities).toEqual([]);
		expect(VECTOR.artifact.attestation.signature).toBe(VECTOR.expected.signature);
		expect(verifiesOffline(VECTOR.artifact, VECTOR.public_key_hex)).toBe(true);
	});

	it("matches the RFC 8785 Unicode, escaping, number, and null edge vector", () => {
		expect(utf8Hex(jcs(VECTOR.jcs_edge_case.input))).toBe(VECTOR.jcs_edge_case.canonical_hex);
	});

	it("rejects the shared raw-JSON JCS exclusion vectors before hashing", () => {
		for (const rejection of VECTOR.jcs_rejection_cases) {
			expect(() => parseJcsJson(rejection.raw_json), rejection.name).toThrow();
		}
	});

	it.each([
		Number.NaN,
		{ nested: [Number.POSITIVE_INFINITY] },
		{ nested: -Infinity },
	])("rejects non-finite values recursively before canonicalization", (value) => {
		expect(() => jcs(value)).toThrow("JCS numbers must be finite");
	});

	it("normalizes an omitted diagnostic repair_hint to null for content hashing", () => {
		const artifact = cloneArtifact();
		const diagnostic = artifact.diagnostics?.find((candidate) => candidate.repair_hint === null);
		expect(diagnostic).toBeDefined();
		if (!diagnostic) throw new Error("vector must contain one null repair_hint");

		const baseline = evidenceFor(artifact);
		delete diagnostic.repair_hint;
		const normalized = evidenceFor(artifact);

		expect(normalized.contentJcs).toBe(baseline.contentJcs);
		expect(normalized.seals.contentSha256).toBe(baseline.seals.contentSha256);
		expect(verifiesOffline(artifact, VECTOR.public_key_hex)).toBe(true);
	});

	it("rejects a noncanonical base64url spelling of the same Ed25519 bytes", () => {
		const artifact = cloneArtifact();
		const signature = artifact.attestation.signature;
		const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
		const alternative = alphabet[alphabet.indexOf(signature.at(-1) ?? "") + 1];
		if (!alternative) throw new Error("vector signature must end with a canonical base64url digit");
		artifact.attestation.signature = `${signature.slice(0, -1)}${alternative}`;

		expect(Buffer.from(artifact.attestation.signature, "base64url")).toEqual(
			Buffer.from(signature, "base64url"),
		);
		expect(verifiesOffline(artifact, VECTOR.public_key_hex)).toBe(false);
	});

	it.each([
		"schema",
		"data",
		"diagnostics",
		"key-id",
		"signature",
	] as const)("rejects %s tampering offline", (target) => {
		const artifact = cloneArtifact();
		switch (target) {
			case "schema":
				artifact.schema.title = "tampered schema";
				break;
			case "data":
				artifact.data = { tampered: true };
				break;
			case "diagnostics":
				artifact.diagnostics = [];
				break;
			case "key-id":
				artifact.attestation.key_id = "untrusted-key";
				break;
			case "signature":
				artifact.attestation.signature = `${
					artifact.attestation.signature.startsWith("A") ? "B" : "A"
				}${artifact.attestation.signature.slice(1)}`;
				break;
		}
		expect(verifiesOffline(artifact, VECTOR.public_key_hex)).toBe(false);
	});
});

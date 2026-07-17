import canonicalize from "canonicalize";
import type { JsonValue, Sha256 } from "../artifacts/source-types.generated.js";
import type { NormalizedSourceSurfaceArtifact } from "./schema.js";

export const SOURCE_SIGNATURE_CONTEXT = "morphe-source-surface-v1:";

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const ED25519_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{85}[AQgw]$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const RAW_ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
const MAX_RAW_JSON_NESTING = 1_024;

export interface SourceEvidence {
	readonly schemaSha256: Sha256;
	readonly contentSha256: Sha256;
	readonly testimonySha256: Sha256;
	readonly signingMessage: Uint8Array;
}

export type AttestationResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly reason: string };

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

/**
 * JSON.parse is last-member-wins, while signatures cover the parsed value.
 * Reject duplicate names before that lossy boundary, decoding escapes so
 * `"name"` and `"\u006eame"` are recognized as the same member.
 */
function assertUniqueObjectMembers(rawJson: string): void {
	let cursor = 0;

	function whitespace(): void {
		while (/\s/.test(rawJson[cursor] ?? "")) cursor += 1;
	}

	function stringToken(): string {
		const start = cursor;
		if (rawJson[cursor] !== '"') throw new SyntaxError(`expected string at offset ${cursor}`);
		cursor += 1;
		let escaped = false;
		while (cursor < rawJson.length) {
			const character = rawJson[cursor];
			cursor += 1;
			if (escaped) {
				escaped = false;
				continue;
			}
			if (character === "\\") {
				escaped = true;
				continue;
			}
			if (character === '"') {
				return JSON.parse(rawJson.slice(start, cursor)) as string;
			}
		}
		throw new SyntaxError(`unterminated string at offset ${start}`);
	}

	function value(depth: number): void {
		if (depth > MAX_RAW_JSON_NESTING) {
			throw new RangeError(`raw JSON nesting exceeds ${MAX_RAW_JSON_NESTING}`);
		}
		whitespace();
		const character = rawJson[cursor];
		if (character === "{") {
			object(depth + 1);
			return;
		}
		if (character === "[") {
			array(depth + 1);
			return;
		}
		if (character === '"') {
			stringToken();
			return;
		}
		const literal = /^(?:true|false|null)/.exec(rawJson.slice(cursor))?.[0];
		if (literal !== undefined) {
			cursor += literal.length;
			return;
		}
		const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rawJson.slice(cursor))?.[0];
		if (number !== undefined) {
			cursor += number.length;
			return;
		}
		throw new SyntaxError(`expected JSON value at offset ${cursor}`);
	}

	function object(depth: number): void {
		cursor += 1;
		whitespace();
		if (rawJson[cursor] === "}") {
			cursor += 1;
			return;
		}
		const names = new Set<string>();
		while (true) {
			whitespace();
			const name = stringToken();
			if (names.has(name)) throw new SyntaxError(`duplicate object member ${JSON.stringify(name)}`);
			names.add(name);
			whitespace();
			if (rawJson[cursor] !== ":") throw new SyntaxError(`expected colon at offset ${cursor}`);
			cursor += 1;
			value(depth);
			whitespace();
			if (rawJson[cursor] === "}") {
				cursor += 1;
				return;
			}
			if (rawJson[cursor] !== ",") throw new SyntaxError(`expected comma at offset ${cursor}`);
			cursor += 1;
		}
	}

	function array(depth: number): void {
		cursor += 1;
		whitespace();
		if (rawJson[cursor] === "]") {
			cursor += 1;
			return;
		}
		while (true) {
			value(depth);
			whitespace();
			if (rawJson[cursor] === "]") {
				cursor += 1;
				return;
			}
			if (rawJson[cursor] !== ",") throw new SyntaxError(`expected comma at offset ${cursor}`);
			cursor += 1;
		}
	}

	value(0);
	whitespace();
	if (cursor !== rawJson.length) throw new SyntaxError(`unexpected token at offset ${cursor}`);
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

/** Parse source JSON without first losing the integer and Unicode exclusions required by JCS. */
export function parseJcsJson(rawJson: string): AttestationResult<unknown> {
	try {
		assertSafeIntegerTokens(rawJson);
		assertUniqueObjectMembers(rawJson);
		const value: unknown = JSON.parse(rawJson);
		assertJcsDomain(value);
		return { ok: true, value };
	} catch (error) {
		return {
			ok: false,
			reason: `source response is not valid JCS JSON: ${
				error instanceof Error ? error.message : "unknown JSON error"
			}`,
		};
	}
}

export function canonicalJson(value: unknown): string {
	assertJcsDomain(value);
	const encoded = canonicalize(value);
	if (encoded === undefined) throw new TypeError("value is outside the RFC 8785 JSON domain");
	return encoded;
}

function bytesToHex(bytes: Uint8Array): string {
	let hex = "";
	for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
	return hex;
}

async function sha256(value: string): Promise<Sha256> {
	const bytes = new TextEncoder().encode(value);
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

/** Hash an RFC 8785 JSON value for post-compilation delivery receipts. */
export async function canonicalJsonSha256(value: unknown): Promise<Sha256> {
	return sha256(canonicalJson(value));
}

function base64urlAlphabet(value: number): string {
	return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[value] ?? "";
}

export function encodeBase64url(bytes: Uint8Array): string {
	let encoded = "";
	for (let offset = 0; offset < bytes.length; offset += 3) {
		const first = bytes[offset] ?? 0;
		const second = bytes[offset + 1];
		const third = bytes[offset + 2];
		encoded += base64urlAlphabet(first >> 2);
		encoded += base64urlAlphabet(((first & 0x03) << 4) | ((second ?? 0) >> 4));
		if (second !== undefined) {
			encoded += base64urlAlphabet(((second & 0x0f) << 2) | ((third ?? 0) >> 6));
		}
		if (third !== undefined) encoded += base64urlAlphabet(third & 0x3f);
	}
	return encoded;
}

export function decodeCanonicalBase64url(
	value: string,
	expectedBytes: number,
): AttestationResult<Uint8Array> {
	if (value.length === 0 || value.includes("=") || !BASE64URL_PATTERN.test(value)) {
		return { ok: false, reason: "base64url value must be canonical and unpadded" };
	}
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
	const bytes: number[] = [];
	let accumulator = 0;
	let bits = 0;
	for (const character of value) {
		const digit = alphabet.indexOf(character);
		if (digit < 0) return { ok: false, reason: "base64url value contains an invalid digit" };
		accumulator = (accumulator << 6) | digit;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((accumulator >> bits) & 0xff);
			accumulator &= (1 << bits) - 1;
		}
	}
	if (bits > 0 && accumulator !== 0) {
		return { ok: false, reason: "base64url value has non-canonical trailing bits" };
	}
	const decoded = Uint8Array.from(bytes);
	if (decoded.length !== expectedBytes || encodeBase64url(decoded) !== value) {
		return {
			ok: false,
			reason: `base64url value must encode exactly ${expectedBytes} bytes canonically`,
		};
	}
	return { ok: true, value: decoded };
}

function sourceContentDocument(artifact: NormalizedSourceSurfaceArtifact): JsonValue {
	return {
		data: artifact.data,
		diagnostics: artifact.diagnostics.map((diagnostic) => ({
			code: diagnostic.code,
			severity: diagnostic.severity,
			path: diagnostic.path,
			message: diagnostic.message,
			repair_hint: diagnostic.repair_hint,
		})),
	};
}

function sourceTestimonyDocument(
	artifact: NormalizedSourceSurfaceArtifact,
	schemaSha256: Sha256,
	contentSha256: Sha256,
): unknown {
	return {
		kind: artifact.kind,
		wire_version: artifact.wire_version,
		issuer: artifact.issuer,
		surface_id: artifact.surface_id,
		source_revision: artifact.source_revision,
		produced_at: artifact.produced_at,
		valid_until: artifact.valid_until,
		view_model: artifact.view_model,
		required_capabilities: artifact.required_capabilities,
		signing: {
			algorithm: artifact.attestation.algorithm,
			key_id: artifact.attestation.key_id,
		},
		schema_sha256: schemaSha256,
		content_sha256: contentSha256,
	};
}

function webCryptoBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
	const copy = new Uint8Array(value.byteLength);
	copy.set(value);
	return copy;
}

export async function computeSourceEvidence(
	artifact: NormalizedSourceSurfaceArtifact,
): Promise<SourceEvidence> {
	const schemaSha256 = await sha256(canonicalJson(artifact.schema));
	const contentSha256 = await sha256(canonicalJson(sourceContentDocument(artifact)));
	const testimonySha256 = await sha256(
		canonicalJson(sourceTestimonyDocument(artifact, schemaSha256, contentSha256)),
	);
	return {
		schemaSha256,
		contentSha256,
		testimonySha256,
		signingMessage: new TextEncoder().encode(`${SOURCE_SIGNATURE_CONTEXT}${testimonySha256}`),
	};
}

export function sealsMatch(
	artifact: NormalizedSourceSurfaceArtifact,
	evidence: SourceEvidence,
): AttestationResult<true> {
	if (artifact.seals.schema_sha256 !== evidence.schemaSha256) {
		return { ok: false, reason: "schema seal does not match the canonical content" };
	}
	if (artifact.seals.content_sha256 !== evidence.contentSha256) {
		return { ok: false, reason: "content seal does not match the canonical content" };
	}
	if (artifact.seals.testimony_sha256 !== evidence.testimonySha256) {
		return { ok: false, reason: "testimony seal does not match the canonical content" };
	}
	return { ok: true, value: true };
}

export async function verifyEd25519Attestation(
	artifact: NormalizedSourceSurfaceArtifact,
	evidence: SourceEvidence,
	publicKeyBase64url: string,
): Promise<AttestationResult<true>> {
	if (!ED25519_SIGNATURE_PATTERN.test(artifact.attestation.signature)) {
		return { ok: false, reason: "Ed25519 signature is not canonical unpadded base64url" };
	}
	const signature = decodeCanonicalBase64url(
		artifact.attestation.signature,
		ED25519_SIGNATURE_BYTES,
	);
	if (!signature.ok) return { ok: false, reason: `invalid Ed25519 signature: ${signature.reason}` };
	const publicKey = decodeCanonicalBase64url(publicKeyBase64url, RAW_ED25519_PUBLIC_KEY_BYTES);
	if (!publicKey.ok)
		return { ok: false, reason: `invalid trusted Ed25519 public key: ${publicKey.reason}` };

	try {
		const keyBytes = webCryptoBytes(publicKey.value);
		const signatureBytes = webCryptoBytes(signature.value);
		const messageBytes = webCryptoBytes(evidence.signingMessage);
		const key = await globalThis.crypto.subtle.importKey(
			"raw",
			keyBytes,
			{ name: "Ed25519" },
			false,
			["verify"],
		);
		const verified = await globalThis.crypto.subtle.verify(
			{ name: "Ed25519" },
			key,
			signatureBytes,
			messageBytes,
		);
		return verified
			? { ok: true, value: true }
			: { ok: false, reason: "Ed25519 attestation verification failed" };
	} catch {
		return { ok: false, reason: "Ed25519 attestation verification failed" };
	}
}

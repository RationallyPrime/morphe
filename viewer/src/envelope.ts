/**
 * Transport adapter for the package-owned compiled-surface artifact contract.
 *
 * The outer response carries store/routing metadata. The nested artifact is validated against
 * the Pydantic-generated schema at this untrusted boundary, under explicit resource limits.
 */

import type { Node } from "$lib";
import { hasDialect } from "$lib";
import { formatArtifactValidationIssue, validateSurfaceArtifact } from "$lib/artifacts";

export const MAX_SURFACE_ENVELOPE_BYTES = 2 * 1024 * 1024;

export interface SurfaceEnvelope {
	readonly artifactId: string;
	readonly artifactVersion: "1.0.0";
	readonly grammarVersion: string;
	readonly compilerVersion: string;
	readonly dialectHint: string;
	readonly tree: Node;
}

export type EnvelopeResult =
	| { readonly ok: true; readonly envelope: SurfaceEnvelope }
	| { readonly ok: false; readonly reason: string };

export interface EnvelopeParseOptions {
	readonly expectedArtifactId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | null {
	const value = source[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

function mismatch(
	body: Record<string, unknown>,
	outerKey: string,
	artifactValue: string,
): string | null {
	if (!(outerKey in body)) return null;
	const outerValue = stringField(body, outerKey);
	if (outerValue === null) return `invalid ${outerKey}`;
	return outerValue === artifactValue ? null : `${outerKey} does not match artifact.${outerKey}`;
}

/** Narrow a generic artifact-store response into a fully validated viewer envelope. */
export function parseSurfaceEnvelope(
	body: unknown,
	options: EnvelopeParseOptions = {},
): EnvelopeResult {
	if (!isRecord(body)) return { ok: false, reason: "response body is not an object" };

	const artifactId = stringField(body, "artifact_id");
	if (artifactId === null) return { ok: false, reason: "missing artifact_id" };
	if (options.expectedArtifactId && artifactId !== options.expectedArtifactId) {
		return { ok: false, reason: "artifact_id does not match the requested artifact" };
	}
	const dialectHint = stringField(body, "dialect_hint");
	if (dialectHint === null) return { ok: false, reason: "missing dialect_hint" };
	if (!hasDialect(dialectHint)) return { ok: false, reason: "unknown dialect_hint" };

	const artifact = validateSurfaceArtifact(body.artifact);
	if (!artifact.ok) {
		const firstIssue = artifact.issues[0];
		return {
			ok: false,
			reason: firstIssue
				? formatArtifactValidationIssue(firstIssue)
				: "artifact failed generated-schema validation",
		};
	}

	const grammarMismatch = mismatch(body, "grammar_version", artifact.value.grammar_version);
	if (grammarMismatch) return { ok: false, reason: grammarMismatch };
	const compilerMismatch = mismatch(body, "compiler_version", artifact.value.compiler_version);
	if (compilerMismatch) return { ok: false, reason: compilerMismatch };

	return {
		ok: true,
		envelope: {
			artifactId,
			artifactVersion: artifact.value.artifact_version,
			grammarVersion: artifact.value.grammar_version,
			compilerVersion: artifact.value.compiler_version,
			dialectHint,
			tree: artifact.value.tree,
		},
	};
}

async function boundedResponseBytes(response: Response): Promise<Uint8Array | string> {
	const advertisedLength = response.headers.get("content-length");
	if (advertisedLength !== null) {
		const parsedLength = Number(advertisedLength);
		if (Number.isFinite(parsedLength) && parsedLength > MAX_SURFACE_ENVELOPE_BYTES) {
			return `artifact response exceeds ${MAX_SURFACE_ENVELOPE_BYTES} bytes`;
		}
	}

	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (true) {
		const next = await reader.read();
		if (next.done) break;
		length += next.value.byteLength;
		if (length > MAX_SURFACE_ENVELOPE_BYTES) {
			await reader.cancel();
			return `artifact response exceeds ${MAX_SURFACE_ENVELOPE_BYTES} bytes`;
		}
		chunks.push(next.value);
	}

	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

/** Read, bound, decode, and validate an HTTP artifact response. */
export async function parseSurfaceResponse(
	response: Response,
	options: EnvelopeParseOptions = {},
): Promise<EnvelopeResult> {
	const bytes = await boundedResponseBytes(response);
	if (typeof bytes === "string") return { ok: false, reason: bytes };

	let body: unknown;
	try {
		body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch {
		return { ok: false, reason: "artifact response is not valid JSON" };
	}
	return parseSurfaceEnvelope(body, options);
}

/** Artifact ids are bounded opaque identifiers safe for one encoded path segment. */
const ARTIFACT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/;

export function isValidArtifactId(artifactId: string): boolean {
	return ARTIFACT_ID_RE.test(artifactId);
}

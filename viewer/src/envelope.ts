/**
 * Topos surface-artifact envelope — the viewer's read contract (KRA-644/648).
 *
 * `GET {MORPHE_ARTIFACT_BASE_URL}/{artifact_id}` (topos
 * `get_surface_artifact`) returns a flat envelope: lifted metadata
 * (`grammar_version`, `dialect_hint`, …) as siblings of the opaque compiled
 * document under `artifact`. The document is the CompiledSurface JSON whose
 * root node rides in `tree` — validity was gated at the compile site
 * (`validate_node`), so the viewer narrows the envelope shape only and treats
 * the tree as trusted data for the total renderer.
 *
 * Hand-rolled narrowing (no zod): the appliance image ships dependency-free
 * beyond the SvelteKit runtime, and this is one flat object.
 */

import type { Node } from "$lib";

export interface SurfaceEnvelope {
	readonly artifactId: string;
	readonly grammarVersion: string;
	readonly compilerVersion: string;
	readonly dialectHint: string;
	readonly tree: Node;
}

export type EnvelopeResult =
	| { readonly ok: true; readonly envelope: SurfaceEnvelope }
	| { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | null {
	const value = source[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** Narrow a topos surface-artifact response body into the viewer's envelope. */
export function parseSurfaceEnvelope(body: unknown): EnvelopeResult {
	if (!isRecord(body)) return { ok: false, reason: "response body is not an object" };

	const artifactId = stringField(body, "artifact_id");
	if (artifactId === null) return { ok: false, reason: "missing artifact_id" };
	const grammarVersion = stringField(body, "grammar_version");
	if (grammarVersion === null) return { ok: false, reason: "missing grammar_version" };
	const compilerVersion = stringField(body, "compiler_version");
	if (compilerVersion === null) return { ok: false, reason: "missing compiler_version" };
	const dialectHint = stringField(body, "dialect_hint");
	if (dialectHint === null) return { ok: false, reason: "missing dialect_hint" };

	const artifact = body["artifact"];
	if (!isRecord(artifact)) return { ok: false, reason: "missing artifact document" };
	const tree = artifact["tree"];
	if (!isRecord(tree) || typeof tree["kind"] !== "string") {
		return { ok: false, reason: "artifact document has no tree" };
	}

	return {
		ok: true,
		envelope: {
			artifactId,
			grammarVersion,
			compilerVersion,
			dialectHint,
			// Compile-site validated (validate_node); the envelope narrows shape only.
			tree: tree as unknown as Node,
		},
	};
}

/** Artifact ids are `surface:<recipe>:<run_id>`-shaped; bound the charset and length. */
const ARTIFACT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/;

export function isValidArtifactId(artifactId: string): boolean {
	return ARTIFACT_ID_RE.test(artifactId);
}

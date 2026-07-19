/**
 * Shared SSR surface loader: fetch → bound → trust gate → dialect resolution.
 *
 * The multi-source `/s/[source]/[surfaceId]` route runs this pipeline with
 * uniform failure semantics: unreachable upstream → 502, unknown artifact →
 * 404, foreign grammar → 409 naming both versions (MO-D5, never a silent
 * partial render), anything else that fails the gate → 502.
 */

import { error } from "@sveltejs/kit";
import type { Node } from "$lib";
import { GRAMMAR_VERSION, getDialect, hasDialect, validateNodeForDialect } from "$lib";
import { validateNodeDocument } from "$lib/artifacts";
import type { CompilationReceipt } from "$lib/surface-edge/spec.js";
import type { DeliveryReceipt } from "./receipt.js";
import { createDeliveryReceipt } from "./receipt.js";

const FETCH_TIMEOUT_MS = 4000;

/**
 * Run the dialect-mask gate alone. Exposed so the SSR loader can re-validate a
 * tree under a `?dialect=` override: the dialect that actually renders must be
 * a dialect the gate validated, never a bypass (the G|D emission contract).
 */
export function dialectGateReason(tree: Node, dialectHint: string): string | null {
	const effectiveDialectId = getDialect(dialectHint).id;
	const dialectValidation = validateNodeForDialect(tree, effectiveDialectId, {
		validateNodeValue: (value) => validateNodeDocument(value).ok,
	});
	if (dialectValidation.ok) return null;
	const issue = dialectValidation.issues[0];
	return issue?.message ?? "artifact tree violates its dialect constraint";
}

export interface GatedSurfaceRequest {
	readonly fetch: typeof globalThis.fetch;
	readonly url: string;
	/** Identity used in error payloads and page titles. */
	readonly artifactId: string;
	readonly bearer?: string;
	readonly accept?: string;
	readonly parse: (response: Response) => Promise<GatedParseResult>;
	/** Host-bound transform (for example viewer link rewriting) applied before the final gate. */
	readonly transformTree?: (tree: Node) => Node;
	/** Raw `?dialect=` query value; honored only when it names a shipped dialect. */
	readonly dialectOverride: string | null;
}

export interface GatedSurface {
	readonly artifactId: string;
	readonly tree: Node;
	readonly dialectId: string;
	readonly deliveryReceipt?: DeliveryReceipt;
	/** The concrete `surface_id` the admission gate accepted, when the parser reports it. */
	readonly admittedSurfaceId?: string;
}

interface GatedParsedEnvelope {
	readonly artifactId: string;
	readonly grammarVersion: string;
	readonly compilerVersion: string;
	readonly dialectHint: string;
	readonly tree: Node;
	readonly compilationReceipt?: CompilationReceipt;
	readonly admittedSurfaceId?: string;
}

type GatedParseResult =
	| { readonly ok: true; readonly envelope: GatedParsedEnvelope }
	| { readonly ok: false; readonly reason: string; readonly rawGrammarVersion?: string };

export async function loadGatedSurface(request: GatedSurfaceRequest): Promise<GatedSurface> {
	const headers: Record<string, string> = { accept: request.accept ?? "application/json" };
	if (request.bearer !== undefined) headers.authorization = `Bearer ${request.bearer}`;

	let response: Response;
	try {
		response = await request.fetch(request.url, {
			headers,
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
	} catch {
		error(502, {
			message: "The artifact source is unreachable.",
			code: "upstream-unreachable",
			artifactId: request.artifactId,
		});
	}

	if (response.status === 404) error(404, { message: "Unknown artifact." });
	if (!response.ok) {
		error(502, {
			message: `The artifact source answered ${response.status}.`,
			code: "upstream-unreachable",
			artifactId: request.artifactId,
		});
	}

	let parsed: GatedParseResult;
	try {
		parsed = await request.parse(response);
	} catch {
		error(502, {
			message: "The artifact source response could not be read.",
			code: "upstream-unreachable",
			artifactId: request.artifactId,
		});
	}
	if (!parsed.ok) {
		// A breaking-grammar artifact fails the schema pass before any version check
		// can run — surface the dedicated 409 naming both versions instead of a
		// generic trust-gate 502 when the raw stamp says the grammar is foreign.
		if (parsed.rawGrammarVersion && parsed.rawGrammarVersion !== GRAMMAR_VERSION) {
			error(409, {
				message: "This artifact was compiled under a grammar this viewer does not support.",
				code: "grammar-mismatch",
				artifactId: request.artifactId,
				artifactVersion: parsed.rawGrammarVersion,
				supportedVersion: GRAMMAR_VERSION,
			});
		}
		error(502, {
			message: `The artifact failed its trust gate: ${parsed.reason}.`,
			code: "invalid-artifact",
			artifactId: request.artifactId,
		});
	}

	// Fail-closed grammar gate: no partial render, name both versions (MO-D5).
	if (parsed.envelope.grammarVersion !== GRAMMAR_VERSION) {
		error(409, {
			message: "This artifact was compiled under a grammar this viewer does not support.",
			code: "grammar-mismatch",
			artifactId: request.artifactId,
			artifactVersion: parsed.envelope.grammarVersion,
			supportedVersion: GRAMMAR_VERSION,
		});
	}

	const requestedDialectId =
		request.dialectOverride !== null && hasDialect(request.dialectOverride)
			? request.dialectOverride
			: parsed.envelope.dialectHint;
	const dialectId = getDialect(requestedDialectId).id;
	const transformedTree = request.transformTree?.(parsed.envelope.tree) ?? parsed.envelope.tree;
	const validatedTree = validateNodeDocument(transformedTree);
	if (!validatedTree.ok) {
		const issue = validatedTree.issues[0];
		error(502, {
			message: `The delivered tree failed its grammar gate: ${
				issue?.message ?? "tree does not satisfy the current Node grammar"
			}.`,
			code: "invalid-artifact",
			artifactId: request.artifactId,
		});
	}

	// Always gate the exact tree/dialect pair that will render. This is stronger
	// than checking only an override: a host link rewrite is part of delivery and
	// therefore cannot sit outside the grammar + dialect trust boundary.
	const reason = dialectGateReason(validatedTree.value, dialectId);
	if (reason !== null) {
		error(502, {
			message: `The artifact failed its trust gate under dialect "${dialectId}": ${reason}.`,
			code: "invalid-artifact",
			artifactId: request.artifactId,
		});
	}

	const deliveryReceipt =
		parsed.envelope.compilationReceipt === undefined
			? undefined
			: await createDeliveryReceipt(
					parsed.envelope.compilationReceipt,
					validatedTree.value,
					dialectId,
				);
	return {
		artifactId: parsed.envelope.artifactId,
		tree: validatedTree.value,
		dialectId,
		deliveryReceipt,
		...(parsed.envelope.admittedSurfaceId === undefined
			? {}
			: { admittedSurfaceId: parsed.envelope.admittedSurfaceId }),
	};
}

/**
 * Shared SSR surface loader: fetch → bound → trust gate → dialect resolution.
 *
 * Both viewer routes (`/surfaces/[artifactId]` legacy store route and the
 * multi-source `/s/[source]/[surfaceId]` route) run this exact pipeline so a
 * kernel-direct source gets no weaker failure semantics than the store path:
 * unreachable upstream → 502, unknown artifact → 404, foreign grammar → 409
 * naming both versions (MO-D5, never a silent partial render), anything else
 * that fails the gate → 502.
 */

import { error } from "@sveltejs/kit";
import type { Node } from "$lib";
import { GRAMMAR_VERSION, hasDialect } from "$lib";
import type { EnvelopeResult } from "./envelope.js";
import { dialectGateReason } from "./envelope.js";

const FETCH_TIMEOUT_MS = 4000;

export interface GatedSurfaceRequest {
	readonly fetch: typeof globalThis.fetch;
	readonly url: string;
	/** Identity used in error payloads and page titles. */
	readonly artifactId: string;
	readonly bearer?: string;
	readonly parse: (response: Response) => Promise<EnvelopeResult>;
	/** Raw `?dialect=` query value; honored only when it names a shipped dialect. */
	readonly dialectOverride: string | null;
}

export interface GatedSurface {
	readonly artifactId: string;
	readonly tree: Node;
	readonly dialectId: string;
}

export async function loadGatedSurface(request: GatedSurfaceRequest): Promise<GatedSurface> {
	const headers: Record<string, string> = { accept: "application/json" };
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

	const parsed = await request.parse(response);
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

	const dialectId =
		request.dialectOverride !== null && hasDialect(request.dialectOverride)
			? request.dialectOverride
			: parsed.envelope.dialectHint;

	// A `?dialect=` override renders under a dialect the parse gate never saw —
	// re-run the mask gate for the dialect that will ACTUALLY render, so an
	// override can restyle a surface but never bypass a compound policy
	// (a disallowed compound fails closed instead of silently dropping).
	if (dialectId !== parsed.envelope.dialectHint) {
		const reason = dialectGateReason(parsed.envelope.tree, dialectId);
		if (reason !== null) {
			error(502, {
				message: `The artifact failed its trust gate under dialect "${dialectId}": ${reason}.`,
				code: "invalid-artifact",
				artifactId: request.artifactId,
			});
		}
	}

	return { artifactId: parsed.envelope.artifactId, tree: parsed.envelope.tree, dialectId };
}

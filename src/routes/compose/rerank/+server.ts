/*
 * POST /compose/rerank — rank the capability corpus against a visitor's stated
 * pain using Voyage AI's reranker (a hosted cross-encoder).
 *
 * The visitor's typed pain is a normal web query (categorically NOT their
 * operations data — the composer never touches their systems), so sending it to a
 * hosted reranker is fine. The KEY stays server-side; the browser only ever sees
 * ranked capability ids.
 *
 * We rank the WHOLE corpus once per submit and let the client filter the ranked
 * order by the visitor's selected systems — so toggling a system is instant and
 * needs no re-rank. The reranker only REORDERS real, grounded capabilities; it
 * never invents one, so the grounding guarantee is untouched.
 *
 * Graceful by construction: missing key, empty pain, network failure or a non-2xx
 * from Voyage all return `{ source: "fallback" }` with HTTP 200, and the client
 * falls back to its deterministic matcher. The surface never shows an error.
 */

import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";
import { CAPABILITIES } from "$lib/compose";
import type { Capability } from "$lib/compose";
import type { RequestHandler } from "./$types";

const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
/** Voyage reranker model. Swap to "rerank-2.5-lite" for lower latency/cost. */
const VOYAGE_MODEL = "rerank-2.5";

/** The text a capability presents to the reranker — its human-facing meaning. */
function documentFor(cap: Capability): string {
	return `${cap.title}. ${cap.value} ${cap.transform} (themes: ${cap.painPoints.join(", ")})`;
}

interface VoyageRerankResult {
	index: number;
	relevance_score: number;
}

function fallback(reason: string): Response {
	return json({ source: "fallback", reason, ranked: [] satisfies never[] });
}

export const POST: RequestHandler = async ({ request }) => {
	const key = env.VOYAGE_API_KEY;
	if (!key) return fallback("no-key");

	let pain = "";
	try {
		const body = (await request.json()) as { pain?: unknown };
		pain = typeof body.pain === "string" ? body.pain.trim() : "";
	} catch {
		throw error(400, "invalid JSON body");
	}
	if (pain.length === 0) return fallback("empty-pain");

	// Index i in `documents` maps back to CAPABILITIES[i].
	const documents = CAPABILITIES.map(documentFor);

	let res: Response;
	try {
		res = await fetch(VOYAGE_RERANK_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: pain, documents, model: VOYAGE_MODEL }),
		});
	} catch {
		return fallback("network");
	}
	if (!res.ok) return fallback(`voyage-${res.status}`);

	let payload: { data?: VoyageRerankResult[] };
	try {
		payload = (await res.json()) as { data?: VoyageRerankResult[] };
	} catch {
		return fallback("bad-response");
	}

	const ranked = (payload.data ?? [])
		.map((r) => {
			const cap = CAPABILITIES[r.index];
			return cap ? { id: cap.id, score: r.relevance_score } : null;
		})
		.filter((x): x is { id: string; score: number } => x !== null);

	if (ranked.length === 0) return fallback("empty-ranking");

	return json({ source: "voyage", model: VOYAGE_MODEL, ranked });
};

/*
 * POST /api/rerank — the composer's two-stage ranking pipeline (ADR-0002, WS9).
 *
 * Body: { pain: string, systems?: string[] }. The visitor's typed pain is a normal
 * web query (categorically NOT their operations data — the composer never touches
 * their systems), so embedding/reranking it server-side is fine. The KEY stays
 * server-side; the browser only ever sees ranked capability ids + scores.
 *
 * Pipeline:
 *   1. EMBED the query — Voyage `voyage-4-large`, input_type "query", 1024 dims.
 *   2. RETRIEVE — system-aware cosine over the committed capability embeddings →
 *      a bounded shortlist (top-K), so the cross-encoder never sees the whole corpus
 *      (this is what keeps cost/latency bounded as the corpus grows toward ~1000).
 *   3. RERANK the shortlist ONLY — Voyage `rerank-2.5` — returning { id, score } in
 *      relevance order. The relevance THRESHOLD and the result CAP are applied
 *      client-side (D4/D5), where the on-voice copy lives.
 *
 * Graceful by construction: missing key, empty pain, no eligible caps, or any Voyage
 * failure returns { source: "fallback" } (HTTP 200) and the client falls back to its
 * deterministic matcher. The surface never shows an error. The reranker only REORDERS
 * real, grounded capabilities; it never invents one, so the grounding guarantee holds.
 */

import { error, json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { Capability } from "$lib/compose";
import { documentText, retrieve, SYSTEMS } from "$lib/compose";
import type { RequestHandler } from "./$types";

const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
/** Document embeddings were built with this model/dim (scripts/embed-corpus.ts); the query MUST match. */
const EMBED_MODEL = "voyage-4-large";
const EMBED_DIMENSION = 1024;
const RERANK_MODEL = "rerank-2.5";
/** Shortlist size handed to the cross-encoder — bounds rerank cost as the corpus grows. */
const RETRIEVE_K = 50;

const ALL_SYSTEM_IDS: readonly string[] = SYSTEMS.map((s) => s.id);

interface VoyageEmbedResponse {
	data?: { index: number; embedding: number[] }[];
}
interface VoyageRerankResult {
	index: number;
	relevance_score: number;
}
interface RankedId {
	id: string;
	score: number;
}

function fallback(reason: string): Response {
	return json({ source: "fallback", reason, ranked: [] as RankedId[] });
}

/** Embed the visitor's query (input_type "query") into the same space as the corpus. */
async function embedQuery(pain: string, key: string): Promise<number[] | null> {
	let res: Response;
	try {
		res = await fetch(VOYAGE_EMBED_URL, {
			method: "POST",
			headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				input: [pain],
				model: EMBED_MODEL,
				input_type: "query",
				output_dimension: EMBED_DIMENSION,
			}),
		});
	} catch {
		return null;
	}
	if (!res.ok) return null;
	let payload: VoyageEmbedResponse;
	try {
		payload = (await res.json()) as VoyageEmbedResponse;
	} catch {
		return null;
	}
	const vec = payload.data?.[0]?.embedding;
	return Array.isArray(vec) && vec.length === EMBED_DIMENSION ? vec : null;
}

/** Rerank the shortlist with the cross-encoder; index i maps back to `candidates[i]`. */
async function rerankShortlist(
	pain: string,
	candidates: readonly Capability[],
	key: string,
): Promise<RankedId[] | null> {
	const documents = candidates.map(documentText);
	let res: Response;
	try {
		res = await fetch(VOYAGE_RERANK_URL, {
			method: "POST",
			headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({ query: pain, documents, model: RERANK_MODEL }),
		});
	} catch {
		return null;
	}
	if (!res.ok) return null;
	let payload: { data?: VoyageRerankResult[] };
	try {
		payload = (await res.json()) as { data?: VoyageRerankResult[] };
	} catch {
		return null;
	}
	return (payload.data ?? [])
		.map((r): RankedId | null => {
			const cap = candidates[r.index];
			return cap ? { id: cap.id, score: r.relevance_score } : null;
		})
		.filter((x): x is RankedId => x !== null);
}

/** Selected-system ids, defaulting to all systems when the body omits or malforms them. */
function parseSystems(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [...ALL_SYSTEM_IDS];
	const ids = raw.filter((s): s is string => typeof s === "string");
	return ids.length > 0 ? ids : [...ALL_SYSTEM_IDS];
}

export const POST: RequestHandler = async ({ request }) => {
	const key = env.VOYAGE_API_KEY;
	if (!key) return fallback("no-key");

	let pain = "";
	let systems: string[] = [...ALL_SYSTEM_IDS];
	try {
		const body = (await request.json()) as { pain?: unknown; systems?: unknown };
		pain = typeof body.pain === "string" ? body.pain.trim() : "";
		systems = parseSystems(body.systems);
	} catch {
		throw error(400, "invalid JSON body");
	}
	if (pain.length === 0) return fallback("empty-pain");

	// 1. Embed the query.
	const queryEmbedding = await embedQuery(pain, key);
	if (queryEmbedding === null) return fallback("embed-failed");

	// 2. Retrieve — the system-aware cosine shortlist (never the whole corpus).
	const candidates = retrieve(queryEmbedding, systems, RETRIEVE_K).map((r) => r.capability);
	// No eligible capability for this selection: an honest empty answer, not a fallback.
	if (candidates.length === 0) {
		return json({ source: "voyage", model: RERANK_MODEL, ranked: [] as RankedId[] });
	}

	// 3. Rerank the shortlist only.
	const ranked = await rerankShortlist(pain, candidates, key);
	if (ranked === null) return fallback("rerank-failed");
	if (ranked.length === 0) return fallback("empty-ranking");

	return json({ source: "voyage", model: RERANK_MODEL, ranked });
};

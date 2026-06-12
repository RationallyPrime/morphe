/**
 * Stage 1 of the composer's two-stage ranking pipeline (ADR-0002, WS9): a
 * deterministic, in-memory SEMANTIC retriever over the committed capability
 * embeddings.
 *
 * `retrieve` narrows the corpus to a bounded, system-eligible shortlist BEFORE the
 * (expensive, per-pair) Voyage reranker sees it — so reranking cost and latency stay
 * bounded as the corpus grows toward ~1000 capabilities. Two steps, in order:
 *
 *   1. SUBSET ELIGIBILITY (hard gate) — identical rule to `match.ts`
 *      (`isSubsetSelected`): a capability is eligible only when its full required
 *      `systems` set is a subset of the visitor's selected systems.
 *   2. COSINE SHORTLIST — rank the eligible caps by cosine similarity between the
 *      query embedding and each capability's precomputed embedding; take the top K.
 *
 * Pure and total: no clock, no RNG, no I/O. The query embedding is computed upstream
 * (server-side, per request); the document embeddings are the committed build-time
 * artifact (`generated/embeddings.ts`). Ties break on capability id (ascending) for a
 * stable order.
 */

import type { Capability, SystemId } from "./capability.js";
import { CAPABILITIES } from "./corpus.js";
import { CAPABILITY_EMBEDDINGS } from "./embeddings.js";
import { isSubsetSelected } from "./match.js";

/**
 * Cosine similarity of two vectors. Returns 0 for a zero-magnitude vector (no
 * direction to compare) rather than NaN, so a degenerate input can never poison the
 * ranking. Compares over the shorter length defensively.
 */
export function cosine(a: readonly number[], b: readonly number[]): number {
	let dot = 0;
	let na = 0;
	let nb = 0;
	const len = Math.min(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const av = a[i] ?? 0;
		const bv = b[i] ?? 0;
		dot += av * bv;
		na += av * av;
		nb += bv * bv;
	}
	if (na === 0 || nb === 0) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** A capability with its cosine similarity to the query, as produced by `retrieve`. */
export interface RetrievedCapability {
	capability: Capability;
	similarity: number;
}

/**
 * The system-eligible top-`k` capabilities by cosine similarity to `queryEmbedding`.
 *
 * Applies the subset gate first (drops any capability whose required systems are not
 * all selected), scores the survivors by cosine, sorts by similarity desc then id
 * asc, and returns the first `k` (`k < 0` returns the full ranked list). A capability
 * with no committed embedding is skipped defensively — the `retrieve.test.ts`
 * invariant guarantees there are none in the shipped corpus.
 */
export function retrieve(
	queryEmbedding: readonly number[],
	selectedSystems: readonly SystemId[],
	k: number,
	corpus: readonly Capability[] = CAPABILITIES,
	embeddings: Record<string, readonly number[]> = CAPABILITY_EMBEDDINGS,
): RetrievedCapability[] {
	const selected = new Set<SystemId>(selectedSystems);
	const scored: RetrievedCapability[] = [];
	for (const capability of corpus) {
		if (!isSubsetSelected(capability.systems, selected)) continue;
		const vec = embeddings[capability.id];
		if (vec === undefined) continue;
		scored.push({ capability, similarity: cosine(queryEmbedding, vec) });
	}
	scored.sort((a, b) => {
		if (b.similarity !== a.similarity) return b.similarity - a.similarity;
		return a.capability.id < b.capability.id ? -1 : a.capability.id > b.capability.id ? 1 : 0;
	});
	return k >= 0 ? scored.slice(0, k) : scored;
}

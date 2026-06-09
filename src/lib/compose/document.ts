/**
 * The text a capability presents to BOTH the embedder (retrieval, stage 1) and
 * the reranker (cross-encoder, stage 2) — its human-facing meaning, in one place.
 *
 * Single source of truth so retrieval-space (the committed `generated/embeddings.ts`,
 * built by `scripts/embed-corpus.ts`) and rerank-space (the live Voyage call in the
 * ranking pipeline) describe each capability identically and can never drift. Change
 * this and you MUST regenerate the embeddings (`bun scripts/embed-corpus.ts`).
 */

import type { Capability } from "./capability.js";

export function documentText(cap: Capability): string {
	return `${cap.title}. ${cap.value} ${cap.transform} (themes: ${cap.painPoints.join(", ")})`;
}

# ADR-0002 — Two-stage retrieve-then-rerank ranking pipeline for the composer

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Hákon (founder), grill session on KRA-274 (extends D4/D5)
- **Related:** `docs/redesign-plan.md` (WS6, WS9), `src/app/compose/*`, `/api/rerank`, ADR-0001

## Context

The composer ranks the grounded capability corpus against a visitor's stated pain.
The current path (single-pass) sends the **whole corpus** to Voyage `rerank-2.5` and
returns every capability scored, with **no relevance cutoff** — the root cause of the
"113 results for cinnamon hot dogs" bug (see WS6: the score is fetched and discarded at
`Composer.svelte:113`; `localRankIds` pads the correct-but-empty deterministic match
back to the full corpus with `...rest`; `COLLAPSED_LIMIT` only caps the display while
"Show all {N}" re-exposes the wall).

The corpus is expected to grow to **~1000 capabilities across more than the current
three categories** (`Category = crm|erp|wfm`). A cross-encoder reranker scores every
`(query, document)` pair, so latency, cost, and Voyage's per-request document/token cap
all scale **linearly** with corpus size. Reranking ~1000 documents on every submit does
not hold.

The founder's decision: **build the full two-stage pipeline now** — both the staged
*seam* and the *retriever* — not the seam-now/retriever-later compromise. The trade-offs
below are explicitly accepted.

## Decision

Ranking is a **server-side pipeline**: `retrieve(pain, systems) → candidates → rerank →
threshold → cap`.

1. **Retrieve — system-aware, two steps.**
   - **Subset-eligibility gate:** keep only capabilities whose required `systems` are a
     subset of the visitor's selected systems (existing rule, applied first).
   - **Semantic shortlist:** in-memory **cosine similarity** between the **query
     embedding** and each eligible capability's **precomputed embedding**, take the
     **top-K** candidates (K a tuned constant, e.g. 50–100).
   - Capability embeddings are **precomputed at build time** — Voyage
     **`voyage-4-large`, 1024 dims, `input_type: "document"`** (best general-purpose +
     multilingual retrieval; matters for IS queries against EN corpus) — **committed as
     generated static data** at `src/app/compose/embeddings.ts` (NOT under the gitignored
     `generated/` dir — these are deliberately committed) via
     `scripts/embed-corpus.ts` (`bun run embed`). The **query** is embedded per request
     (server-side, existing `VOYAGE_API_KEY`, `input_type: "query"`). **No vector DB /
     ANN** — cosine over ~1000 in-memory vectors is microseconds.
   - *Implementation note (2026-06-09):* stage 1 landed — `document.ts` (shared
     embed/rerank text), the generator, the committed 113-vector artifact, `retrieve.ts`
     (cosine + system-aware top-K), and `retrieve.test.ts` (embedding fixed-point +
     cosine + retrieve). Stage 2 (rerank-over-shortlist endpoint) + the client rewrite
     remain.
2. **Rerank.** Voyage `rerank-2.5` over the **shortlist only**, never the whole corpus.
3. **Threshold.** Gate on `relevance_score` (D4): below an absolute floor → off-domain
   refusal (no cards); a thin band → the few that clear it + a refine invite; above →
   strong match.
4. **Cap.** Dominant-first **top-4** (D5); no "Show all", no full-corpus count.
5. **Endpoint shape.** `POST {pain, systems}` → a small **ranked + scored** result set.
   The client renders it and **no longer filters the corpus client-side**. Toggling a
   system **re-runs the pipeline (debounced)**.
6. **Fallback.** When Voyage is unavailable (no key / network / non-2xx), fall back to
   the **deterministic matcher** (`matchCapabilities`, tag overlap) — which is already
   correctly gated to `matchedTags > 0`. The `localRankIds` `...rest` padding is
   **removed**; the surface never shows an error.

## Consequences

**Positive**
- Scales to 1000+ capabilities: the cross-encoder only ever sees a bounded shortlist.
- Precision (cross-encoder rerank) without the cost of reranking everything.
- Honest relevance gating becomes structural (the score now drives behavior).
- The `retrieve` stage is an **open/closed slot** — a hybrid lexical+semantic retriever,
  or an ANN index, can replace the cosine pass later with no change to rerank or client.

**Negative / explicitly accepted**
- **Loses the instant client-side system toggle.** Retrieval is system-aware, so a
  toggle re-runs the pipeline (debounced). Accepted: recall for the visitor's actual
  stack beats instant toggle, especially at 1000 caps with niche system pairs.
- **Build-time embedding generation.** A generation script (bun, wired as a `just` /
  package task) calls Voyage embeddings for the corpus and **commits** the result, so
  deploys stay deterministic and runtime never re-embeds documents. Embeddings **drift**
  if corpus text changes without regenerating — guarded by an **invariant test**: every
  capability id has a committed embedding (mirrors the dialect keyset fixed point).
- **A second Voyage model** (embeddings) joins the dependency surface alongside rerank.

## Alternatives considered

- **Single-pass rerank-everything** (current): the source of the bug; does not scale.
- **Seam now, retriever later:** rejected by the founder — build the retriever now.
- **Ship embeddings to the client for client-side cosine:** ~MBs of float vectors over
  the wire; rejected. Retrieval stays server-side.
- **Vector DB / ANN (Pinecone, pgvector, etc.):** overkill at ~1000 vectors; in-memory
  cosine is trivial and infra-free. Revisit only at a far larger corpus.
- **Lexical BM25 retrieve instead of embeddings:** viable, but embeddings give semantic
  recall aligned with the rerank's semantic intent. A hybrid (lexical + semantic) is a
  future refinement of the open `retrieve` slot, not a reason to delay.

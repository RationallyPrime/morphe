# Home Redesign Plan — composer-first landing

> Status: planning. Captured 2026-06-09 from direct feedback on the live site.
> Goal: replace the current "editorial wall + form" landing with a brief intro
> that hands straight to the Composer as the interactive centerpiece, and fix the
> composer's relevance so it stops returning everything for everything.
>
> The substrate work that just landed (emphasis subalgebra wired, stroke routed
> through the emphasis orbit, side-stripes killed, SSR color fix) is the
> foundation this builds on. None of it is in question here. This plan is the
> surface/content layer plus the composer's result logic.

## The problem (what's wrong right now)

The landing reads as "super dumb": a stack of equally-weighted editorial bands
with the actual product buried, conflicting calls to action, and a composer that
returns 113 results for a question about cinnamon hot dogs. Specifics:

1. **The eyebrow came back.** "TRY IT · LIVE, READ-ONLY" sits above "What can
   Sókrates do for you?" — a tiny tracked-caps mono label, i.e. the exact
   section-grammar eyebrow the brand bans. "One deliberate kicker" was the polish
   compromise; it still reads as an eyebrow. Kill it.
2. **CTA proliferation — four competing actions.** On one view: "Talk to us"
   (navbar), "Onboarding" (navbar), a greyed "Start the conversation," and a
   non-greyed "Start the conversation," plus "Begin onboarding." A visitor can't
   tell what the one next step is. There should be one primary action.
3. **The composer is not the centerpiece.** It sits mid/low page behind a heavy
   editorial preamble. The product's best proof is treated like just another band.
4. **"Compose / composition" overload.** The copy leans on "Sókrates composes…",
   "composition," etc. It reads weird to a normal buyer. The internal module can
   stay named `compose`; the user-facing words must change.
5. **The composer returns everything.** "How do I make hot dogs that taste like
   cinnamon?" returned all 113 capabilities. No relevance gate. This refutes the
   pitch (it looks like keyword soup, not a system that understands the operation).
6. **The navbar may not earn its place.** Five nav links + a CTA button for what
   should be a single-conversation, one-idea landing. Candidate for removal in
   favor of morphing the page in place (see WS5).

## Target experience

A short scroll, one dominant idea, the product doing the talking:

1. **Brief intro.** One line in the spirit of "Sókrates can be your AI
   department." Minimal supporting sentence. No eyebrow. No 4-paragraph preamble.
2. **Natural hand-off to the composer.** A line like "Find out what Sókrates can
   do for your business" leads directly into the input.
3. **The composer is the centerpiece.** The visitor types their real friction
   ("dkPlus for finance, Humanity for shifts, spreadsheets in between" / a plain
   question) into the box.
4. **Relevant cards surface.** A small, ranked set of capability cards showing how
   Sókrates addresses *their* situation — not a catalog dump. Irrelevant or
   off-domain queries get a graceful, honest response, not 113 cards.
5. **One conversion path.** A single primary CTA ("Talk to us" / book the
   conversation). Onboarding is a secondary/return path, not a co-equal CTA.

## Workstreams

### WS1 — Landing restructure (composer-first)
> Split for tracking: **WS1a** = the top fold (brief intro, composer moved up +
> centerpiece treatment, the "find out what Sókrates can do for your business"
> hand-off). **WS1b** = re-sequence the supporting sections around the composer.
- Brief hero intro (one strong line + one supporting sentence), no eyebrow.
- Move the composer up to be the immediate centerpiece; collapse the editorial
  preamble that currently precedes it.
- Connective copy: intro → "find out what Sókrates can do for your business" →
  input. Keep it short.
- Re-sequence the rest of the page around the composer (proof/governance/close
  become support, not competition).
- Files: `src/routes/+page.svelte`, `src/app/site/present.ts`, `src/app/compose/*`.

### WS2 — CTA consolidation
- Decide the single primary action (likely "Talk to us" / book a conversation).
- Demote onboarding to a secondary/contextual path; remove duplicate "Start the
  conversation" buttons so there is exactly one per view.
- Resolve the greyed-out vs active "Start the conversation" inconsistency.

### WS3 — Kill the eyebrow
- Remove "TRY IT · LIVE, READ-ONLY" and any remaining per-section tracked-caps
  kickers. Let headline + rhythm carry. (Re-audit every section after WS1.)

### WS4 — De-jargon the copy
- Purge user-facing "compose/composition" as the recurring verb. Replace with
  plain language about what it does (answers, surfaces, shows what's possible).
- Sweep `src/app/site/present.ts` and `src/app/compose/present.ts` copy.
- Keep the EN copy only; the IS copy is the user's to write. Internal code names
  (`$compose`, `composeAnswer`, etc.) can stay.

### WS5 — Navbar → morph-the-page (design-heavy, OPEN)
- Direction: drop the 5-link navbar; use Morphe to morph the page in place rather
  than navigate to separate routes. The landing is the composer; deeper content
  surfaces by transformation/progressive disclosure.
- This is where the dialect mechanism + emphasis subalgebra become the lever:
  the same authored tree re-shapes for what the visitor needs next.
- Open questions to resolve before building (see Open Decisions).

### WS6 — Composer relevance (the 113-results bug) — root cause found
> Root cause (grill): `/api/rerank` reranks the WHOLE corpus and returns all N with
> no score cutoff; `Composer.svelte:113` maps the ranked list to ids and **discards
> the `score`**; `localRankIds` **pads** the (correct, empty) deterministic match back
> to the full corpus with `...rest`; `COLLAPSED_LIMIT=4` only caps the *display* while
> "Show all {N}" re-exposes the wall. Both paths return all 113 by construction.
- The relevance gate now lives at the **rerank output of the WS9 pipeline** (gate on
  `relevance_score`): three branches per **D4** — strong / thin-match invite / off-domain
  refusal — plus the **unlisted-system contact path**. No fake matches.
- **D5 cap:** dominant-first **top-4**; **delete "Show all {N}" and any full-corpus
  count** from the primary flow. Thin match may surface fewer than the cap.
- Drop the `localRankIds` `...rest` padding; the deterministic matcher (already gated to
  `matchedTags > 0`) is the correct graceful fallback when Voyage is unavailable.
- Built on the **WS9** two-stage pipeline (below).

### WS7 — Content-catalog layer (the cohort/message idea)
> Split for tracking: **WS7a** = DESIGN (an ADR/spec for the mechanism below —
> message-key resolution at the leaf layer, the `activeCatalog` rune, the keyset
> invariant test, the `?cohort=` plumbing, the agent-built-vs-founder-owned
> boundary). **WS7b** = BUILD (implement it + refactor the de-jargoned EN copy
> into the default catalog + `catalog.test.ts`). WS7b is blocked by WS7a + WS4.
- Design "Lemma 4 for copy": message keys flow through Morphe; an `activeCatalog`
  (locale × cohort) resolves keys to text at render, parallel to how a dialect
  resolves intents. Authored tree references keys; cohort selection re-themes AND
  re-copies the same tree. Emphasis subalgebra is the third lever (which points
  are loud per cohort).
- Sidesteps the no-string-interpolation factory constraint: resolution lives in
  the leaf primitives (like intent→color), not in compound param substitution.
- Cohort plumbing: read `?cohort=` (ad origin trigger) → set dialect + catalog
  (+ budget prior); persist like `activeDialect`; flow the param into the
  contact/onboarding payload to attribute which pitch converts.
- Keyset invariant test (`catalog.test.ts`): every authored key resolves in every
  shipped catalog (the content fixed point).
- Boundary: I build the rails + refactor existing EN copy into the default
  catalog. Cohort definitions, per-cohort stance, IS copy, and per-cohort emphasis
  priors are the user's product/voice calls. (See PRODUCT.md / DESIGN.md §9.)
- This WS is design-first; sequence it after the home is fixed (it depends on the
  de-jargoned copy from WS4 as the default-catalog seed).

### WS8 — Onboarding auth-gate + transactional email (NEW, spawned by D1)
> The D1 resolution keeps onboarding prominent but moves it behind a lightweight
> gate; "Talk to us" stays fully open. This is net-new scope (auth + an outbound
> email dependency the ntfy-only setup can't satisfy). Architectural → **ADR-0001**.
- **Magic-link gate on `/onboarding`:** a stateless **HMAC** token (server secret
  over `email + exp`, short expiry) baked into an emailed link; the route validates
  the signature. **No session store, no DB** — fits `adapter-vercel`. No valid token
  → an email-capture gate screen that sends the link.
- **Transactional email via Postmark** (new dependency): (a) the magic link to the
  *visitor*; (b) lead notifications to **`hakon@sokrates.is`** for both contact
  (`/api/contact`) and onboarding-started. Postmark becomes the canonical notifier;
  ntfy-to-founder may remain as an optional instant push (it already degrades
  gracefully).
- **Prereqs:** verified Postmark sender / DKIM on `sokrates.is` (else visitor mail
  spam-folders); env `POSTMARK_SERVER_TOKEN`, `MAGIC_LINK_SECRET`, `FROM` — set on
  Vercel like `VOYAGE_API_KEY`, graceful when absent. The current ntfy-only endpoints
  notify the founder; a magic link must email the *visitor* — hence the new provider.

### WS9 — Two-stage ranking pipeline (retrieve → rerank), built NOW
> Founder's call (2026-06-09): build both the seam AND the retriever now (not deferred),
> trade-offs accepted. Architecture → **ADR-0002**. WS6 sits on top of this.
- **Server-side pipeline:** `retrieve(pain, systems) → candidates → rerank → threshold → cap`.
- **Retrieve (system-aware):** subset-eligibility gate (systems ⊆ selected) → in-memory
  **cosine** over **precomputed capability embeddings** → top-K candidates. Cap embeddings
  generated at **build time** (Voyage **voyage-4-large, 1024, input_type document**;
  `bun run embed` → committed `src/app/compose/embeddings.ts`); the **query** is
  embedded per request (input_type query). **No vector DB** — cosine over ~1000 in-memory
  vectors is trivial.
- **Status (2026-06-09):** stages **1 + 2 done + green**. Stage 1: `document.ts`,
  `scripts/embed-corpus.ts`, committed 113-vector artifact, `retrieve.ts` (cosine +
  system-aware top-K), `retrieve.test.ts` (10 tests). Stage 2: `/api/rerank` rewritten as
  `{pain, systems}` → embed query → `retrieve(K=50)` → rerank shortlist → `{id, score}`,
  graceful at every stage, backward-compatible with the current client. check 0/0 (484),
  suite 163, build clean. **Live smoke (real Voyage):** ops query "scheduling/overtime"
  → top matches **0.50–0.62** (overtime-prevention, budget-guardrails, overtime-early-warning);
  "cinnamon hot dogs" → top **~0.24** (semantic noise); both bounded to 50, never 113.
  **Empirical threshold bands for D4/WS6:** off-domain ceiling ~0.24, strong ≥0.5 — a floor
  ~0.30–0.40 cleanly rejects off-domain, with room to split thin (~0.35–0.45) from strong.
- **Remaining (= WS6 / KRA-278, needs founder copy + threshold calls):** the client rewrite —
  send `{pain, systems}`, consume `{id, score}`, drop client-side corpus filtering, debounce
  toggle; apply the D4 score branches (off-domain refusal / thin invite) + D5 top-4; delete
  "Show all" + the count; drop the `localRankIds` `...rest` padding.
- **Rerank:** Voyage `rerank-2.5` over the **shortlist only** (not the whole corpus).
- **Threshold + cap:** the D4 score branches + D5 top-4 (see WS6).
- **Endpoint:** `POST {pain, systems}` → ranked + scored shortlist; the client renders and
  no longer filters the corpus client-side. **System toggle re-runs the pipeline
  (debounced)** — the accepted cost of system-aware recall (the old rank-once /
  instant-toggle optimization is dropped on purpose).
- **Fallback:** deterministic matcher when Voyage is absent (already gated; padding removed).
- **Invariant test:** every capability id has a committed embedding (like the dialect
  keyset fixed point); regenerate embeddings when corpus text changes.

## Open design decisions (need the user's call)

- **D1 — RESOLVED (2026-06-09 grill).** The beacon is a *per-fold* budget (CONTRACT:
  the emphasis budget `B` is re-granted per `Frame`), so the real question is *which
  action wears amber in each fold*, not "which one button." Resolution: **Compose**
  owns the beacon in the composer fold; **"Talk to us"** → `/#contact` is the *sole
  conversion beacon* — the label "Start the conversation" is retired (one verb). The
  page holds exactly **two ambers**, in two non-co-visible folds. **Onboarding stays
  and is prominent**, but as a *high-emphasis non-amber* path (NOT a third beacon —
  prominence via size/placement/contrast, not chroma), **gated behind a magic link**
  (stateless HMAC token, no session store) so it qualifies the lead without blocking
  the open conversation. Contact + onboarding-started notifications go to
  `hakon@sokrates.is` via **Postmark**. See **WS8** + **ADR-0001**. Onboarding
  placement: **its own prominent near-close band** (its own `Frame`/fold), distinct
  from the conversational "Talk to us" close. ntfy-to-founder is kept as a bonus push.
- **D2 — RESOLVED (2026-06-09 grill).** Keep a **minimal** sticky bar: brand (home)
  + one **quiet, non-amber** "Talk to us". Drop the 5-link row and the mobile burger
  (the footer already duplicates every route, so the row was pure redundancy). **All
  routes stay real and shareable** — `/architecture`, `/how-it-works`, `/substrate`,
  `/onboarding` — because the Technical Influencer gates on a forwardable
  `/architecture` URL (PRODUCT.md). Discovery: footer (already complete) + in-prose
  Morphe `Link`s + a post-composer "go deeper" (→ D3). Beacon discipline: the nav CTA
  is non-amber so it never collides with the composer's amber `Compose` when both are
  on screen; amber stays exclusively on `Compose` (composer fold) and the close
  conversion beacon. `/substrate` remains footer-only (craft proof, not buyer-routing).
- **D3 — RESOLVED *for now* (2026-06-09 grill), reversible.** Morph is load-bearing
  in exactly one place: the **composer** (query → re-rendered Node tree). Deeper
  content is reached by **real navigation** (in-prose `Link`s + footer + a post-result
  "go deeper" link), not in-place page-morphing — which would break the forwardable
  `/architecture` URL and is over-built for a one-conversation sale. The other morph
  axis is the **WS7 cohort re-theme/re-copy** (orthogonal to navigation). WS5 collapses
  into the D2 minimal-chrome work; **no separate page-morph engine** is built.
  **Parked, not killed:** in-place result→proof morphing on `/` is deferred — revisit
  once the composer-led flow has proven itself.
- **D4 — RESOLVED (2026-06-09 grill).** Low-relevance is **score-gated** (use the
  Voyage `relevance_score` the client currently discards at `Composer.svelte:113`),
  with **three branches** plus a cross-cutting escape hatch:
  1. **Strong match** → the tight ranked set (count per D5).
  2. **Thin match** (some clear a lower band, nothing strong) → the few that clear it
     + a quiet "partial match — tell us more about the systems you run" invite.
  3. **Off-domain** (nothing clears the floor — "cinnamon hot dogs") → an **honest
     refusal that redirects**: name what Sókrates works across; **no cards**. On-voice
     (PRODUCT.md: honesty as differentiation; refusing hot dogs *proves* domain grasp).
  - **Unlisted-system path (cross-cutting, NOT score-gated) — the highest-intent
    lead.** A persistent affordance by the system selector — "Run a system we don't
    list? Tell us, we'll map it" — that **captures the named system as a string** and
    routes to the Postmark→`hakon@sokrates.is` flow. Real cross-system pain blocked
    only by corpus coverage; Hákon scopes it (Hyle) and replies personally, or it
    becomes roadmap. Doubles as a **coverage-demand signal** (which systems prospects
    ask for → what to process next). Mechanism = **explicit affordance + captured
    string** (native control surface), not fragile prose system-name parsing.
  - **Scaling note (from the grill):** the corpus will grow to **a dozen+ systems
    across more than the current 3 categories** — `Category = crm|erp|wfm`
    (`capability.ts:33`) expands, `SYSTEMS` grows, and the flat chip selector +
    hand-curated `FEATURED_IDS` must scale (group by category / search). This makes a
    **tight result cap matter more** (→ D5) and is follow-on scope for the selector UI.
- **D5 — Composer result count.** Target N cards for a good match (3? 5?), and
  whether "see more" exists at all in the primary flow.

## Carry-over from the substrate session
- [ ] Push `a2bcdf2` (the SSR `style:color` fix) once approved — currently 1
      commit ahead of origin, held local.
- [x] Emphasis subalgebra wired, stroke routed through the emphasis orbit,
      side-stripes killed, SSR color fix. (Done; on origin through `2245ad8`.)
- Note: the just-landed home polish (`1e600d6`) is **partly superseded** by this
  redesign. Its substrate-respecting structure is reusable; its composition
  decisions (the kicker, the card layout, the CTA placement) are re-opened here.

## Todo (execution order, for a fresh session)
1. [ ] Resolve Open Decisions D1–D5 with the user.
2. [ ] WS6 — composer relevance fix (investigate ranking; threshold + cap + empty
       state). High-value, somewhat independent; can start early.
3. [ ] WS1 — landing restructure (composer-first, brief intro).
4. [ ] WS2 — CTA consolidation to one primary action.
5. [ ] WS3 — kill the eyebrow + re-audit per-section kickers.
6. [ ] WS4 — de-jargon "compose/composition" in user-facing copy.
7. [ ] WS5 — navbar removal / morph-the-page (after D2/D3 settle).
8. [ ] WS7 — content-catalog layer design + build (depends on WS4 copy).
9. [ ] Browser-verify at desktop + mobile across every dialect (the fixed point).

## Linear (tracking)

Linear **Morphe** project (team Krates-ehf):
https://linear.app/krates-ehf/project/morphe-f0174d9a64df — **all 10 issues created.**

The gate is **KRA-274** (D1–D5). Grill it with the founder first; everything
design-touching is `needs-grill` and blocked on it. Only KRA-275 is
`ready-for-agent`.

| Issue | Workstream | Label | Blocked by |
|---|---|---|---|
| KRA-274 | Decisions (D1–D5) — the gate | `needs-grill` | — |
| KRA-275 | WS3 · Remove the eyebrow | `ready-for-agent` | — |
| KRA-276 | WS4 · De-jargon "compose/composition" | `needs-grill` | — (grill the wording) |
| KRA-277 | WS7a · Content-catalog DESIGN | `needs-grill` | — (relates D2/D3) |
| KRA-278 | WS6 · Composer relevance (the 113 bug) | `needs-grill` · Bug | KRA-274 (D4/D5) — **not AFK** |
| KRA-279 | WS1a · Composer-first top fold | `needs-grill` | KRA-274 |
| KRA-280 | WS2 · One primary CTA | `needs-grill` | KRA-274 (D1) |
| KRA-281 | WS5 · Navbar / morph-the-page | `needs-grill` | KRA-274 (D2/D3) |
| KRA-282 | WS1b · Re-sequence supporting sections | `needs-grill` | KRA-274, KRA-279 |
| KRA-283 | WS7b · Content-catalog BUILD | `needs-grill` | KRA-276, KRA-277 |

Labels are provisional and get tidied post-clear. This doc is the design narrative;
each issue links back to it. The doc + the issues together are the handoff — ready
for a fresh session to execute from as-is.

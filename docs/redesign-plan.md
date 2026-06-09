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
- Files: `src/routes/+page.svelte`, `src/lib/site/present.ts`, `src/lib/compose/*`.

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
- Sweep `src/lib/site/present.ts` and `src/lib/compose/present.ts` copy.
- Keep the EN copy only; the IS copy is the user's to write. Internal code names
  (`$lib/compose`, `composeAnswer`, etc.) can stay.

### WS5 — Navbar → morph-the-page (design-heavy, OPEN)
- Direction: drop the 5-link navbar; use Morphe to morph the page in place rather
  than navigate to separate routes. The landing is the composer; deeper content
  surfaces by transformation/progressive disclosure.
- This is where the dialect mechanism + emphasis subalgebra become the lever:
  the same authored tree re-shapes for what the visitor needs next.
- Open questions to resolve before building (see Open Decisions).

### WS6 — Composer relevance (the 113-results bug)
- Apply a relevance threshold so off-domain / weak-match queries return a small
  set or none — never the full corpus.
- Add a graceful low/zero-relevance state ("that's outside what Sókrates does" /
  "tell us more about the systems you run"), honest and on-voice.
- Cap the surfaced set to a tight, ranked few; drop the "show all 113" catalog
  affordance from the primary flow.
- Investigate: the ranking path in `src/lib/compose/*` and `/api/rerank` (Voyage).
  Determine why every query returns the full set (no score cutoff? reranker not
  gating? fallback returns all?). Fix at the ranking layer, not just the display
  cap.

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

## Open design decisions (need the user's call)

- **D1 — What is the single primary CTA?** "Talk to us" / book a conversation,
  vs. the composer itself being the primary engagement with "Talk to us" as the
  conversion after results. (Likely: composer is the engagement, one "Talk to us"
  is the conversion.)
- **D2 — Navbar: remove entirely, or keep a minimal version?** If removed, how
  does the technical buyer reach `/architecture` depth, and the champion reach
  `/how-it-works`? Does a composer result *morph* into the relevant proof, or do
  those stay as routes reachable some other way?
- **D3 — "Morph the page" mechanics.** In-place section morphing on one route, vs.
  keeping a few routes but dropping the persistent navbar chrome. What triggers a
  morph — the composer result, a cohort param, an explicit "go deeper" affordance?
- **D4 — Low-relevance composer response.** Exact behavior + copy when a query is
  off-domain (hot dogs) vs. plausible-but-thin. Honest refusal vs. "tell us more."
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

A Linear **Morphe** project exists (team Krates-ehf):
https://linear.app/krates-ehf/project/morphe-f0174d9a64df

Issues created:
- **KRA-274** — Decisions: home redesign (D1–D5) · `needs-grill` · the gate.
- **KRA-275** — WS3 · Remove the eyebrow grammar · `ready-for-agent`.

**The rest are blocked: the workspace hit the Linear FREE-TIER issue limit.**
Until it is upgraded (or a trial is started), the remaining workstreams live HERE
as the source of truth. Intended issues (the agreed breakdown — fatties split,
everything design-touching gated on the Decisions issue and decided together
*after* the context clear):

| Intended issue | Label | Blocked by |
|---|---|---|
| WS4 · De-jargon "compose/composition" | `needs-grill` (voice) | none — grill the wording |
| WS6 · Composer relevance (the 113-results bug) | `needs-grill` | KRA-274 — **not AFK**, founder hasn't specified the result behavior/look |
| WS1a · Composer-first top fold (brief intro + hand-off + composer placement) | `needs-grill` | KRA-274 |
| WS1b · Re-sequence the supporting sections | `needs-grill` | KRA-274, WS1a |
| WS2 · Consolidate to one primary CTA | `needs-grill` | KRA-274 (D1) |
| WS5 · Navbar removal / morph-the-page | `needs-grill` | KRA-274 (D2/D3) |
| WS7a · Content-catalog DESIGN (Lemma 4 for copy) | `needs-grill` | none — relates to D2/D3 |
| WS7b · Content-catalog BUILD | `needs-grill` → AFK | WS7a, WS4 |

Labels are provisional and get tidied post-clear. When Linear is upgraded, create
these eight as issues under the Morphe project (rich bodies were drafted for WS4
and WS7a — see this doc's WS4 / WS7 sections for the content), each linking back
to this doc, blocked-by per the table.

The doc travels with the code and is ready for a fresh session to execute from
as-is; the two live Linear issues + this doc together are the handoff.

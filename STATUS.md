# Morphe — Status

**Date:** 2026-06-12
**Verdict: GREEN.** Types clean, all tests pass, production build succeeds.

This is the rolling status snapshot. The deeper ledger — every vision mechanism
mapped to its implementation state — lives in `VISION.md` §15; the scheduled
work closing the code↔vision gaps lives in `docs/reconstruction-plan.md`.

---

## 1. Verification (commands actually run, from the repo root)

Package manager is **bun** (never npm/pnpm/yarn).

| Step | Command | Result |
|---|---|---|
| Types | `bun run check` (`svelte-kit sync && svelte-check`) | **0 errors, 0 warnings** |
| Tests | `bun run test` (`vitest run`) | **409/409 passing** across 22 files |
| Build | `bun run build` (`vite build`) | **Success** (adapter-vercel, `nodejs22.x`) |
| Package | `bun run pack:verify` | **Success** (tarball installed into throwaway Vite + Svelte 5 consumer) |

### Test breakdown (409 total)

- `src/lib/core.test.ts` — 28 (law + factory + dialect smoke, incl. the
  compound-gate template-root-claim rejection and the R1.5 lifecycle +
  dialect-restriction suite).
- `src/lib/dialects/dialects.test.ts` — 75 (Lemma-4 fixed-point parity
  across all six dialects + no-raw-color channel guard + compound-subset
  resolution + CompoundRef authored-surface intent walk + the timaeus
  beacon/grounds suite + the gallery/night plate-derived-pair suite (KRA-349,
  ADR-0005) + the data ⇄ CSS agreement suite (each static `intents.css` block
  equals its dialect's data, selector-aware — KRA-354) + FP7: surface stacks
  ride `applyDialect`, so a boundary swap repaints the ground it stands on).
- `src/lib/dialects/active.test.ts` — 5 (global dialect rune store).
- `src/lib/dialects/arrival.test.ts` — 18 (τ_frame arrival attribution:
  `?cohort=` precedence + arrival sequence against the real store).
- `src/lib/lemmas.property.test.ts` — 29 (lemmas-as-property-tests,
  in-repo seeded fuzzer, 200 cases/property, incl. BUDGET-CONSERVATION ×
  compound-wrapping commutation and the Lemma 6 bounded-delegation suite:
  adversarial deltas, epoch invalidation, liveVaryIds through CompoundRef
  slot fills/args, Within resolution into algebra inputs).
- `src/lib/primitives.render.test.ts` — 51 (SSR render totality + a11y
  for all 22 primitive kinds incl. Action/Overlay, input modes, unknown
  compounds, shared node instances, bound-primitive store seeding, dialect
  compound-gating at render, and Vary rendering from the root choice map
  with clamped fallback).
- `src/lib/delegation/envelope.test.ts` — 1 (ADR-0004 envelope/Delta
  typing wraps a pure tree without touching the grammar).
- `src/lib/state/store.test.ts` — 12 (ADR-0003 client-store contract:
  layered ownership, full JSON values, replace-on-write + notify-on-set,
  dev-freeze; R1.2 event tiers: atomic commit+record, bounded FIFO window,
  injected clock, tier unforgeability, and the architecture scans — store
  reads stay inside declared-bind primitives, no primitive touches the
  escalation context).
- `src/lib/state/actions.test.ts` — 3 (R1.4 action lookup: mapped id
  fires, unmapped id dev-warns and no-ops, missing id never looks up).
- `src/lib/state/digest.test.ts` — 3 (R1.3 ContextDigest: versioned
  JSON-round-trippable snapshot, escalation wrapping captures the
  point-in-time digest).
- `src/app/compose/compose.test.ts` — 41 (composer: corpus grounding
  invariants, presenters, ranking policy).
- `src/app/compose/examples.test.ts` — 9 (system-gated suggestion chips).
- `src/app/compose/replay.test.ts` — 2 (Corollary 2 replay harness:
  recorded digest/input pairs replay deterministically through real compose
  presenters).
- `src/app/compose/retrieve.test.ts` — 10 (two-stage retrieve→rerank).
- `src/app/site/dossier.test.ts` — 23 (onboarding dossier presenter and first
  real mid-loop delegate).
- `src/app/site/site.test.ts` — 32 (site compounds incl. `TimaeusPlate` and
  `SiteEntry` pass the factory gate on a fresh registry; every site presenter
  emits only resolvable compound refs; presenter copy stays out of doctrine
  register (D12); the engagement/identity/plates morphs stay inside their
  promised scope and the plates morph references only the public nine; the
  Trajectory-exclusion grep gate as a test — no excluded token in any
  presenter's emitted tree).
- `src/app/site/intents.test.ts` — 24 (the intent engine, ADR-0006/KRA-355:
  the registration gate, palette matching over the registered vocabulary, the
  flip-the-lights tracer morph riding one engine path, stage deltas through
  the R2 `applyDelta` gate — render totality at the morph seam — and the D12
  voice scan on intent strings).
- `src/app/server/magic-link.test.ts` — 13 (ADR-0001 stateless HMAC
  magic-link gate: unconfigured fail-open + configured token lifecycle).
- `src/app/server/notify.test.ts` — 7 (founder alerts: Postmark + ntfy
  dual-channel, graceful when env is absent).
- `src/app/server/receipt.test.ts` — 5 (deterministic accession receipt ids).
- `src/lib/media.render.test.ts` — 6 (the responsive `<picture>` Media
  extension: the no-sources fixed point renders the bare `<img>` unchanged;
  sources/width/height/eager render the candidate sets with pinned dimensions).
- `scripts/plate-manifest.test.ts` — 12 (the plate derivative plan: rungs ×
  formats + PNG fallback per source, stable order, and the exclusion law —
  a private `t1-*`/raw input throws, never a silent skip).

---

## 2. What is shipped

- **The substrate (Phase 0 of `VISION.md`, complete):** 22 primitive kinds
  (Layout / Content / Input / Feedback / Action / Overlay) + 3 meta kinds +
  `compound`; the context algebra with the four laws wired into the render path
  (including the emphasis renormalization subalgebra and the stroke orbit);
  three token strata; the compound factory with its validation gate; six
  dialects (`gallery` — the museum-paper light ground, **default** per
  ADR-0005 — `night`, `icelandic-archive` (the retired-as-default amber
  identity), `clinical`, `reykjavik-registry`, `timaeus`)
  pulled apart at the beacon and the ground, all passing the intent-keyset
  fixed-point tests and the data ⇄ CSS agreement suite,
  each shipping a surface stack that `applyDialect` emits (FP7) so a
  dialect swap repaints its grounds; the global dialect flip (`activeDialect`,
  persisted, toggle on `/substrate`, applied at the shell boundary in
  `+layout.svelte` so native chrome re-themes too);
  the Lemma 5 client store (`MorpheStore`, ADR-0003: prop > context > per-root
  ownership at `MorpheRoot`, full JSON values, flat keys) with all six
  bindable primitives reading initial tier-1 state from and committing back
  to their declared `.bind` paths; the R1.2/R1.3 event tiers and digest
  recorder (atomic `commitTier1` → bounded recent-event window, injected clock;
  versioned `ContextDigest`; typed tier-2 vocabulary + `MorpheRoot.onEscalate`
  records); the R1.4 declarative action wire (`MorpheRoot.actions` binds
  in-tree `Button.action` ids without putting handlers in the tree); the R1.5 compound lifecycle
  (`candidate`/`promoted` through one gate) with `Dialect.compounds[]`
  render-gating via the `restrictCompounds` view; the R2 bounded-delegation
  surface (ADR-0004: `Within`/`VaryId` in the grammar, the emission envelope +
  pure/total `applyDelta` in `delegation/`, `MorpheRoot.choices?` as the only
  renderer contract change — epochs never reach the renderer), with the `py/`
  Pydantic mirror and committed schema re-synced to the now-complete grammar.
- **The site (the dignity test, live):** the stage home (`/`, ADR-0006):
  hero → the composer → the **intent engine** (a chip row + Cmd/Ctrl+K
  palette riding one execution path; five content morphs — governance,
  technical, engagement, identity, plates — as hand-authored Deltas against a
  `Vary`-keyed stage envelope through the R2 `applyDelta` gate, plus the
  flip-the-lights gallery↔night tracer; chips degrade to plain anchors
  without JS) → the night-pinned plate tease → the contact close, under the
  two-beacon discipline (composer submit + contact submit); `/how-it-works`
  retold as the Timaeus narrative
  (B1–B9, nine plates in two acts around the authoring loop;
  public story ends at B9 — the
  Trajectory exclusion is enforced by the S3/S5/S6 tests and the CI grep gate);
  `/architecture`, `/onboarding` (stateless magic-link gate + Postmark email),
  `/substrate` (the six-way dialect toggle + the night-pinned vitrine);
  the plate derivative pipeline
  (`bun run plates`: committed `assets/plates/` originals → byte-deterministic
  AVIF/WebP/PNG rungs in `static/images/plates/`, ≤ 300 KB each) feeding the
  responsive `Media.sources` grammar extension; the capability composer with two-stage retrieve→rerank ranking
  (`/api/rerank`, Voyage server-side) and relevance thresholds; minimal nav;
  contact + onboarding forwarding endpoints; τ_frame arrival attribution
  (`?cohort=` selects the dialect on landing — valid param > persisted choice,
  explicit toggle always wins afterward).

Deployed on Vercel (`sokrates-spunagreind/morphe`); `VOYAGE_API_KEY` set on
Production, server-side only.

---

## 3. Honest gaps & reserved seams (the named edges)

Two different categories — do not conflate them:

- **Reserved strata sockets** (`CONTRACT.md` §11): `Vary.objective` (what a
  future mid loop optimizes — the variation points themselves are wired as of
  R2, and the home intent stage is their first production consumer) and
  `persona`. These are *typed seams for Phase 2*, not unfinished
  features. Do not wire them ad hoc; do not remove them.
- **Known defects, scheduled** (`CONTRACT.md` §12 / `docs/reconstruction-plan.md`):
  **none** — the R0 substrate-integrity pass closed all four (budget×expansion
  commutation, render totality at unknown compounds, index child keying,
  apply-time intent validation). New defects land in CONTRACT §12 first.

Other standing notes:

- Open-state `$effect`s (Dialog/Popover) are client-only; SSR emits CLOSED
  markup by design (no `window` on the server).
- Fonts / Material Symbols are a CDN dependency.

---

## 4. Run instructions

```bash
bun install
bun run check      # svelte-kit sync && svelte-check → 0 errors, 0 warnings
bun run test       # vitest run                      → 409/409 passing
bun run build      # vite build                      → client + SSR bundles
bun run pack:verify # tarball install in throwaway Vite + Svelte consumer
bun run dev        # http://localhost:5173/          (the dignity test)
```

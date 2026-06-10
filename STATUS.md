# Morphe — Status

**Date:** 2026-06-10
**Verdict: GREEN.** Types clean, all tests pass, production build succeeds.

This is the rolling status snapshot. The deeper ledger — every vision mechanism
mapped to its implementation state — lives in `VISION.md` §15; the scheduled
work closing the code↔vision gaps lives in `docs/reconstruction-plan.md`.

---

## 1. Verification (commands actually run, from the repo root)

Package manager is **bun** (never npm/pnpm/yarn).

| Step | Command | Result |
|---|---|---|
| Types | `bun run check` (`svelte-kit sync && svelte-check`) | **0 errors, 0 warnings** (506 files) |
| Tests | `bun run test` (`vitest run`) | **287/287 passing** across 16 files |
| Build | `bun run build` (`vite build`) | **Success** (adapter-vercel, `nodejs22.x`) |

### Test breakdown (287 total)

- `src/lib/morphe/core.test.ts` — 28 (law + factory + dialect smoke, incl. the
  compound-gate template-root-claim rejection and the R1.5 lifecycle +
  dialect-restriction suite).
- `src/lib/morphe/dialects/dialects.test.ts` — 51 (Lemma-4 fixed-point parity
  across all four dialects + no-raw-color channel guard + compound-subset
  resolution + CompoundRef authored-surface intent walk + the timaeus
  beacon/grounds suite + FP7: surface stacks ride `applyDialect`, so a
  boundary swap repaints the ground it stands on).
- `src/lib/morphe/dialects/active.test.ts` — 5 (global dialect rune store).
- `src/lib/morphe/dialects/arrival.test.ts` — 13 (τ_frame arrival attribution:
  `?cohort=` precedence + arrival sequence against the real store).
- `src/lib/morphe/lemmas.property.test.ts` — 29 (lemmas-as-property-tests,
  in-repo seeded fuzzer, 200 cases/property, incl. BUDGET-CONSERVATION ×
  compound-wrapping commutation and the Lemma 6 bounded-delegation suite:
  adversarial deltas, epoch invalidation, liveVaryIds through CompoundRef
  slot fills/args, Within resolution into algebra inputs).
- `src/lib/morphe/primitives.render.test.ts` — 51 (SSR render totality + a11y
  for all 22 primitive kinds incl. Action/Overlay, input modes, unknown
  compounds, shared node instances, bound-primitive store seeding, dialect
  compound-gating at render, and Vary rendering from the root choice map
  with clamped fallback).
- `src/lib/morphe/delegation/envelope.test.ts` — 1 (ADR-0004 envelope/Delta
  typing wraps a pure tree without touching the grammar).
- `src/lib/morphe/state/store.test.ts` — 12 (ADR-0003 client-store contract:
  layered ownership, full JSON values, replace-on-write + notify-on-set,
  dev-freeze; R1.2 event tiers: atomic commit+record, bounded FIFO window,
  injected clock, tier unforgeability, and the architecture scans — store
  reads stay inside declared-bind primitives, no primitive touches the
  escalation context).
- `src/lib/morphe/state/actions.test.ts` — 3 (R1.4 action lookup: mapped id
  fires, unmapped id dev-warns and no-ops, missing id never looks up).
- `src/lib/morphe/state/digest.test.ts` — 3 (R1.3 ContextDigest: versioned
  JSON-round-trippable snapshot, escalation wrapping captures the
  point-in-time digest).
- `src/lib/compose/compose.test.ts` — 37 (composer: corpus grounding
  invariants, presenters, ranking policy).
- `src/lib/compose/replay.test.ts` — 2 (Corollary 2 replay harness:
  recorded digest/input pairs replay deterministically through real compose
  presenters).
- `src/lib/compose/retrieve.test.ts` — 10 (two-stage retrieve→rerank).
- `src/lib/site/site.test.ts` — 24 (site compounds incl. `TimaeusPlate` pass
  the factory gate on a fresh registry; every site presenter emits only
  resolvable compound refs; S3: the Trajectory-exclusion grep gate as a test —
  no excluded token in any presenter's emitted tree).
- `src/lib/morphe/media.render.test.ts` — 6 (the responsive `<picture>` Media
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
  three token strata; the compound factory with its validation gate; four
  dialects (`icelandic-archive` default, `clinical`, `reykjavik-registry`,
  `timaeus` — the plates' blue-constellation world on the minted cobalt scale)
  pulled apart at the beacon, all passing the intent-keyset fixed-point tests,
  each shipping a surface stack that `applyDialect` now emits (FP7) so a
  dialect swap repaints its grounds; the global dialect flip (`activeDialect`, persisted, toggle on `/substrate`);
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
- **The site (the dignity test, live):** composer-first home (`/`) with the
  two-amber beacon discipline; `/how-it-works` retold as the Timaeus narrative
  (B1–B9, nine plates in two acts around the authoring loop, rendered
  per-surface under the `timaeus` dialect; public story ends at B9 — the
  Trajectory exclusion is enforced by the S3 test and the CI grep gate);
  `/architecture`, `/onboarding`, `/substrate`; the plate derivative pipeline
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
  R2) and `persona`. These are *typed seams for Phase 2*, not unfinished
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
bun run test       # vitest run                      → 287/287 passing
bun run build      # vite build                      → client + SSR bundles
bun run dev        # http://localhost:5173/          (the dignity test)
```

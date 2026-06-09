# Morphe — Status

**Date:** 2026-06-09
**Verdict: GREEN.** Types clean, all tests pass, production build succeeds.

This is the rolling status snapshot. The deeper ledger — every vision mechanism
mapped to its implementation state — lives in `VISION.md` §15; the scheduled
work closing the code↔vision gaps lives in `docs/reconstruction-plan.md`.

---

## 1. Verification (commands actually run, from the repo root)

Package manager is **bun** (never npm/pnpm/yarn).

| Step | Command | Result |
|---|---|---|
| Types | `bun run check` (`svelte-kit sync && svelte-check`) | **0 errors, 0 warnings** (486 files) |
| Tests | `bun run test` (`vitest run`) | **202/202 passing** across 9 files |
| Build | `bun run build` (`vite build`) | **Success** (adapter-vercel, `nodejs22.x`) |

### Test breakdown (202 total)

- `src/lib/morphe/core.test.ts` — 21 (law + factory + dialect smoke, incl. the
  compound-gate template-root-claim rejection).
- `src/lib/morphe/dialects/dialects.test.ts` — 37 (Lemma-4 fixed-point parity
  across all three dialects + no-raw-color channel guard).
- `src/lib/morphe/dialects/active.test.ts` — 5 (global dialect rune store).
- `src/lib/morphe/dialects/arrival.test.ts` — 13 (τ_frame arrival attribution:
  `?cohort=` precedence + arrival sequence against the real store).
- `src/lib/morphe/lemmas.property.test.ts` — 21 (lemmas-as-property-tests,
  in-repo seeded fuzzer, 200 cases/property, incl. BUDGET-CONSERVATION ×
  compound-wrapping commutation).
- `src/lib/morphe/primitives.render.test.ts` — 45 (SSR render totality + a11y
  for all 22 primitive kinds incl. Action/Overlay, input modes, unknown
  compounds, shared node instances).
- `src/lib/compose/compose.test.ts` — 37 (composer: corpus grounding
  invariants, presenters, ranking policy).
- `src/lib/compose/retrieve.test.ts` — 10 (two-stage retrieve→rerank).
- `src/lib/site/site.test.ts` — 13 (site compounds pass the factory gate on a
  fresh registry; every site presenter emits only resolvable compound refs —
  the smoke layer that catches a gate-tightening breaking a shipped def).

---

## 2. What is shipped

- **The substrate (Phase 0 of `VISION.md`, complete):** 22 primitive kinds
  (Layout / Content / Input / Feedback / Action / Overlay) + 3 meta kinds +
  `compound`; the context algebra with the four laws wired into the render path
  (including the emphasis renormalization subalgebra and the stroke orbit);
  three token strata; the compound factory with its validation gate; three
  dialects (`icelandic-archive` default, `clinical`, `reykjavik-registry`)
  pulled apart at the beacon, all passing the intent-keyset fixed-point tests;
  the global dialect flip (`activeDialect`, persisted, toggle on `/substrate`).
- **The site (the dignity test, live):** composer-first home (`/`) with the
  two-amber beacon discipline, `/how-it-works`, `/architecture`, `/onboarding`,
  `/substrate`; the capability composer with two-stage retrieve→rerank ranking
  (`/api/rerank`, Voyage server-side) and relevance thresholds; minimal nav;
  contact + onboarding forwarding endpoints; τ_frame arrival attribution
  (`?cohort=` selects the dialect on landing — valid param > persisted choice,
  explicit toggle always wins afterward).

Deployed on Vercel (`sokrates-spunagreind/morphe`); `VOYAGE_API_KEY` set on
Production, server-side only.

---

## 3. Honest gaps & reserved seams (the named edges)

Two different categories — do not conflate them:

- **Reserved strata sockets** (`CONTRACT.md` §11): declarative `action` ids,
  `bind` store-paths, inert `Vary`/`objective`, ungated `dialect.compounds[]`,
  `persona`. These are *typed seams for Phases 1–2*, not unfinished features.
  Do not wire them ad hoc; do not remove them.
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
bun run test       # vitest run                      → 166/166 passing
bun run build      # vite build                      → client + SSR bundles
bun run dev        # http://localhost:5173/          (the dignity test)
```

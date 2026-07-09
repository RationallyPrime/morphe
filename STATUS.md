# Morphe — Status

**Date:** 2026-07-09
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
| Tests | `bun run test` (`vitest run` + the dom config) | **329/329 passing** across 21 files |
| Build | `bun run build` (`vite build`) | **Success** (adapter-vercel, `nodejs22.x`) |
| Package | `bun run pack:verify` | **Success** (tarball installed into throwaway Vite + Svelte 5 consumer) |

### Test breakdown (329 total, 21 files)

`src/app/**` (compose/site/server) no longer exists — the sokrates-website
decoupling (2026-06-23, `f0c76b4`) removed it wholesale; what remains is the
substrate package, the neutral demo host, and the box viewer, each with its
own test file(s):

- `src/lib/dialects/dialects.test.ts` — 107 (Lemma-4 fixed-point parity
  across all nine dialects + no-raw-color channel guard + compound-subset
  resolution + CompoundRef authored-surface intent walk + the timaeus
  beacon/grounds suite + the gallery/night plate-derived-pair suite
  (ADR-0005) + the data ⇄ CSS agreement suite (each static `intents.css`
  block equals its dialect's data, selector-aware) + FP7: surface stacks ride
  `applyDialect`, so a boundary swap repaints the ground it stands on).
- `src/lib/primitives.render.test.ts` — 61 (SSR render totality + a11y for
  all primitive kinds incl. Action/Overlay, input modes, unknown compounds,
  shared node instances, bound-primitive store seeding, dialect
  compound-gating at render, and Vary rendering from the root choice map with
  clamped fallback).
- `src/lib/core.test.ts` — 28 (law + factory + dialect smoke, incl. the
  compound-gate template-root-claim rejection and the R1.5 lifecycle +
  dialect-restriction suite).
- `src/lib/lemmas.property.test.ts` — 29 (lemmas-as-property-tests,
  in-repo seeded fuzzer, 200 cases/property, incl. BUDGET-CONSERVATION ×
  compound-wrapping commutation and the Lemma 6 bounded-delegation suite:
  adversarial deltas, epoch invalidation, liveVaryIds through CompoundRef
  slot fills/args, Within resolution into algebra inputs).
- `viewer/src/envelope.test.ts` — 20 (box-viewer artifact-id + surface-envelope
  parsing/validation — the topos read-route contract).
- `src/lib/dialects/arrival.test.ts` — 18 (τ_frame arrival attribution:
  `?dialect=` precedence + arrival sequence against the real store).
- `src/routes/_playground/local-ai.test.ts` — 17 (local adaptive-draft
  generation over the Prompt API surface: availability states, fallback
  draft on unavailable/error, response-constraint enforcement).
- `src/lib/state/store.test.ts` — 12 (ADR-0003 client-store contract:
  layered ownership, full JSON values, replace-on-write + notify-on-set,
  dev-freeze; R1.2 event tiers: atomic commit+record, bounded FIFO window,
  injected clock, tier unforgeability, and the architecture scans — store
  reads stay inside declared-bind primitives, no primitive touches the
  escalation context).
- `src/lib/media.render.test.ts` — 6 (the responsive `<picture>` Media
  extension: the no-sources fixed point renders the bare `<img>` unchanged;
  sources/width/height/eager render the candidate sets with pinned dimensions).
- `src/lib/dialects/active.test.ts` — 5 (global dialect rune store).
- `src/routes/_playground/validation.test.ts` — 5 (local adaptive draft
  response-constraint validation).
- `src/lib/state/actions.test.ts` — 3 (R1.4 action lookup: mapped id
  fires, unmapped id dev-warns and no-ops, missing id never looks up).
- `src/lib/state/digest.test.ts` — 3 (R1.3 ContextDigest: versioned
  JSON-round-trippable snapshot, escalation wrapping captures the
  point-in-time digest).
- `src/routes/api/adaptive/decision/decision.test.ts` — 3 (the adaptive
  sidecar bridge: calls `MORPHE_AGENT_BASE_URL` when configured, otherwise
  returns the deterministic schema-valid fallback tree).
- `src/routes/_playground/presenters.test.ts` — 3 (neutral playground demo
  presenters emit only resolvable compound refs).
- `scripts/derive-plates.test.ts` — 3 (the plate derivative plan: rungs ×
  formats + PNG fallback per source).
- `src/lib/grammar/version.test.ts` — 2 (`GRAMMAR_VERSION` parity guard).
- `src/lib/delegation/envelope.test.ts` — 1 (ADR-0004 envelope/Delta
  typing wraps a pure tree without touching the grammar).
- `src/routes/substrate/substrate-page.render.test.ts` — 1 (the `/substrate`
  playground page renders without throwing).
- `src/routes/plate-proof/tree.test.ts` — 1 (the `/plate-proof` demo tree
  renders without throwing).
- `src/test-fixtures/cms/render-smoke.test.ts` — 1 (runs under the separate
  jsdom `vitest.dom.config.ts`: a CMS-compiled tree renders in the DOM
  without throwing).

---

## 2. What is shipped

- **The substrate (Phase 0 of `VISION.md`, complete):** 22 primitive kinds
  (Layout / Content / Input / Feedback / Action / Overlay) + 4 meta kinds
  (`slot` / `param-ref` / `vary` / `within`) + `compound`; the context algebra
  with the four laws wired into the render path (including the emphasis
  renormalization subalgebra and the stroke orbit); three token strata; the
  compound factory with its validation gate; nine dialects (`gallery` — the
  museum-paper light ground, **default** per ADR-0005 — `night`,
  `icelandic-archive` (the retired-as-default amber identity), `clinical`,
  `reykjavik-registry`, `timaeus`, and the three register-expansion cohorts
  `ledger`, `estate`, `foundry`)
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
- **The neutral demo host (this repo's own routes, proof surfaces only —
  the Sókrates marketing site now lives in the separate `sokrates-website`
  repo and imports Morphe as `@rationallyprime/morphe`):** `/` — the workbench
  index linking the playground, CMS preview, and published-pointer proof;
  `/substrate` — the full-featured neutral playground: the nine-way dialect
  toggle over all shipped dialects, one authored demo tree, live `actions`,
  `bind` paths, `choices`, neutral assets, adaptive fallback rendering, and a
  pinned nested-dialect proof; `/preview/[artifactId]/[revisionId]` — the
  local CMS preview route (reads compiled trees from
  `compiled/capability-pages/**`, falling back to the built-in
  `capability-page.demo/rev-001` fixture); `/p/[slug]` — the publication
  pointer route (`publications.json` → compiled revision; `/p/demo` always
  backed by the neutral built-in fixture); `/dignity` — a compatibility
  redirect to `/substrate`; `/plate-proof` — the responsive `Media.sources`
  plate-derivative proof tree; `/api/adaptive/decision` — the adaptive
  sidecar bridge (calls `MORPHE_AGENT_BASE_URL` when configured, otherwise
  returns a deterministic schema-valid fallback tree); τ_frame arrival
  attribution (`?dialect=` selects the dialect on landing — valid param >
  persisted choice, explicit toggle always wins afterward).
- **The box viewer (`viewer/`, KRA-648 / MO-D3):** a second, stripped
  SvelteKit app sharing the same `$lib`, exactly one route
  (`/surfaces/[artifactId]`, SSR-fetches a compiled artifact from
  `MORPHE_ARTIFACT_BASE_URL/{id}`) plus `/healthz`; fail-closed
  `grammar_version` gate (a mismatched artifact renders a 409 diagnostic);
  adapter is env-switched (`MORPHE_VIEWER_ADAPTER=node` → adapter-node for the
  distroless image, `viewer/Dockerfile`, built from repo root).

Package published to npmjs as the public `@rationallyprime/morphe` (tags
`v0.3.2` / `py-v0.4.0` and others — see `git tag`). The neutral demo host can
deploy to Vercel project `sokrates-spunagreind/morphe`; the Sókrates website
deploys from the separate website repo/project, not from this repository.

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
- Fonts / Material Symbols are self-hosted (`src/app-fonts.css`, fontsource +
  material-symbols packages) — the box viewer ships to air-gapped
  appliances, so no CDN font links.

---

## 4. Run instructions

```bash
bun install
bun run check      # svelte-kit sync && svelte-check → 0 errors, 0 warnings
bun run test       # vitest run (+ dom config)       → 329/329 passing
bun run build      # vite build                      → client + SSR bundles
bun run pack:verify # tarball install in throwaway Vite + Svelte consumer
bun run dev        # http://localhost:5173/          (the neutral playground)
```

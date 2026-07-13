# Morphe — Status

**Date:** 2026-07-13
**Verdict: GREEN.** The complete web, viewer, Python, schema, build, and package gate passes.

This is the rolling status snapshot. The deeper ledger — every vision mechanism
mapped to its implementation state — lives in `VISION.md` §15; the scheduled
work closing the code↔vision gaps lives in `docs/reconstruction-plan.md`.

---

## 1. Verification (commands actually run, from the repo root)

Package manager is **bun** (never npm/pnpm/yarn).

| Step | Command | Result |
|---|---|---|
| Types | root + viewer `svelte-check`, `ty check` | **0 errors, 0 warnings** |
| Web tests | `bun run test` | **376 + 1 DOM passing** across 24 files |
| Python tests | `pytest` | **173 passing** |
| Builds | root Vercel + stripped adapter-node viewer | **Success** |
| Schemas | grammar + surface + CMS drift checks | **Byte-stable** |
| npm package | `bun run pack:verify` | **Installed consumer, exports, masks, client and SSR pass** |
| Python package | `just py-pack-verify` | **Wheel + sdist, 10 resources, 9 isolated mask loads pass** |

The high-value suites cover all nine dialects, the algebra/property laws, factory and render
totality, generated artifact trust, dialect-constrained ingress, the stripped viewer, state and
delegation seams, Pydantic grammar/compiler/CMS contracts, and exact installed-mask structured
emission with retry/fail-closed behavior.

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
  (`candidate`/`promoted` through one gate), the Pydantic-owned promoted
  `SignalCard` catalog, and generated `Dialect.compounds[]` render-gating via
  the `restrictCompounds` view (`clinical` is restricted; eight dialects remain
  explicitly unrestricted); the R2 bounded-delegation
  surface (ADR-0004: `Within`/`VaryId` in the grammar, the emission envelope +
  pure/total `applyDelta` in `delegation/`, `MorpheRoot.choices?` as the only
  renderer contract change — epochs never reach the renderer), with the `py/`
  Pydantic mirror and committed schema re-synced to the now-complete grammar.
- **The neutral demo host (this repo's own routes, proof surfaces only):** `/` — the workbench
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
- **The stripped viewer (`viewer/`):** a second, stripped
  SvelteKit app sharing the same `$lib`, exactly one route
  (`/surfaces/[artifactId]`, SSR-fetches a compiled artifact from
  `MORPHE_ARTIFACT_BASE_URL/{id}`) plus `/healthz`; fail-closed
  generated artifact-schema and dialect-policy ingress gates (malformed,
  mismatched, or out-of-dialect artifacts fail closed before rendering);
  adapter is env-switched (`MORPHE_VIEWER_ADAPTER=node` → adapter-node for the
  distroless image, `viewer/Dockerfile`, built from repo root).
- **Projection M artifacts and structured-emission lab:** one authoritative
  Pydantic grammar/catalog generates TypeScript, full schemas, the decision
  wire, and nine genuine per-dialect `G|D` masks. The npm and Python packages
  carry the masks with a versioned SHA-256 manifest. The Pydantic-AI lab injects
  the exact installed per-request mask, retries dialect-invalid output, and
  falls back without breaking the render path. This is package proof, not a
  claim that a production slow-loop host is deployed.

Package published to npmjs as the public `@rationallyprime/morphe` (tags
`v0.3.2` / `py-v0.4.0` and others — see `git tag`). Deployment ownership and
private infrastructure details are intentionally outside this public snapshot.

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
  material-symbols packages) so the stripped viewer has no runtime font-network
  dependency.

---

## 4. Run instructions

```bash
bun install
bun run check      # svelte-kit sync && svelte-check → 0 errors, 0 warnings
bun run test       # vitest run (+ dom config)       → 376 + 1 DOM passing
bun run build      # vite build                      → client + SSR bundles
bun run pack:verify # tarball install in throwaway Vite + Svelte consumer
bun run dev        # http://localhost:5173/          (the neutral playground)
```

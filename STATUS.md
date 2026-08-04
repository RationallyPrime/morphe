# Morphe — Status

**Date:** 2026-08-04
**Verdict: GREEN.** The complete web, viewer, Python, schema, build, and package gate passes.

ADR-0022 now machine-marks `ActionSummary@1.0.0` as the compound gold standard. Its maintained
fixture closes the catalog → CMS → renderer → host-socket → nine-dialect → two-browser circuit;
gold remains an evidence certification, not a third compound lifecycle state.

ADR-0023 mints nine additional neutral definitions and gives all seventeen promoted compounds one
complete evidence ledger. Clinical admission now derives from the authoritative catalog; the
separate Compound Mint exhibit proves every non-gold argument and slot without moving host
capabilities or governance into Morphe.

ADR-0024 completes Lemma 6's model-free operational circuit: a resolver-specific variation index,
explicit path-plus-kind digest projection, and the pure `runMidLoop` host runtime admit only
bounded choices. It fails untrusted malformed output closed, keeps user overrides locked until a
strictly higher safe-integer epoch, and leaves `MorpheRoot` choice-only. It does not add a tier-2
producer, model delegate, corpus policy, or operational ledger to Morphe.

The neutral `/substrate` host now proves that circuit under hydration and carries a sealed
compatibility exhibit with one real signed route fixture from each Krepis kernel. Those fixed
public artifacts are admitted, compiled twice, checked against their exact SurfaceSpec/Node
receipts, rendered under all nine dialects, and exercised in Chromium and Firefox. They remain
producer evidence, not copied kernel models, live production data, or Morphe-owned authority.

The KRA-762 Stage 1 release candidate is also green: the TypeScript edge compiler, source-v1
trust gate, dual viewer, and untouched legacy rollback reader are verified together. Production
activation remains viewer-first and follows merge; kernels do not switch before that deployment.

This is the rolling status snapshot. The deeper ledger — every vision mechanism
mapped to its implementation state — lives in `VISION.md` §15; the scheduled
work closing the code↔vision gaps lives in `docs/reconstruction-plan.md`.

---

## 1. Verification (commands actually run, from the repo root)

Package manager is **bun** (never npm/pnpm/yarn).

| Step | Command | Result |
|---|---|---|
| Types | root + viewer `svelte-check`, `ty check` | **0 errors, 0 warnings** |
| Web tests | `bun run test` | **906 server + 14 DOM passing** |
| Browser seams | edge + contrast Playwright gates | **72 passing** across Chromium + Firefox |
| Python tests | `pytest` | **562 passing** |
| Builds | root Vercel + stripped adapter-node viewer | **Success** |
| Schemas | grammar + surface + CMS drift checks | **Byte-stable** |
| npm package | `bun run pack:verify` | **Installed exports, source admission, compiler parity, client and SSR pass** |
| Python package | `just py-pack-verify` | **Wheel + sdist, 10 resources, 9 isolated mask loads pass** |
| Viewer image | `docker build` + `/healthz` | **Node-only image; compiler identity verified** |

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
  `reykjavik-registry`, `timaeus`, `ledger`, `estate`, `foundry`)
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
  (`candidate`/`promoted` through one gate), the seventeen-definition Pydantic-owned promoted
  catalog, the machine-visible `ActionSummary` gold benchmark (ADR-0022), and generated
  `Dialect.compounds[]` render-gating via
  the `restrictCompounds` view (`clinical` is restricted; eight dialects remain
  explicitly unrestricted); the R2 bounded-delegation
  surface (ADR-0004/0018: `Within`/`VaryId` in the grammar, the emission envelope +
  pure/total `applyDelta` in `delegation/`, `MorpheRoot.choices?` as the only
  renderer contract change — epochs never reach the renderer), including an
  explicit single-target `Within` contract with reactive density, parent-budgeted
  emphasis, native labelled collapse, and target-aware traversal, with the `py/`
  Pydantic mirror and committed schema re-synced to the now-complete grammar;
  the ADR-0024 deterministic operational host circuit (`liveVariationIndex`,
  `DeterministicObjectivePolicy`, and `runMidLoop`) with resolver-specific authority,
  duplicate-id bound intersection, explicit path-plus-kind digest projection,
  fail-closed delegate admission, and monotonic user-override locks. The host passes only
  the admitted choice map to `MorpheRoot`; no tier-2 producer or model delegate ships.
- **The neutral demo host (this repo's own routes, proof surfaces only):** `/` — the workbench
  index linking the playground, CMS preview, and published-pointer proof;
  `/substrate` — the full-featured neutral playground and live host proof surface: the
  ActionSummary gold circuit is the default exhibit, with all declared lanes, the nine-way dialect
  toggle, live `actions`, four bindable input families, Vary and targeted Within `choices`, recursive
  promoted expansion, plus a separate complete Compound Mint ledger, a resolver-bound deterministic
  policy/Delta/outcome circuit, and six sealed signed source-v1 producer fixtures, neutral assets,
  adaptive fallback rendering, and a pinned nested-dialect proof;
  `/preview/[artifactId]/[revisionId]` — the
  local CMS preview route (reads compiled trees from
  `compiled/capability-pages/**`, falling back to the built-in
  `capability-page.demo/rev-001` fixture; dialect overrides are revalidated, viewport is honored,
  and preview-only action/choice receipts stay host-owned); `/p/[slug]` — the publication
  pointer route (`publications.json` → compiled revision; `/p/demo` is immutable to the mid-loop,
  never a control host); `/dignity` — a compatibility
  redirect to `/substrate`; `/plate-proof` — the responsive `Media.sources`
  plate-derivative proof tree; `/api/adaptive/decision` — the adaptive
  sidecar bridge (calls `MORPHE_AGENT_BASE_URL` when configured, otherwise
  returns a deterministic schema-valid fallback tree); τ_frame arrival
  attribution (`?dialect=` selects the dialect on landing — valid param >
  persisted choice, explicit toggle always wins afterward).
- **The stripped viewer (`viewer/`):** a second, stripped SvelteKit app sharing the same `$lib`.
  The legacy `/surfaces/[artifactId]` compiled-tree route remains unchanged as the rollback path;
  the dual `/s/[source]/[surfaceId]` route admits bounded, Ed25519-authenticated source-v1
  envelopes and compiles them with the server-only TypeScript edge compiler. Both paths pass the
  same generated grammar/dialect policy ingress gate before rendering. `/healthz` exposes the
  grammar, source wire/media type, receipt contract, edge-compiler version, and self-derived build
  identity (`sha256:bf16315c1853607d04e5705aae0ab46d3dee931cf72cba19b811e0dc8d5d32b8`).
  The adapter is env-switched (`MORPHE_VIEWER_ADAPTER=node` → adapter-node for the distroless
  image, `viewer/Dockerfile`, built from repo root); the production image carries no Python
  compiler.
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

- **Reserved strata sockets** (`CONTRACT.md` §11): `Vary.objective` (an authored declaration;
  deterministic policies name their target objective explicitly) and `persona`. Learned objective
  selection, a model delegate, and a tier-2 producer remain future. Do not wire them ad hoc; do not
  remove them.
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
- Six-kernel corpus curation and operational ledgers are governed elsewhere. The six sealed public
  compatibility fixtures in the neutral host prove only the generic source/compiler/render seam;
  they do not make kernel semantics, a training corpus, or an operational ledger package doctrine.

---

## 4. Run instructions

```bash
bun install
bun run check      # svelte-kit sync && svelte-check → 0 errors, 0 warnings
bun run test       # vitest run (+ dom config)       → 906 server + 14 DOM passing
bun run build      # vite build                      → client + SSR bundles
bun run pack:verify # tarball install in throwaway Vite + Svelte consumer
bun run dev        # http://localhost:5173/          (the neutral playground)
```

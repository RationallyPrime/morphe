# Morphe — Phase 0 Core — Integration & Verification Status

**Date:** 2026-06-08
**Verifier pass:** integration + truth report (ran alone, no concurrency).
**Verdict: GREEN.** Deps installed, types clean, all tests pass, production
build succeeds, and the dev server serves both routes (`/` and `/dignity`) at
HTTP 200 with fully server-rendered content. **No integration fixes were
required** — the agents' work composed correctly against `CONTRACT.md` out of
the box. This file edits nothing in the source; it reports observed reality.

---

## 1. Verification results (commands actually run)

| Step | Command | Result |
|---|---|---|
| Deps | `pnpm install` (already present in `node_modules`; `pnpm 10.28.1`) | OK — no network needed |
| Sync | `pnpm exec svelte-kit sync` | OK |
| Types | `pnpm exec svelte-check --tsconfig ./tsconfig.json` | **0 errors, 0 warnings** (352 files) |
| Tests | `pnpm exec vitest run` | **56/56 passing** across 3 files |
| Build | `pnpm exec vite build` | **Success** (client + SSR bundles emitted) |
| Smoke | `pnpm exec vite dev` + `curl /` and `/dignity` | **HTTP 200**, 74 KB SSR HTML each, no runtime errors |

The build's only console notice is `@sveltejs/adapter-auto`: "Could not detect
a supported production environment." That is expected — no deploy target is
configured. It is **not** a build failure; the bundles are produced.

### Test breakdown (56 total)

- `src/lib/morphe/core.test.ts` — 13 tests (law + factory + dialect smoke).
- `src/lib/morphe/dialects/dialects.test.ts` — 23 tests (Lemma-4 fixed-point:
  authored-tree invariance, scale-neutrality, full intent coverage,
  clean boundary swap, prior clamping, **data⇄CSS agreement** between the
  `icelandic-archive` data dialect and the static `intents.css` block, and the
  dialect registry/`getDialect` lookup).
- `src/lib/morphe/lemmas.property.test.ts` — 20 tests (the §13 "lemmas-as-tests"
  plan, realized with a seeded in-repo PRNG fuzzer, 200 cases per property since
  `fast-check` is not a dependency):
  - Lemma 1 (CLOSURE): fuzzed compounds register, expand hygienically (no
    surviving `param-ref`/`slot`), land in renderable kinds; compounds reference
    compounds; **acyclicity** rejects self/indirect cycles; **depth bound**
    (`MAX_EXPANSION_DEPTH = 16`) rejects a 20-deep chain.
  - Lemma 2 (CONTEXT LAWS): monotone-depth, frame-only tier reset,
    budget-conservation (incl. B=0 floor + earlier-claimant priority),
    stability at the enumerated thresholds, locality (pure transform).
  - Lemma 4 (DIALECT TOTALITY): priors clamped (budget 1..6, tier 2..4) for
    every dialect incl. a deliberately out-of-bounds `rogue`; laws survive each
    dialect's clamped root; authored trees are byte-for-byte invariant under
    re-dialecting; default/clinical inject the **same** intent-var keyset with
    differing values; every override is intent-layer + neutral-scale (no hex).

---

## 2. What the demo shows (the dignity test — Corollary 1)

`/` and `/dignity` both mount the **same** `src/routes/_demo/DignityDemo.svelte`.
`pnpm dev` lands directly on the dignity test at `/`.

It renders **one hand-authored Node tree** (`src/routes/_demo/tree.ts`,
`dignityTree`) — an archive "Accession Sheet" — through the full core:
grammar → context algebra → three-layer tokens → default dialect → recursive
`<Node>` renderer. Confirmed present in the SSR HTML:

- **Masthead**: "The Accession Sheet" (display), caption + provenance line, a
  badge cluster.
- **Catalogue**: two `CatalogueEntry` **compounds** expanded through the factory
  gate (Möðruvallabók / AM 132 fol., Codex Regius / GKS 2365 4to), each with a
  hygienic `param-ref` folio/title/provenance and a call-site-filled `body`
  slot — proving Lemma 1 end-to-end in SSR.
- **Intake form**: Field × 2, Select, Range, Toggle — **every input a11y-wired**.
  Verified in the served HTML: `for`/`id` label association, `aria-required`,
  `aria-invalid`, `aria-describedby` (hint/error ids), `role="radiogroup"` on
  the dialect toggle.
- **Feedback band**: three `Status` (success/caution/info — each with a text +
  icon `StatusSignal`, color never the only signal), an `InlineAlert`
  (`aria-live="polite"`), a labelled `Progress`.
- **Colophon**.

**The dialect toggle is the on-screen Lemma-3 fixed point.** A segmented control
outside the rendered tree swaps the dialect handed to `MorpheRoot` between
**Icelandic Archive** (default) and **Reykjavík Registry** (a legal/registrar
re-reading of the same core intents — citation-blue forward, judicial-crimson
caution, denser priors — lifted from the legacy palette but mapped onto neutral
scales at the intent layer only). The `tree` prop is byte-identical across both
states; only the intent→scale map and clamped priors move. Both dialect swatches
and labels are present in the SSR output.

---

## 3. What the tests prove

The §13 claim — "the document's logical structure IS the verification plan" — is
realized. The four lemmas are discharged as properties over 200 fuzzed
schema-valid trees each, plus the deterministic smoke + dialect suites:

- **Render is total** (Definition 1): every fuzzed authored tree and every
  compound expansion resolves only to renderable kinds; the registration gate
  (expand-with-defaults → grammar typecheck → acyclicity → depth bound) keeps
  any failing compound out, so a rendered tree can never reference a
  non-existent or cyclic compound.
- **The algebra obeys its four laws** (locality, stability, monotone-depth,
  budget-conservation) and keeps obeying them under any dialect's *clamped* root
  context — including a rogue dialect with out-of-range priors.
- **Re-dialecting is a fixed point**: authored trees are invariant; the
  intent-var keyset is invariant across dialects; only the resolved scale values
  change; no dialect value is a literal hex or a welded vertical scale name.
- **Data ⇄ CSS agree**: the `icelandic-archive` *data* dialect equals the static
  `[data-mo-dialect="icelandic-archive"]` block in `tokens/intents.css`
  channel-for-channel, so the colour painted before JS equals the colour painted
  after a boundary override.

---

## 4. Contract conformance (spot-checked)

- `render/registry.ts` is an **exhaustive** `Record<PrimitiveKind, Component>`
  (all 17 primitive kinds mapped; meta kinds correctly excluded and handled in
  `Node.svelte`). A missing entry would be a compile error.
- `render/Node.svelte` is the small total switch the contract describes:
  expands `compound`, renders `vary` default, renders bare `slot` fallback,
  defensively renders a stray `param-ref`, dispatches primitives via the
  registry. Layout primitives own their own descent.
- `MorpheRoot.svelte` is the τ_frame injection point: `applyDialect` →
  `data-mo-dialect` attr + spread intent vars + seeded root context → `<Node>`.
- Primitives are **genuinely enriched, not hollow stubs**. Spot-checked
  `Field.svelte`: full label-relation handling (visible / aria-label /
  labelledby), three-channel error signal (caution colour + alert text + thicker
  rule), the `--mo-field-*` CSS-var carrier (discrete decisions declarative,
  continuous/stateful values via the cascade — no runtime className synthesis),
  tier-0 local `$state`, and zero raw scale/hex references. The full primitive
  set (layout/content/input/feedback) is modified vs. the scaffold and renders
  in the dignity tree.
- House style honoured: tabs, double quotes, semicolons; Svelte 5 runes
  throughout; TS strict with `noUncheckedIndexedAccess` + `verbatimModuleSyntax`.

---

## 5. Stubbed / incomplete / Phase-1 boundaries (honest gaps)

None of these block Phase 0; they are the contract's named edges, not breakage.

- **`Vary` is render-default only.** `Node.svelte` renders `Vary`'s default
  option (clamped). There is no mid-loop / objective optimizer yet — the
  contract scopes that to a later phase. `objective` is carried in the grammar
  but unused at render time.
- **Stateful binds are tier-0 only (Lemma 5, Phase 0 form).** Inputs hold their
  own value in local `$state` and expose `bind` as a `data-bind` store-path for a
  host to adopt; there is no two-way wire to an external store in Phase 0. This
  is by design, documented in the primitive headers.
- **`dialect.compounds[]` is not enforced at render.** The type carries the
  per-dialect compound allow-list (e.g. `reykjavik-registry` lists
  `CatalogueEntry`), but the registry does not yet gate expansion by active
  dialect — the contract says "Phase 1 wires the registry." Today the singleton
  `registry` is global.
- **Two "second dialects" coexist, both legitimate, neither orphaned:**
  - `dialects/clinical.ts` — wired into `dialects/registry.ts` (`getDialect`,
    `DIALECTS`) and exercised by `dialects.test.ts` + `lemmas.property.test.ts`.
    It is the registry/test-suite contrast dialect.
  - `reykjavikRegistry` (inline in `routes/_demo/tree.ts`) — the demo's
    on-screen toggle dialect.
  Neither `clinical` nor `reykjavikRegistry` is exported from the public barrel
  `src/lib/morphe/index.ts` (only `icelandicArchive` / `DEFAULT_DIALECT` are).
  `dialects/registry.ts` (`getDialect`, `DIALECTS`, `hasDialect`) is **also not
  re-exported** from the public barrel — it is imported directly by its tests.
  Not a defect (all imports resolve, all tests pass), but if a consumer should
  reach `getDialect`/`clinical` through `$morphe`, add those re-exports. Left
  as-is to avoid touching the locked barrel without a contract owner's call.
- **Fonts / icons are a CDN dependency** (`DignityDemo.svelte` head): Newsreader
  / Hanken Grotesk / IBM Plex Mono + Material Symbols Outlined, exactly as the
  Archive spec permits. The core references only `--mo-font-*` host vars.
- `@sveltejs/adapter-auto` has no detected deploy target — expected for a local
  Phase-0 core; pick a concrete adapter when a deploy environment is chosen.

---

## 6. File tree (top 3 levels)

```
src/lib/morphe/
  index.ts                       # public library barrel
  env.d.ts
  core.test.ts                   # law + factory + dialect smoke (13)
  lemmas.property.test.ts        # §13 lemmas-as-property-tests (20)
  grammar/
    types.ts                     # the Node discriminated union (LOCKED)
  tokens/
    scales.css                   # neutral raw ramps
    intents.ts                   # intentVar / CORE_INTENTS / SURFACE_VARS
    intents.css                  # default-dialect intent block (static fallback)
    slots.ts                     # slot() / SLOTS / toneIntent
  context/
    algebra.ts                   # pure: transform / enterFrame / renormalizeBudget …
    Context.svelte.ts            # descend / boundaryStyle / provide+useMorpheContext
  compounds/
    factory.ts                   # CompoundRegistry, expand, gate, childrenOf
  dialects/
    types.ts                     # Dialect / IntentDefinition / AlgebraPriors
    icelandic-archive.ts         # DEFAULT dialect + ARCHIVE_SURFACES
    clinical.ts                  # contrast dialect (registry + tests)
    provider.svelte.ts           # applyDialect / dialectStyle (clamps priors)
    registry.ts                  # getDialect / DIALECTS / hasDialect
    dialects.test.ts             # Lemma-4 fixed-point suite (23)
  render/
    registry.ts                  # NodeKind -> component (EXHAUSTIVE, LOCKED)
    props.ts                     # PrimitiveProps<N> (LOCKED)
    Node.svelte                  # recursive total renderer (LOCKED)
    MorpheRoot.svelte            # dialect-providing entry / τ_frame (LOCKED)
    index.ts                     # render barrel
  primitives/
    layout/   Stack Grid Cluster Frame Spacer       # primitive agents' files
    content/  Text Number Badge Icon Media
    input/    Field Select Toggle Range
    feedback/ Progress Status InlineAlert

src/routes/
  +layout.svelte                 # imports app.css, renders children
  +page.svelte                   # mounts DignityDemo (dev lands here)
  dignity/+page.svelte           # explicit dignity-test route (same DignityDemo)
  _demo/
    DignityDemo.svelte           # the dignity test: one tree, dialect toggle
    tree.ts                      # authored tree + CatalogueEntry compound + 2nd dialect
```

Meta primitives (`Slot`, `ParamRef`, `Vary`) intentionally have no `.svelte`
files — they are structural and handled by `Node.svelte` + `factory.ts`.

---

## 7. Run instructions

```bash
cd /home/rationallyprime/projects/morphe

pnpm install            # deps (already present; no network was needed here)

pnpm check              # svelte-kit sync && svelte-check  → 0 errors, 0 warnings
pnpm test               # vitest run                       → 56/56 passing
pnpm build              # vite build                       → client + SSR bundles

pnpm dev                # dev server; open http://localhost:5173/
                        #   /         → the dignity test (lands here)
                        #   /dignity  → the same dignity test, explicit route
```

**The dignity test route is `/` (and `/dignity`).** Toggle "Icelandic Archive"
↔ "Reykjavík Registry" in the header: the page re-themes with the authored tree
unchanged — the visible Lemma-3 fixed point.

No remote was created and nothing was pushed. Local only, as instructed.

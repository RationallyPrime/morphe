# Onboarding Dossier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As a visitor fills the onboarding intake, a Morphe tree beside the wizard builds their typed dossier live; on submit the dossier morphs to a sealed, accession-numbered record — and the systems section is reshaped by the first real `MidLoopDelegate`, closing the slow-loop → digest → mid-loop → delta circle for the first time anywhere.

**Architecture:** The wizard stays a native control surface (the established idiom); the dossier is a pure presenter (`DossierDraft → Node`) re-emitted per draft change as a fresh `EmissionEnvelope`. Two `Vary` points carry all morphing: the stage Vary (open ↔ sealed, driven by submit success through `applyDelta`) and the systems Vary (ledger ↔ compact, driven by a `MidLoopDelegate` reading the `ContextDigest` of a `MorpheStore` the wizard mirrors into). The server mints a receipt id; the sealed record pins the `night` dialect (the vitrine idiom — "filed into the archive"). `Within` is NOT used: `Node.svelte:84-85` resolves but renders nothing for it, so the visible density morph rides a Vary.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript strict, Vitest, bun, Biome. No new dependencies.

**Why this loop matters beyond /onboarding:** the digest → delegate → delta render path prototyped here is the render architecture for the multi-customer control plane and dashboards.

---

## Verified current truth (scout-verified 2026-06-11)

* `src/lib/morphe/grammar/types.ts:557-576` — `Vary` (bounded options, default) and `Within` (typed socket) exist; `Within` has no children.
* `src/lib/morphe/render/Node.svelte:84-85` — the `within` branch renders **nothing** (`{#if withinChoice}{/if}` is empty). Density morphs must use `Vary`.
* `src/lib/morphe/delegation/applyDelta.ts:25` — epoch/id/bounds-validated, tree never mutated; `liveVaryIds` walks compound slot fills too.
* `src/lib/morphe/delegation/midLoop.ts:5-7` — `MidLoopDelegate.propose(digest, liveVaryIds): readonly Delta[]`; only a dev static example implements it.
* `src/lib/morphe/state/store.svelte.ts:193-202` — `commitTier1(store, path, kind, value)` is the one write path; records a `Tier1Event` in a 32-event window. `Tier1Kind = "selection" | "filter-edit" | "expand" | "collapse" | "sort"` (`events.ts:42`).
* `src/lib/morphe/state/digest.ts:21` — `digestOf(store)` = JSON-cloned state + recent events.
* `src/lib/morphe/render/MorpheRoot.svelte:38-61` — props: `tree, dialect?, store?, actions?, choices?, onEscalate?`. Explicit `dialect` pins a subtree.
* `src/lib/site/intent-engine.svelte.ts:107-137` — the stage-delta precedent: stamp live epoch, applyDelta, advance envelope on "applied" only.
* `src/lib/site/Onboarding.svelte` — native 4-step wizard; draft state `contact/systems/priorities/outcomes`, localStorage persistence, posts to `/api/onboarding`, `status: "done"` ack.
* `src/routes/api/onboarding/+server.ts:105-115` — founder alert; returns `{ ok: true }` with no receipt.
* `src/lib/compose/taxonomy.ts:392-400` — `SYSTEMS`: 7 grounded systems (humanity, dkplus, businesscentral, twenty, 50skills, asana, jira) with labels + categories; exported via `$lib/compose`.
* `src/lib/morphe/dialects/gallery.ts:200-208` — the `seal` register exists in every dialect (CONTRACT §8 keyset) and is **unused** by any site surface (grep: zero authored `intent: "seal"`).
* `src/lib/site/site.test.ts` — S1/S2 presenter test pattern; `src/lib/site/intents.test.ts` — engine test pattern.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/site/dossier.ts` | Create | Pure presenter: `DossierDraft → Node` (stage Vary + systems Vary), grounding matcher over `SYSTEMS`, envelope factory. No clock, no RNG, no I/O. |
| `src/lib/site/dossier-midloop.ts` | Create | `createDossierMidLoop(currentEpoch)` — the first real `MidLoopDelegate`: digest → compact/ledger proposal. |
| `src/lib/site/dossier.test.ts` | Create | Presenter purity, stage/systems Vary structure + applyDelta round-trips, grounding, intent-keyset validity across all dialects, mid-loop full circle. |
| `src/lib/server/receipt.ts` | Create | `mintReceiptId(now?, random?)` — deterministic-testable accession id. |
| `src/lib/server/receipt.test.ts` | Create | Format, determinism with injected clock/rng, no-confusables alphabet. |
| `src/routes/api/onboarding/+server.ts` | Modify | Mint receipt, include in alert body + JSON response. |
| `src/lib/site/Onboarding.svelte` | Modify | Two-column layout (wizard + dossier aside), envelope re-emission, store mirror, mid-loop wiring, seal-on-submit, night-pin when sealed. |
| `src/lib/site/index.ts` | Modify | Export the dossier presenter surface. |

---

### Task 1: `dossier.ts` — the pure presenter + grounding matcher

**Files:** Create `src/lib/site/dossier.ts`, `src/lib/site/dossier.test.ts`.

- [ ] **Step 1: failing tests** — `dossier.test.ts` with suites D1–D6 (see code in repo task; key assertions):
  - D1 purity: two calls with the same draft are `toEqual`; input not mutated.
  - D2 stage: root is `vary` with `id === DOSSIER_STAGE_ID`, 2 options, `default === 0`; sealed option contains `{ kind: "badge", intent: "seal", label: <receipt> }` and a success `status`.
  - D3 systems Vary: present only when ≥1 named system; `applyDelta` accepts `{choice: 1}` and rejects `{choice: 5}` ("out-of-range") and a stale epoch ("stale-epoch").
  - D4 grounding: `groundedSystem` resolves "dkPlus", "dk", "DK+", "Jira Software", "business central"; returns null for "Excel".
  - D5 empty draft: no contact/systems/priorities/outcomes sections; the invite marginalia is present.
  - D6 dialect validity: for every dialect in `DIALECTS`, `unknownIntentsIn(tree, dialect.intents)` is empty (both branches, with and without receipt).
- [ ] **Step 2:** `bun run test -- dossier` → FAIL (module not found).
- [ ] **Step 3:** implement `dossier.ts`: types (`DossierContact/System/Draft`, `DossierOpts`), ids (`DOSSIER_STAGE_ID`, `DOSSIER_SYSTEMS_ID`), choice maps, `groundedSystem` (normalized whole-token match over `SYSTEMS` labels + alias table), section builders sharing one `recordSections(draft, opts)` spine, `dossierTree`, `dossierEnvelope`. Raw grammar primitives only — no compound refs.
- [ ] **Step 4:** `bun run test -- dossier` → PASS; `bun run check` → clean.
- [ ] **Step 5:** commit `feat(site): onboarding dossier presenter — the intake as a typed Morphe record`.

### Task 2: `receipt.ts` — accession id minting + API wiring

**Files:** Create `src/lib/server/receipt.ts`, `src/lib/server/receipt.test.ts`; modify `src/routes/api/onboarding/+server.ts`.

- [ ] **Step 1: failing tests** — format `^K-\d{8}-[A-HJ-KM-NP-TV-Z2-9]{4}$`, determinism with injected `now`/`random`, distinct suffixes for distinct random streams.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement (alphabet without 0/O/1/I/L/U). **Step 4:** PASS.
- [ ] **Step 5:** API: mint after validation, prepend `Receipt: ${receipt}` to alert lines, return `json({ ok: true, receipt })`.
- [ ] **Step 6:** commit `feat(api): onboarding intakes mint an accession receipt`.

### Task 3: `dossier-midloop.ts` — the first real MidLoopDelegate

**Files:** Create `src/lib/site/dossier-midloop.ts`; extend `src/lib/site/dossier.test.ts` (suite D7).

- [ ] **Step 1: failing tests (D7, full circle):** build a store, `commitTier1` a named-systems count, build the envelope, run `propose(digestOf(store), liveVaryIds(envelope.tree))`, apply through `applyDelta`, assert `resolveVaryOption` returns the compact branch at count ≥ 3 and the ledger branch below; assert a stale-epoch delegate's proposal is rejected and the envelope unchanged.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement `createDossierMidLoop(currentEpoch: () => number)` reading `digest.state["onboarding.systems.named"]`, threshold `DOSSIER_COMPACT_THRESHOLD = 3`, proposing only when the id is live.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(site): first real mid-loop delegate — the dossier compacts as the system list grows`.

### Task 4: `Onboarding.svelte` integration — the live record beside the wizard

**Files:** Modify `src/lib/site/Onboarding.svelte`, `src/lib/site/index.ts`.

- [ ] **Step 1:** layout: wrap the wizard in `.onb-layout` grid (1 col narrow; `minmax(0,1.15fr) minmax(0,0.85fr)` ≥ 64rem); add `<aside class="onb-record" aria-label="Your intake record">` with `MorpheRoot tree={envelope.tree} {choices} {store} dialect={sealed ? nightDialect : undefined}`, sticky on wide.
- [ ] **Step 2:** state wiring:
  - `const store = createInMemoryMorpheStore()`.
  - envelope: `$derived.by` over the draft snapshot + `activeStepId` + `receipt`/`sealedAt`, epoch from a monotonically bumped plain counter.
  - choices: `$derived.by` — seal delta first (when `receipt`), then mid-loop proposals, each through `applyDelta`; return final `choices`.
  - mirror `$effect`: commit `onboarding.systems.named` (kind `"filter-edit"`) and `onboarding.step` (kind `"selection"`) via `commitTier1`, guarded against same-value re-commits.
  - submit success: `receipt = data.receipt ?? "RECEIVED"`, `sealedAt = <formatted date>`; ack copy gains the receipt line; polite live region announces "Record sealed — intake ${receipt} received."
- [ ] **Step 3:** export presenter surface from `src/lib/site/index.ts`.
- [ ] **Step 4:** `bun run check && bun run test && bun run build` → green. Manual pass via dev server: type → record builds; 3 systems → compacts; submit (dev, no env → 503 path) → mailto fallback intact; with env or mocked → seal + night pin.
- [ ] **Step 5:** commit `feat(site): the onboarding record builds itself beside the wizard and seals on submit`.

### Task 5: verification + docs

- [ ] `bun run check`, `bun run test`, `bun run build` all green (evidence in PR/commit message).
- [ ] Reduced motion: no new transitions beyond the existing token discipline; Vary swaps are instant renders.
- [ ] A11y: dossier aside labelled, not `aria-live` (per-keystroke chatter forbidden); only the seal announces politely.
- [ ] STATUS.md note: the delegation loop is now exercised end-to-end on /onboarding.

## Self-review notes

- Spec coverage: live dossier (T1+T4), seal + receipt (T2+T4), store mirror + mid-loop (T3+T4), vendor grounding (T1 matcher + section line). Night-pin (T4). ✓
- `Within` deliberately avoided (renders nothing — verified). The systems density morph is a Vary. ✓
- No grammar/substrate edits anywhere — site layer + server only. ✓
- The wizard remains the native control surface; the dossier is render-only (no inputs inside the Morphe tree). ✓

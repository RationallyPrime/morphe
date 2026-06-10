# Reconstruction Plan — aligning the code with the vision

> Status: adopted 2026-06-09. Owner: contract owner (Hákon).
> The vision is `VISION.md` (v0.6); the shipped state is `VISION.md` §15 +
> `STATUS.md`. This plan closes the gaps between them, in an order that keeps
> the site shipping green at every step. Sibling plan: `MIGRATION.md` (the
> monorepo landing — R3 here feeds it).

## Principles

1. **The site never breaks.** Every workstream lands check-clean, tests-green,
   build-passing, browser-verified. Corollary 1 (monotone degradation) is the
   safety argument: every phase below is additive structure the lower strata
   don't depend on.
2. **Grammar changes are contract changes.** Anything touching
   `grammar/types.ts` is owner-gated, lands with its CONTRACT.md §3 update, and
   preserves the grammar fixed point (new fields optional + defaulted; every
   pre-existing authored tree stays valid and renders identically).
3. **The lemmas are the test plan.** No workstream is done without its property
   test. Cross-lemma obligations (commutation) count.
4. **Reserved seams get wired through their named mechanism or not at all** —
   no ad-hoc completion of `Vary`/`action`/`bind` (CONTRACT §11).

Sizes: S (hours), M (a day), L (days).

---

## R0 — Substrate integrity (close CONTRACT §12; do these first)

Independent of each other; each is a small, complete, separately-landable PR.
No behavior change for any currently-valid tree.

- **R0.1 (M) Budget law × expansion commutation** — *the one hole in the
  headline theorem* (VISION open problem 8). Grammar: optional
  `emphasis?: EmphasisClaim` on `CompoundRef` (hygienic — the call site claims
  on behalf of the expansion; mirrors how slots/args already flow).
  `explicitClaim` reads it; for `Vary`, peek the default option's claim
  (documented; revisit when deltas land in R2). Property test:
  *renormalization is invariant under wrapping any child in a single-node
  compound* — wrap/unwrap fuzzing in `lemmas.property.test.ts`.
  Files: `grammar/types.ts` (owner), `context/algebra.ts`, CONTRACT §3/§12.
- **R0.2 (S) Render totality at unknown compounds.** `Node.svelte`: guard the
  `registry.expand()` call — unknown name renders nothing + a dev-mode
  `console.warn` (never throws). Test: a tree with a bogus `CompoundRef`
  renders its siblings. Files: `render/Node.svelte` (owner), test.
- **R0.3 (S) Child keying.** Replace object-identity keys `(c)` with index keys
  in every container primitive (trees are immutable per `<Node>` instance —
  identity keying buys nothing and forbids structural sharing). Test: a tree
  with the same node instance as two siblings renders. Files: layout/overlay
  primitives, CONTRACT §12 note removal.
- **R0.4 (S) Intent-ref validation.** Dev-mode tree walk in `MorpheRoot`
  warning on any `intent` not in the active dialect's intent set; dialect test
  asserting every channel value matches
  `^(var\(--mo-|color-mix\(|transparent)` (no hex can ever land in a dialect).
  Files: `render/MorpheRoot.svelte` (owner), `dialects.test.ts`.
- **R0.5 (S) Cleanups.** The no-op `.mo-stack[data-emphasis]` gap rule (make
  emphasis-spacing real or delete the placeholder); decide the public-barrel
  question (export `clinical`/`reykjavik-registry`/`dialects/registry` from
  `index.ts` — owner call recorded in CONTRACT).

**Exit:** CONTRACT §12 is empty (folded into history), VISION §15 row
"Law-4 × expansion commutation" flips to ✔.

---

## R1 — Purity & the live wire (Lemma 5 — Phase 1)

The order matters: store before events, events before digest.

- **R1.1 (L) Client store + bindings.** A single typed store keyed by
  `store_path`; input/overlay primitives with `bind` read initial state from
  and commit tier-1 changes to it (tier-0 stays component-local `$state`).
  DI at `MorpheRoot` (a store prop, defaulting to an in-memory one) — no
  global singleton. Architecture test: no component reads the store outside
  its declared bindings.
- **R1.2 (M) Event tiers.** The typed event taxonomy: tier-1 events flow into
  the store's recent-event window; a tier-2 event type (`submit`, task
  transition, "this view isn't working") that surfaces as a typed callback at
  the `MorpheRoot` boundary. The site's composer/contact forms stay native —
  this wires the *Morphe-tree* side only.
- **R1.3 (M) ContextDigest + replay harness.** The digest type (tier-1
  snapshot + recent-event window); a recorder; snapshot tests replaying
  recorded digests against presenter emissions. This is Corollary 2's
  log-format landing early.
- **R1.4 (M) Action binding.** An `actions: Record<string, handler>` map
  passed to `MorpheRoot`; a Morphe `Button` with an `action` id fires the
  mapped handler (tier-2 typed event if unmapped → dev warning). The
  native-control-surface idiom survives: page chrome keeps native controls;
  this gives *in-tree* buttons their declared wire.
- **R1.5 (M) Compound lifecycle + dialect gating.** `candidate`/`promoted`
  states in `CompoundRegistry`; `dialect.compounds[]` becomes render-real: a
  dialect restricts expansion to its subset (G|D's compound half, Lemma 4).
  Parity test: every shipped dialect's compound list resolves.

**Exit:** VISION §15 rows for `bind`, tiers, digest, lifecycle, compound-gating
flip to ✔; Lemma 5's proof obligation (replay determinism) is a passing test.

---

## R2 — Bounded delegation (Lemma 6 — Phase 2 seams, model-free)

Everything here is pure TS — no model required; A4 masking comes with R3.

- **R2.1 (M) Grammar: `Within`, epochs, VaryId.** Add `Within` (continuous
  delta: `density`/`emphasis`/`collapse` over a bounded range); brand `VaryId`;
  an `epoch` on the emission envelope (a wrapper type around a root `Node`, not
  a Node field — trees stay pure). Owner-gated; CONTRACT §3 update; fixed-point
  preserved (all optional).
- **R2.2 (M) Delta semantics.** `applyDelta(envelope, delta): envelope` — pure,
  total: rejects stale epochs and dead VaryIds at the type level where
  possible, at validation otherwise. Adversarial fuzz: arbitrary deltas against
  arbitrary envelopes never produce an invalid tree (Lemma 6's proof
  obligation).
- **R2.3 (S) Renderer: live choice.** `Node.svelte` renders `Vary` from the
  envelope's current choice map instead of bare `default` (falling back to
  `default` — Corollary 1). The mid-loop *interface* (something that proposes
  deltas) is a DI seam; its first implementation can be a trivial heuristic to
  prove the loop.

**Exit:** Lemma 6 discharged as property tests; the mid loop is a plug-in
surface waiting for a model, exactly as A4 intends ("well-formedness from day
one; tuning improves only quality").

---

## R3 — The Eidos lift (one schema, three jobs — `MIGRATION.md`)

> **Re-sequenced 2026-06-10 (founder + review):** the monorepo landing moves
> FORWARD — after R2, before the codegen/mask jobs. Rationale: R2.1 is the
> last planned grammar mutation, so migrating after R2 means the grammar
> arrives complete and the mirror is lifted once; and R3.2/R3.3 are exactly
> the steps that want Eidos adjacency (the Pydantic provenance, capability
> cards, the monorepo's robust CI) — building their pipeline in the sandbox
> and then moving it is double work. Morphe also becomes the control-plane
> UI substrate there, so the landing is a when, not an if. The sandbox repo
> carries a thin interim CI (`.github/workflows/ci.yml`) for the remaining
> window.

- **R3.1 (L, ✔ shipped in-sandbox) Projection M source.** Pydantic v2 models
  mirroring `grammar/types.ts` exactly (the file was kept logic-free for
  precisely this); JSON Schema emission with the discriminator layout TS
  codegen needs. Lives under `py/` until the landing; must be re-synced when
  R2.1 extends the grammar.
- **R3.2 (L, was R3.4) Monorepo landing.** Per `MIGRATION.md`: `src/lib/morphe/`
  and `py/morphe_grammar` move next to Hyle/Eidos; TS/bun jobs grafted onto
  the monorepo CI. Layer guards enforce downward-only deps on arrival.
  **Owner decision needed first (grill-sized):** does the Sókrates site move
  too, or stay behind consuming Morphe as a published package (bun workspaces
  don't span repos)?
- **R3.3 (M, was R3.2) Codegen + parity gate** — in the monorepo. Generate TS
  types from the schema; CI gate: generated output is *type-compatible* with
  the current hand-written `types.ts` (compile both against the whole
  codebase) before the swap; then `types.ts` becomes generated, and the
  hand-written file retires.
- **R3.4 (M, was R3.3) The third job** — in the monorepo. The
  constrained-decoding mask artifact (full grammar + per-dialect G|D
  restrictions); a pydantic-ai structured-output demo emitting a valid tree
  end-to-end — the slow loop's first real breath.

**Exit:** "One schema, three jobs" is real; A1 stops being hypothetical.

---

## R4 — τ_frame on the site (independent; revenue-relevant; can run anytime)

- **R4.1 (M) Attribution → dialect.** Read `?cohort=` / ValueTrack-style
  params (campaign/adgroup, geo, device — deterministic, consent-clean) in
  `+layout.svelte` and set `activeDialect` on arrival; precedence over the
  persisted choice, never over an explicit toggle. The dialect mechanism needs
  zero changes — this is pure wiring at the τ_frame seam.
- **R4.2 (blocked) Per-cohort copy.** Branch `$lib/site/present.ts` copy per
  cohort. **Waits on founder input**: which cohorts, which pitches, and the
  Icelandic copy is the user's. Do not invent pitches.

---

## Dependency graph & suggested order

```
R0.1 R0.2 R0.3 R0.4 R0.5      (parallel, land first)
  └──────────┬─────────┘
        R1.1 → R1.2 → R1.3
          └→ R1.4      └→ (R1.5 after R1.1)
                R2.1 → R2.2 → R2.3
                          └→ R3.1 → R3.2 → R3.3 → R3.4
R4.1 (anytime)   R4.2 (blocked on founder)
```

Tracking: Linear (`Krates-ehf` / Morphe, `KRA-###`) — one issue per workstream,
labeled per `docs/agents/triage-labels.md` (R0.x and R4.1 are
`ready-for-agent`; R1+/R3 are owner-gated grammar/architecture work —
`ready-for-human` or paired). Issue creation is a separate, blessed step — this
document is the plan of record.

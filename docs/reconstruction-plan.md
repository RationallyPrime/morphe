# Reconstruction Plan — aligning the code with the vision

> Status: adopted 2026-06-09. Owner: contract owner (Hákon).
> The vision is `VISION.md` (v0.7); the shipped state is `VISION.md` §15 +
> `STATUS.md`. This plan closes the gaps between them, in an order that keeps
> the package and both hosts shipping green at every step.

> **Status update:** R0 and R1 exit criteria are met. R2's discrete `Vary`
> path and epoch validation have shipped, but the phase remains partial because
> `Within` has no render-owning target and there is no production mid loop.
> Consistent with `CONTRACT.md` §12: no known R0
> substrate-integrity gaps remain. The Pydantic source, generated TypeScript,
> schema parity gate, public package, and stripped viewer have shipped. The old
> monorepo landing is retired: Morphe remains an independent package while
> serving as Projection M of Eidos. True dialect-restricted decoding has shipped;
> the adaptive circuit remains partial at `Within` and the operational mid loop.
> R4.2 is superseded — see its entry.

## Principles

1. **The package and hosts never break.** Every workstream lands check-clean, tests-green,
   build-passing, browser-verified. Corollary 1 (monotone degradation) is the
   safety argument: every phase below is additive structure the lower strata
   don't depend on.
2. **Grammar changes are contract changes.** Anything touching
   `py/morphe_grammar/models.py` is owner-gated, regenerates every TypeScript/JSON
   Schema artifact, lands with its CONTRACT.md §3 update, and
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

- **R0.1 (M, ✔ shipped) Budget law × expansion commutation** — *the one hole in the
  headline theorem* (VISION open problem 8). Grammar: optional
  `emphasis?: EmphasisClaim` on `CompoundRef` (hygienic — the call site claims
  on behalf of the expansion; mirrors how slots/args already flow).
  `explicitClaim` reads it; for `Vary`, peek the default option's claim
  (documented; revisit when deltas land in R2). Property test:
  *renormalization is invariant under wrapping any child in a single-node
  compound* — wrap/unwrap fuzzing in `lemmas.property.test.ts`.
  Files: `grammar/types.ts` (owner), `context/algebra.ts`, CONTRACT §3/§12.
- **R0.2 (S, ✔ shipped) Render totality at unknown compounds.** `Node.svelte`: guard the
  `registry.expand()` call — unknown name renders nothing + a dev-mode
  `console.warn` (never throws). Test: a tree with a bogus `CompoundRef`
  renders its siblings. Files: `render/Node.svelte` (owner), test.
- **R0.3 (S, ✔ shipped) Child keying.** Replace object-identity keys `(c)` with index keys
  in every container primitive (trees are immutable per `<Node>` instance —
  identity keying buys nothing and forbids structural sharing). Test: a tree
  with the same node instance as two siblings renders. Files: layout/overlay
  primitives, CONTRACT §12 note removal.
- **R0.4 (S, ✔ shipped) Intent-ref validation.** Dev-mode tree walk in `MorpheRoot`
  warning on any `intent` not in the active dialect's intent set; dialect test
  asserting every channel value matches
  `^(var\(--mo-|color-mix\(|transparent)` (no hex can ever land in a dialect).
  Files: `render/MorpheRoot.svelte` (owner), `dialects.test.ts`.
- **R0.5 (S, ✔ shipped) Cleanups.** The no-op `.mo-stack[data-emphasis]` gap rule (make
  emphasis-spacing real or delete the placeholder); decide the public-barrel
  question (export `clinical`/`reykjavik-registry`/`dialects/registry` from
  `index.ts` — owner call recorded in CONTRACT).

**Exit:** CONTRACT §12 is empty (folded into history), VISION §15 row
"Law-4 × expansion commutation" flips to ✔.

---

## R1 — Purity & the live wire (Lemma 5 — Phase 1)

The order matters: store before events, events before digest.

- **R1.1 (L, ✔ shipped) Client store + bindings.** A single typed store keyed by
  `store_path`; input/overlay primitives with `bind` read initial state from
  and commit tier-1 changes to it (tier-0 stays component-local `$state`).
  DI at `MorpheRoot` (a store prop, defaulting to an in-memory one) — no
  global singleton. Architecture test: no component reads the store outside
  its declared bindings.
- **R1.2 (M, ✔ shipped) Event tiers.** The typed event taxonomy: tier-1 events flow into
  the store's recent-event window; a tier-2 event type (`submit`, task
  transition, "this view isn't working") that surfaces as a typed callback at
  the `MorpheRoot` boundary. Consumer-owned forms and host controls stay native —
  this wires the *Morphe-tree* side only.
- **R1.3 (M, ✔ shipped) ContextDigest + replay harness.** The digest type (tier-1
  snapshot + recent-event window); a recorder; snapshot tests replaying
  recorded digests against presenter emissions. This is Corollary 2's
  log-format landing early.
- **R1.4 (M, ✔ shipped) Action binding.** An `actions: Record<string, handler>` map
  passed to `MorpheRoot`; a Morphe `Button` with an `action` id fires the
  mapped handler (tier-2 typed event if unmapped → dev warning). The
  native-control-surface idiom survives: page chrome keeps native controls;
  this gives *in-tree* buttons their declared wire.
- **R1.5 (M, ✔ shipped) Compound lifecycle + dialect gating.** `candidate`/`promoted`
  states in `CompoundRegistry`; `dialect.compounds[]` becomes render-real: a
  dialect restricts expansion to its subset (G|D's compound half, Lemma 4).
  Parity test: every shipped dialect's compound list resolves.

**Exit:** VISION §15 rows for `bind`, tiers, digest, lifecycle, compound-gating
flip to ✔; Lemma 5's proof obligation (replay determinism) is a passing test.

---

## R2 — Bounded delegation (Lemma 6 — Phase 2 seams, model-free)

Everything here is pure TS — no model required; A4 masking comes with R3.

- **R2.1 (M, ✔ shipped) Grammar: `Within`, epochs, VaryId.** Add `Within` (continuous
  delta: `density`/`emphasis`/`collapse` over a bounded range); brand `VaryId`;
  an `epoch` on the emission envelope (a wrapper type around a root `Node`, not
  a Node field — trees stay pure). Owner-gated; CONTRACT §3 update; fixed-point
  preserved (all optional).
- **R2.2 (M, ✔ shipped) Delta semantics.** `applyDelta(envelope, delta): envelope` — pure,
  total: rejects stale epochs and dead VaryIds at the type level where
  possible, at validation otherwise. Adversarial fuzz: arbitrary deltas against
  arbitrary envelopes never produce an invalid tree (Lemma 6's proof
  obligation).
- **R2.3 (S, partial) Renderer: live choice.** `Node.svelte` renders `Vary` from the
  envelope's current choice map instead of bare `default` (falling back to
  `default` — Corollary 1). The mid-loop *interface* (something that proposes
  deltas) is a DI seam; its first implementation can be a trivial heuristic to
  prove the loop. The discrete path is shipped; continuous `Within` values still
  have no render-owning target.

**Exit:** Not yet met. The discrete choice law is covered by property tests. The
phase closes only when `Within` has explicit target semantics and a deterministic
mid-loop adapter proves the complete bounded-delegation path.

---

## R3 — Independent Projection M (one schema, three jobs)

> **Topology settled 2026-07-13:** Morphe is an independent, versioned package
> and Projection M of Eidos. These statements answer different questions.
> Package consumers depend on Morphe's published seams; Morphe does not move
> into another repository or import consumer internals. The generated
> schema is the integration boundary.

- **R3.1 (L, ✔ shipped) Projection M source.** Pydantic v2 models in
  `py/morphe_grammar/models.py` are authoritative and emit the discriminated
  JSON Schema used by downstream compilers and validators.
- **R3.2 (S, ✔ settled) Independent distribution boundary.** Public npm,
  deliberately exported JSON Schemas, a separately versioned Python distribution,
  and a stripped deployment viewer are the stable topology. Consumer repos pin
  compatible releases; no source-tree or monorepo coupling is permitted.
- **R3.3 (M, ✔ shipped) Codegen + parity gate.** `src/lib/grammar/types.ts` is
  generated from Pydantic and `just schema-check` rejects drift.
- **R3.4 (M, ✔ shipped) The third job.** The Python-owned catalog generates one
  integrity-stamped `G|D` mask per dialect into both distributions; `clinical`
  restricts emission to `SignalCard`, and the Pydantic-AI lab injects the exact
  installed per-request mask with validator retry and fail-closed tests.

**Exit criterion:** "One schema, three jobs" becomes real and A1 stops being hypothetical.

---

## R4 — τ_frame at consumer boundaries

- **R4.1 (M, ✔ shipped) Arrival → dialect.** `src/lib/dialects/arrival.ts`
  resolves a valid explicit `?dialect=` value with persistence/default
  precedence. Attribution, directory role, and account-persona mapping belong
  in consumer hosts; they may select a dialect through the same boundary.
- **R4.2 (retired) Consumer-specific copy.** Morphe owns structure and intent,
  not application copy.

---

## Dependency graph & suggested order

```
R0.1 R0.2 R0.3 R0.4 R0.5      (parallel, land first)
  └──────────┬─────────┘
        R1.1 → R1.2 → R1.3
          └→ R1.4      └→ (R1.5 after R1.1)
                R2.1 → R2.2 → R2.3
                          └→ R3.1 → R3.3
                                  R3.2 (settled) → R3.4
R4.1 (anytime)   R4.2 (retired)
```

Tracking: Linear (`Krates-ehf` / Morphe, `KRA-###`) — one issue per workstream,
labeled per `docs/agents/triage-labels.md` (R0.x and R4.1 are
`ready-for-agent`; R1+/R3 are owner-gated grammar/architecture work —
`ready-for-human` or paired). Issue creation is a separate, blessed step — this
document is the plan of record.

# ADR-0024 — Deterministic Operational Mid-Loop Is a Host Circuit

- **Status:** Accepted
- **Date:** 2026-08-04
- **Driver:** Complete Lemma 6's model-free operational path without widening the renderer,
  grammar, or host authority boundary

## Context

ADR-0004 made the renderer choice-only: an emission envelope and its epoch are host-side data, and
`MorpheRoot` receives only an already-admitted choice map. ADR-0018 made `Within` operational only
when it owns one explicit target. What remained was a deterministic, replayable host circuit that
could decide inside the already-authored variation space without treating a compound template,
untrusted proposal, or event digest as implicit authority.

The circuit must agree with render admission. A visible compound expands through the effective
resolver; an unknown, dialect-hidden, or invalid reference renders empty. It must therefore grant
the same amount of variation authority: none. It must also preserve the package's independence:
there is no model venue, tier-2 producer, route-owned business policy, or corpus admission rule in
this package.

## Decision

1. `liveVariationIndex(tree, { resolver? })` is the immutable proof of current variation
   authority. With an effective resolver it follows renderer compound admission exactly: visible
   refs expand, while unknown, hidden, and invalid refs authorize neither template sockets nor
   call-site args/slots. Without a resolver it keeps the registry-free authored walk for direct
   nodes and raw compound fills, without inventing template authority. A targeted `Within` is live;
   a targetless compatibility leaf is inert. Duplicate ids retain every occurrence, and a choice
   must satisfy the intersection of all their bounds.
2. `applyDelta` remains the canonical structural gate. It consumes epochs before render, returns the
   exact prior envelope on stale/unknown/out-of-range input, and is the only Delta path that updates
   an envelope's choice map. The host may reuse its bound live index for that canonical validation.
3. `DeterministicObjectivePolicy` names its targets, objective, allowed choices, readable store
   paths, readable Tier-1 kinds, and pure chooser explicitly. Binding resolves those targets against
   the live index once per emission. Digest projection admits state only from named paths and events
   only when both their path and kind are named; no authority is inferred from copy, labels, ids, or
   raw interaction.
4. `runMidLoop` is a pure host runtime. It invokes a delegate, detaches and parses its output, runs
   structural admission and then policy admission, and records immutable proposed, accepted,
   rejected, and superseded outcomes. Thrown, malformed, stale, dead, structurally invalid, and
   out-of-policy proposals fail closed. A native user override uses the same path and locks that id
   against delegates for the current epoch. Only a strictly higher safe-integer re-emission clears
   locks; same, lower, fractional, or non-finite epochs are host rejections that preserve the exact
   current envelope, choices, and locks.
5. The renderer stays outside this circuit. `MorpheRoot` receives choices only; neither it nor the
   grammar imports the policy or runtime. No Svelte state, clock, random source, I/O, persistence,
   tier-2 producer, or learned/model delegate is introduced here.
6. `/substrate` remains the mutable live proof surface for host-owned choices and adaptation
   experiments. `/p/demo` remains immutable to this circuit: it is a publication route, not a
   mid-loop control host. Runtime outcome evidence is replay material only; six-kernel corpus
   curation and any operational ledger are owned by their governing systems and are not Morphe
   doctrine.

## Consequences

- Lemma 6 now has a deterministic operational host circuit with resolver-specific authority and
  reproducible evidence, while Corollary 1 still holds when no host runs it.
- Consumers bind a policy and live index for each emitted tree/resolver pair, then pass only the
  admitted `choices` to `MorpheRoot`. A new tree or resolver requires a rebind; a re-emission never
  reuses an old epoch's user lock.
- `Vary.objective` remains an authored declaration. The deterministic policy names its own target
  objective explicitly; learned objective selection and venue feasibility remain later work.
- Evidence is constrained by the same validation path as live behavior, but it does not itself
  define a training corpus, cross-kernel ledger, deployment topology, or producer-side mutation.

## Evidence

- `src/lib/delegation/applyDelta.ts` — resolver-specific live index and canonical Delta admission.
- `src/lib/delegation/objectivePolicy.ts` — explicit binding and path-plus-kind digest projection.
- `src/lib/delegation/midLoopRuntime.ts` — pure runtime, outcome records, overrides, and epoch law.
- `src/lib/delegation/midLoopRuntime.test.ts` and `src/lib/lemmas.property.test.ts` — focused and
  seeded fail-closed, identity, duplicate-bound, projection, re-emission, and byte-stability proof.
- `src/routes/substrate/live-proof.ts`, `src/routes/substrate/+page.svelte`, and the canonical DOM
  fixture — one real host-owned digest → policy → proposal → Delta → choices → receipt circuit.
- `e2e/contrast-a11y.e2e.ts` — Chromium/Firefox hydration, keyboard focus, accepted/rejected/stale
  proposals, user locks, monotonic re-emission, byte-stable replay, and 390px evidence visibility.

# Morphe — Stratified Adaptive UI

Proposal v0.7, reconciled with the implementation on 2026-07-13.

This document is the package-level **why**. `CONTRACT.md` is the **what and how** of the
substrate, `DESIGN.md` is its visual and interaction doctrine, and `STATUS.md` is a dated
verification snapshot. Product integration details belong in their owning tracker or active
context, not in this repository.

## 0. Thesis

A model-driven interface is safe and useful only when adaptation authority is stratified by
timescale and each stratum's output constrains the next.

Morphe therefore treats an interface as typed data rendered through a closed capability grammar.
It combines:

- a finite set of browser-capability primitives;
- an open, data-defined vocabulary of compounds;
- a compositional context algebra that limits visual authority;
- semantic tokens and dialects that preserve authored meaning under re-theme;
- explicit state and action injection at the host boundary;
- typed variation points whose choices are narrower than the tree that authorized them.

The resulting authority chain is:

```text
grammar >= dialect >= emitted tree >= live variation space >= accepted choices
```

Nothing inward may acquire authority that was not granted outward.

Morphe is an **independent, versioned package** and **Projection M of Eidos**. These statements
answer different questions. Independence fixes ownership and distribution. Projection M names
the package's architectural role: turning typed structure into something perceivable. It is not a
repository-location or source-coupling claim.

## 1. Definitions

### Substrate

A server-driven UI substrate is a pair `(P, render)` where `P` is a finite set of primitive
component kinds shipped as code and `render` is total over valid typed trees.

### Grammar and tree

The grammar `G` assigns every primitive a discriminated schema and a composition rule. `Tree(G)`
is the set of schema-valid trees. Primitives are closed because they carry browser capability.
Compounds make the authored vocabulary open without expanding browser authority.

### Context

The adaptation context is the typed tuple:

```text
(host presentation context, task state, interaction state, data shape)
```

The package does not infer or persist the host presentation context. A consumer may inject a
dialect or use the neutral default.

### Timescale strata

| Stratum | Typical persistence or latency | Authority |
|---|---|---|
| frame | session to durable | which dialect governs |
| slow | seconds | which tree and variation envelope exist |
| mid | tens to hundreds of milliseconds | choices inside authorized variation points |
| fast | frame-local | component state and structural context response |

### Envelope

An envelope is a typed value emitted by one actor that limits the transitions available to the
next actor. Grammar, dialect, tree, epoch, and choice map are progressively narrower envelopes.

### Purity

A decision actor is pure when its output is a function of one typed input rather than hidden
state or interleaved UI events. Purity enables replay, caching, and deterministic validation of
the boundaries around nondeterministic judgment.

## 2. Assumptions

1. A slow decision actor may emit typed trees as structured output.
2. That actor cannot satisfy frame-local or direct-manipulation latency.
3. Primitive browser capability changes only when frontend code ships.
4. Model output can be constrained by JSON Schema and validated again at ingress.
5. A host may provide a low-latency decision venue, but every result except the latency claim is
   venue-independent.

The system must remain useful when assumptions 1 and 5 are absent. Hand-authored trees and
authored defaults are not fallback theater; they are the fixed point.

## 3. The two obstructions

### O1: the closed catalog

If the authored vocabulary equals the primitive set, every reusable pattern requires a frontend
release. The component catalog becomes the ceiling on expression.

### O2: stratum starvation

If every adaptation routes through the slow actor, fast and mid-loop behavior either feels slow
or escapes into ad hoc client code. The result is not one adaptive system but several unrelated
ones with no shared authority boundary.

The seven lemmas resolve those obstructions.

## 4. Lemma 1 — generativity

Morphe has two vocabularies:

- **Primitives** are closed, shipped capabilities: layout, content, input, feedback, action,
  overlay, and meta nodes.
- **Compounds** are data-defined operators: parameter schema plus a template tree containing
  `ParamRef` and `Slot` leaves.

A compound may be registered only after a gate validates its template, expansion depth, cycles,
parameter leakage, and root-claim hygiene.

**Lemma 1.** If every compound expands to a finite valid term in `Tree(G)`, then the vocabulary is
open under composition while browser capability remains closed.

This removes O1. A new reusable pattern can arrive as data without making arbitrary code an
authoring capability.

The implementation deliberately keeps one hard boundary: compound parameters substitute node
positions and slots; they do not interpolate arbitrary string fields. That constraint keeps
expansion structural and total.

## 5. Lemma 2 — calm

Every container receives a context:

```text
C = (depth, density, scale tier, emphasis budget, surface)
```

The child context is a pure transform of the parent context and the child's declared role.
Authors state role, priority, and semantic intent; they do not emit geometry.

The algebra obeys four laws:

1. **Locality:** a subtree depends only on its incoming context and authored term.
2. **Stability:** unrelated siblings do not perturb one another.
3. **Monotone depth:** ordinary descent cannot increase visual authority.
4. **Budget conservation:** sibling emphasis claims are normalized within a bounded budget.

`Frame` is the explicit reset that may establish a new surface, scale root, and budget.

**Lemma 2.** Any valid tree rendered through these transforms remains locally composable and
bounded in visual authority, regardless of whether a person, compiler, or model authored it.

This is the anti-slop mechanism. Calm is enforced by composition rather than requested in a
prompt.

## 6. Lemma 3 — invariance

The token system has three layers:

```text
neutral scales -> semantic intents -> component slots
```

Authored trees may name intents only. Primitive components consume slots only. Dialects map
intents and surface tokens onto scale values.

**Lemma 3.** An authored tree is a fixed point under any conforming re-theme: the intent-to-scale
mapping may change without changing the tree or its semantic claims.

This decouples authored meaning, renderer evolution, and visual identity.

## 7. Lemma 4 — dialect restriction

A dialect is a validated frame-stratum artifact containing:

- a complete intent map;
- bounded root algebra priors;
- an optional permitted compound subset.

A dialect never adds primitive capability. A restricted grammar `G|D` retains the same renderer
and algebra.

**Lemma 4.** If a dialect covers the grammar-declared intent keyset, its priors remain bounded,
and every permitted compound passed Lemma 1's gate, then `G|D` is itself a valid grammar and
render remains total.

This is closure under restriction. The same validation machinery that admits compounds also
makes a narrower vocabulary safe.

The shipped dialect registry proves intent, surface, and prior invariance. It now also carries an
explicit structural policy for every dialect: `clinical` allowlists the full promoted package
catalog (promoted-only; ratified KRA-788), while
the other eight remain unrestricted for compatibility. Generated, integrity-stamped `G|D` masks
make that same restriction available to structured producers and package consumers.

## 8. Lemma 5 — state purity

State belongs to three tiers:

| Tier | Examples | Owner |
|---|---|---|
| 0 | focus, hover, keystroke, transient overlay mechanics | primitive component |
| 1 | selection, filter, disclosure, input commit | injected client store |
| 2 | submit, task transition, explicit failure feedback | host escalation boundary |

The tree carries store paths and action ids, never live values or handlers. `MorpheRoot` injects
the store, action map, and optional escalation handler. A `ContextDigest` is the versioned
snapshot of tier-1 state plus a bounded recent-event window.

**Lemma 5.** If tier-0 state cannot escape component scope, tier-1 state crosses one injected
store interface, and tier-2 events cross one typed escalation interface with a digest, then the
decision actor remains pure and the interaction history is replayable.

The store and digest mechanisms are shipped. The tier-2 provider is shipped, but no package
primitive currently produces a tier-2 event. The contract is present; the live circuit is not.

## 9. Lemma 6 — bounded delegation

The slow actor may authorize discrete and continuous variation:

```text
Vary(id, options, default, objective?)
Within(id, dimension, range, default, target?, summary?)
```

An emission envelope carries an epoch, tree, and choice map. A delta carries an epoch, variation
id, and proposed choice. `applyDelta` rejects stale epochs, unknown ids, and out-of-range choices
before render. `MorpheRoot` receives only the resulting choice map; epochs never enter the
renderer.

**Lemma 6.** Accepted mid-loop changes are contained in the variation space authored by the
current tree, and a new epoch invalidates in-flight work.

`Vary` and `Within` are operational under the same epoch-checked choice contract. A targeted
`Within` owns exactly one subtree: density changes its incoming context, emphasis competes in the
parent's bounded budget, and collapse becomes a native labelled disclosure. A targetless legacy
leaf stays inert, so older trees remain total without granting implicit sibling authority.

## 10. Lemma 7 — venue feasibility

The mid loop is useful only if its decision venue meets the interaction budget. A conforming host
may provide that venue near the renderer, in the browser, or through another low-latency adapter.
The package must not prescribe one deployment topology.

**Lemma 7.** If the chosen venue can return schema-constrained choices inside the mid-loop budget,
the mid loop can improve salience or anticipation without entering the frame loop.

This lemma is conditional. When no venue meets the bound, the system deletes the mid loop and
continues with slow decisions, authored defaults, and fast component behavior.

## 11. Theorem — stratified adaptive sufficiency

Under the assumptions above, Lemmas 1–7 produce a system in which every adaptation class has a
native stratum and every inner actor has less authority than the envelope that created it:

```text
Grammar >= dialect >= emitted tree >= epoch variation space >= accepted choices
```

- Lemma 1 opens vocabulary without opening primitive capability.
- Lemma 2 bounds visual composition.
- Lemma 3 preserves meaning under re-theme.
- Lemma 4 closes dialect restriction under the same grammar.
- Lemma 5 keeps interaction state and decision state separable.
- Lemma 6 confines recomposition to current typed holes.
- Lemma 7 establishes the conditional latency venue.

Information flows outward as coarser state and event digests. Authority flows inward as tighter
typed envelopes. No model is in a frame loop, no authored tree carries executable handlers, and no
dialect may escape the grammar.

## 12. Corollaries

### Monotone degradation

Deleting an upper stratum preserves function:

- no dialect selection -> use the default dialect;
- no slow actor -> render a compiled or hand-authored tree;
- no mid loop -> render authored defaults;
- no client store -> unbound components remain locally functional where their contract permits.

Morphe must be a good deterministic UI substrate before any model participates.

### Replayable evidence

Pure typed boundaries make `(digest -> tree)` and `(digest, variation state -> accepted choice)`
records replayable. Such records may later support evaluation or refinement, but corpus policy is
outside the renderer and must not weaken runtime validation.

### Cacheable decisions

A pure slow decision can be cached. A typed variation space makes prediction targets explicit. A
host may therefore precompute likely next surfaces without granting the predictor new capability.

## 13. Package shape

Morphe owns four public Modules:

1. **Grammar Module:** authoritative Pydantic models, generated TypeScript, generated JSON Schema,
   grammar version.
2. **Compilation Module:** typed schema/data projection into deterministic `CompiledSurface`
   artifacts with diagnostics.
3. **Rendering Module:** Svelte renderer, context algebra, tokens, dialects, compounds, state and
   delegation seams.
4. **Delivery Module:** public package exports, neutral proof host, local CMS tools, and stripped
   artifact viewer.

Their direction is one-way:

```text
consumer view model -> compiler -> immutable artifact -> renderer
```

Consumer data, workflows, copy, source adapters, and side effects are outside the package. A host
may inject actions and state at the public seam; Morphe does not acquire consumer dependencies.

## 14. Construction phases

### Phase 0 — deterministic substrate

Closed primitives, total renderer, context algebra, three token layers, default dialect, dignity
test. Shipped.

### Phase 1 — open vocabulary and state boundaries

Compound lifecycle, store bindings, actions, event tiers, digest, replay seams, and the first
meaningful shipped compound restriction. A live tier-2 producer remains incomplete.

### Phase 2 — constrained adaptation

Epochs, variation ids, delta validation, per-dialect masks, slow and mid-loop adapters, objective
strategies. Per-dialect masks, a schema-constrained slow-loop lab proof, and bounded `Vary` /
`Within` mechanics ship; the operational mid loop and objective policy remain partial or future.

### Phase 3 — learned quality

Evidence curation, objective refinement, optional model specialization, and carefully governed
dialect refinement. Future and deliberately downstream of a complete deterministic circuit.

## 15. Verified implementation ledger

Legend: **shipped**, **partial**, **future**.

| Mechanism | State | Evidence surface |
|---|---|---|
| Pydantic grammar source | shipped | `py/morphe_grammar/models.py` |
| generated TypeScript and JSON Schemas | shipped | `src/lib/grammar/types.ts`, `schema/` |
| schema drift gate and grammar version parity | shipped | `just schema-check`, version tests |
| 22 primitive kinds plus meta and compound nodes | shipped | grammar and renderer registry |
| total renderer and visible diagnostic degradation | shipped | render and compiler tests |
| context algebra and property laws | shipped | `src/lib/context/` tests |
| three token strata and fixed intent keyset | shipped | `src/lib/tokens/`, dialect parity tests |
| nine intent/surface dialects | shipped | `src/lib/dialects/registry.ts` |
| dialect compound restriction | shipped | generated policies; `clinical` allowlists the promoted catalog |
| true per-dialect `G|D` masks | shipped | manifest + nine npm/Python package resources |
| compound lifecycle and expansion gate | shipped | `src/lib/compounds/factory.ts` |
| action map and tier-1 store binding | shipped | `MorpheRoot`, primitives, state tests |
| tier-2 escalation | partial | provider/envelope exists; no producer |
| `Vary` choices and epoch-checked deltas | shipped | delegation tests, renderer choice boundary |
| targeted `Within` behavior | shipped | explicit target; reactive density, budgeted emphasis, native collapse |
| schema/data surface compiler | shipped | `py/morphe_surface` |
| local CMS compile/preview/publish tooling | shipped | `py/morphe_cms`, preview routes |
| Pydantic-AI adaptive lab | partial | installed-mask structured-output and retry proof; no production host path |
| stripped viewer and grammar fail-closed gate | shipped | `viewer/` |
| viewer runtime validation of untrusted trees | shipped | generated artifact schema + dialect policy gate |
| production slow loop | future | no operational host path in this package |
| production mid-loop model | future | no deployed delegate in this package |

## 16. Open problems

1. **Canonical adaptive wire.** Unify TypeScript digest/escalation and Python decision contracts
   from one generated source.
2. **Variation discovery.** Ensure live variation discovery includes template-contained `Vary`
   nodes after compound expansion.
3. **Objective policy.** Define a deterministic first strategy for `Vary.objective` before adding
   a learned delegate.
4. **Corpus quality.** Define which replay records are suitable evidence and how negative signals
   are represented.
5. **Dialect refinement.** Define scope, hysteresis, acknowledgment, and rollback before any
   durable automatic change.
6. **Browser proof.** Add end-to-end verification for hydration, platform overlays, action wiring,
   state commits, delta rerendering, and the stripped viewer boundary.

The immediate direction is depth, not breadth: complete one deterministic artifact-to-viewer and
interaction circuit through the existing public seams before adding primitives, dialects, or
adaptive intelligence.

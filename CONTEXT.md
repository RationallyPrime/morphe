# CONTEXT — the Morphe glossary

> Canonical meanings of domain terms, as resolved with the contract owner (grill
> sessions). A glossary and nothing else — implementation lives in code,
> decisions in `docs/adr/`, the formal system in `VISION.md`/`CONTRACT.md`.
> When a term here conflicts with usage elsewhere, this file wins; fix the
> other place.

## The adaptation tower

- **Morphe** — an independent, versioned adaptive-UI substrate plus its
  agent-native content compiler. It serves as Projection M: typed structure to
  perceivable UI. Projection M names an architectural role, not repository ownership.
- **Morphe CMS** — the Morphe-local content compiler that turns typed content
  artifacts into validated Morphe node trees and publication pointers.
- **Host application** — an application that consumes Morphe and owns its own
  copy, routes, native control surfaces, side effects, and deployment.
- **Playground** — Morphe's own full-featured demonstration host, used to prove
  and inspect the substrate by exercising its authored-tree, dialect, variation,
  CMS, and adaptive seams. It contains no consumer-specific content.
- **Demo asset set** — the neutral visual material the Playground uses to
  showcase Morphe's media, dialect, and adaptation capabilities. It is authored
  for Morphe itself, not inherited from a host application's brand narrative.

- **Stratum** — a timescale class of adaptation (τ_frame, τ_slow, τ_mid,
  τ_fast), each served by its own actor under a typed envelope. See
  `VISION.md` Definition 4.
- **Envelope** — a typed object one actor emits that delimits another actor's
  authority. The *emission envelope* specifically wraps a slow-loop tree with
  the epoch and the current variation choices; it is delegation-time data, and
  the renderer never sees its epoch (ADR-0004).
- **Epoch** — the freshness token of one slow-loop emission. Minted
  monotonically per surface by whoever constructs the envelope; a re-emission
  bumps it, invalidating in-flight mid-loop work.
- **Delta** — a mid-loop proposal: (VaryId, choice) tagged with the epoch it
  was computed against. Valid only when its VaryId is live and its epoch
  current.
- **Variation point** — a typed hole the slow loop authorizes the mid loop to
  fill: `Vary` (discrete options) or `Within` (bounded movement along one named
  dimension over one explicit target). The only places mid-loop authority
  exists. A targetless `Within` is a compatibility leaf and grants no authority.

## Host context

- **Persona** — optional `(vertical, role)` metadata describing the register a
  specialized dialect was designed to serve. A host may use this metadata when
  selecting a dialect; Morphe does not infer a user's identity or role.
- **Dialect** — a presentation register: an intent-layer remap plus bounded
  algebra priors and an optional compound subset. It changes presentation, not
  authored meaning, application policy, or user identity.

## State & purity (Lemma 5 vocabulary)

- **Tier** (of an event or state) — who may know about it: tier 0 never leaves
  the component (hover, keystroke); tier 1 commits to the client store
  (selection, filter); tier 2 escalates to the producer as a typed event
  (submit, task transition, "this view isn't working").
- **Binding** — a node's declared connection to the client store: a store
  path + initial value, never a live value. The wire carries names, not state.
- **Store path** — a flat, opaque key into the client store. Nesting lives in
  the stored value, never in the path (ADR-0003); a path is a name, not a
  query.
- **Digest (ContextDigest)** — the typed, versioned, serializable snapshot of
  tier-1 state plus a short recent-event window. The producer's only view of
  interaction state, and the future training-corpus row (Corollary 2).

## Emphasis (Lemma 2 vocabulary)

- **Claim** — what a node *asks* for (`emphasis: "critical"`). Authors and
  models claim; nothing renders a claim directly.
- **Grant (rendered emphasis)** — what the parent *awards* after renormalizing
  all sibling claims against the budget B. The only emphasis that paints.
  Claims compete; grants conserve. A compound's claim is made by its call
  site, on behalf of the expansion.

## Composition

- **Intent** — a semantic color/register name (`provenance`, `caution`, …) —
  the ONLY vocabulary authored trees may use for appearance. Never a scale,
  never a hex.
- **Compound** — a vocabulary item defined as data (params + template) over
  primitives, admitted through the validation gate. Open vocabulary, closed
  capability.
- **Native control surface** — the idiom that live interactive controls and
  conversion CTAs live *outside* the Morphe tree as native elements styled by
  the same tokens; the tree carries editorial/result content.

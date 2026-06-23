# CONTEXT — the Morphe glossary

> Canonical meanings of domain terms, as resolved with the founder (grill
> sessions). A glossary and nothing else — implementation lives in code,
> decisions in `docs/adr/`, the formal system in `VISION.md`/`CONTRACT.md`.
> When a term here conflicts with usage elsewhere, this file wins; fix the
> other place.

## The adaptation tower

- **Morphe** — the product module: a typed adaptive-UI substrate plus its
  agent-native content compiler. It is not the Sókrates website; the website
  consumes Morphe.
- **Morphe CMS** — the Morphe-local content compiler that turns typed content
  artifacts into validated Morphe node trees and publication pointers.
- **Host application** — an application that consumes Morphe and owns its own
  copy, routes, native control surfaces, side effects, and deployment.
- **Playground** — Morphe's own full-featured demonstration host, used to prove
  and inspect the substrate by exercising its authored-tree, dialect, variation,
  CMS, and adaptive seams. It contains no Sókrates-specific content.
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
  fill: `Vary` (discrete options) or `Within` (bounded movement along a named
  dimension). The only places mid-loop authority exists.

## People & audiences

- **Persona** — the product-side typed pair (vertical, role) of the person at
  the screen — e.g. hospitality CFO. Bootstrapped from deployment + directory
  on the appliance; refined, never invented, by inference.
- **Cohort** — the marketing-side audience segment, defined by the ad-campaign
  taxonomy (it cannot be mined from a click; it is designed into campaigns).
  A cohort *selects* a dialect and a copy variant; many cohorts may share one
  dialect. The cohort is the funnel's shadow of the product's Persona — they
  are distinct concepts.
- **Dialect** — a presentation register: an intent-layer remap plus bounded
  algebra priors (and, Phase 1+, a compound subset). NOT an audience — the
  thing a cohort or persona selects, never the segment itself.

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

# ADR-0017 — `Within` Remains a Reserved Socket

- **Status:** Accepted
- **Date:** 2026-07-13
- **Supersedes:** ADR-0004's visible `Within` effect clauses and ADR-0014 D5/D9's
  context-free collapse claim

## Context

The grammar represents `Within` as a context-free leaf containing an id, dimension, range, and
default. Choice resolution correctly maps its bounded number to a typed density, emphasis, or
collapse value. The node owns no child or target, however, and no rendered container consumes that
resolved value. `Node.svelte` therefore resolves it and renders nothing.

Earlier doctrine described the typed resolution as if it already changed a surrounding container
or disclosure. That effect is not present and cannot be derived without implicit sibling magic,
which would violate the context algebra's locality rule.

## Decision

Preserve `Within` in the grammar for compatibility and bounded-delta validation, but classify its
visible behavior as partial. A conforming surface must remain correct when every `Within` leaf is
inert. The compiler may preserve existing leaves, but may not rely on them to provide visible
collapse, density, or emphasis behavior.

Completing `Within` requires an owner-gated grammar contract that names its target structurally,
such as a wrapper with children or an explicit target relationship, followed by DOM-level tests
showing locality, budget conservation, fallback, and stale-epoch rejection.

## Consequences

- `Vary` is the only currently render-real variation primitive.
- R2 bounded delegation remains partial even though epoch checks and numeric resolution ship.
- Documentation and demos must not present context-free `Within` leaves as working interaction.
- A future target contract must preserve existing trees and render defaults total.

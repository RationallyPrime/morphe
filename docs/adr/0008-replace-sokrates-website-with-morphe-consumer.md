# ADR-0008 — Replace sokrates-website with a Morphe consumer

- **Status:** Accepted
- **Date:** 2026-06-23
- **Related:** ADR-0007, `docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md`

The `sokrates-website` repo contains the older Next/React ancestor of the same marketing
site now implemented more completely in this Morphe repo. The website repo should remain
the repository and deployment home, but its implementation should be replaced by a
SvelteKit site that consumes `@rationallyprime/morphe`; Morphe stays the package/CMS
product module, not the website host.

## Decision

Replace the current Next/React implementation in `sokrates-website` with the Morphe/SvelteKit
implementation from this repo, converting `$lib` imports to package imports through the
published Morphe seams. Do not build a React or web-component render adapter merely to keep
the older Next app alive.

## Consequences

- The migration is a repo replacement, not a component embedding exercise.
- Dirty or still-valuable work in `sokrates-website` must be preserved before replacement,
  then cherry-picked only when it is still relevant to the Morphe implementation.
- The Morphe repo can be cleaned back to package, CMS, and playground/demo concerns after
  the external website consumer is live.

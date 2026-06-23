# ADR-0011 — Move Sokrates plate assets out of Morphe

- **Status:** Accepted
- **Date:** 2026-06-23
- **Related:** ADR-0008, ADR-0010, `docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md`

The Timaeus plate imagery belongs to the Sokrates website lineage. Morphe needs a
full-featured playground, but that playground should showcase Morphe with neutral demo
assets rather than retaining Sokrates-specific visual narrative material.

## Decision

Move the existing Timaeus/plate assets with the Sokrates website. Replace them in Morphe
with a new neutral demo asset set chosen specifically to demonstrate Morphe's media,
dialect, variation, CMS, and adaptive capabilities.

## Consequences

- Morphe's playground remains ambitious without carrying Sokrates brand/story content.
- Sokrates keeps the plate assets and any associated narrative pages in the website repo.
- The implementation plan must include an asset replacement step instead of merely
  deleting media references.

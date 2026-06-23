# ADR-0010 — Keep a full-featured Morphe playground

- **Status:** Accepted
- **Date:** 2026-06-23
- **Related:** ADR-0008, ADR-0009, `docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md`

After the Sokrates website leaves this repo, Morphe still needs a host application that
proves the substrate end to end. That host is not the public Sokrates marketing site and
must not carry Sokrates-specific content, but it should be a serious demonstration of what
Morphe can do rather than a minimal smoke test.

## Decision

Keep a full-featured Morphe playground in this repo. It should exercise the design
system's authored trees, dialects, context algebra, variation points, CMS preview/publish
flow, and adaptive seams with Morphe-native demo content only.

## Consequences

- The cleanup removes Sokrates copy, cohorts, lead flows, and brand assets from the
  Morphe playground instead of deleting the playground.
- The playground remains a package consumer and regression surface for the public Morphe
  seams.
- Demo content must be written for Morphe itself; Sokrates-specific examples belong in the
  website or Sokrates agent workflow repos.

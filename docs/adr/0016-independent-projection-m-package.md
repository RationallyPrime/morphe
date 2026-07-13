# ADR-0016 — Keep Projection M Independently Packaged

- **Status:** Accepted
- **Date:** 2026-07-13
- **Supersedes:** ADR-0013's requirement to retain `PRODUCT.md` and `MIGRATION.md`, and
  the abandoned monorepo topology recorded by `MIGRATION.md`

## Context

Morphe now ships through public package and schema seams. Its authoritative Pydantic grammar,
generated TypeScript and JSON Schema artifacts, compiler, renderer, and stripped viewer all live
and release coherently from this repository.

Earlier plans conflated two separate claims: Morphe's architectural role as Projection M and the
repository in which its source must live. They also left product positioning and an abandoned
repository migration beside the package contract, inviting private consumer topology to drift
back into public doctrine.

## Decision

Morphe remains an independent, versioned package and serves as Projection M. Projection M means
typed structure to perceivable UI; it does not imply repository co-location, source coupling, or
ownership of a consumer application.

Delete `PRODUCT.md` and `MIGRATION.md`. The active public corpus is `CONTEXT.md`, `VISION.md`,
`CONTRACT.md`, `DESIGN.md`, `PACKAGING.md`, `STATUS.md`, the completion ledger, and package ADRs.
Consumer-specific positioning, operational topology, and cross-repository plans belong in their
owning private tracker or context, not in Morphe's public doctrine.

## Consequences

- Consumers integrate through versioned package, schema, compiler, renderer, and artifact seams.
- Morphe may evolve and release without importing consumer internals or moving repositories.
- Package doctrine describes reusable contracts and honest implementation status only.
- Historical documents remain historical evidence; this ADR wins wherever they imply a monorepo
  move or require the deleted documents to remain active.

# ADR-0009 — Keep Morphe CMS behind a service seam

- **Status:** Accepted
- **Date:** 2026-06-23
- **Related:** ADR-0008, `docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md`

Morphe CMS is part of Morphe, not part of the Sokrates website. Host applications and
Sokrates agent workflows may invoke it, but they should do so through an MCP or HTTP API
seam rather than copying `py/morphe_cms` internals into the website repo.

## Decision

Keep the CMS runtime local to Morphe and expose create/validate/preview/publish operations
through service interfaces. The website migration does not gain ownership of the CMS
package; it consumes published content or calls the service when content authoring is in
scope.

## Consequences

- The website extraction can proceed without moving Python CMS internals into
  `sokrates-website`.
- Morphe remains responsible for the grammar gate, artifact contracts, compiled-tree
  shape, and publication semantics.
- Sokrates-specific agent workflows can call the CMS through MCP/API without becoming the
  owner of Morphe's content compiler.

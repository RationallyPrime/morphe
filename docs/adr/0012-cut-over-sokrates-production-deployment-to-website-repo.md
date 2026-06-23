# ADR-0012 — Cut over Sokrates production deployment to the website repo

- **Status:** Accepted
- **Date:** 2026-06-23
- **Related:** ADR-0008, ADR-0010, `docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md`

The current live Sokrates marketing site is implemented in the Morphe repo, but Morphe is
becoming the product module and playground host. The Sokrates website repo should own not
only the website code after replacement, but also the production deployment for the public
site.

## Decision

Include production deployment cutover in the migration. After replacement,
`sokrates-website` owns the live Sokrates marketing deployment, including the production
domain, environment variables, and deployment verification. The Morphe repo may keep a
separate Morphe playground/demo deployment, but it no longer deploys the public Sokrates
website.

## Consequences

- The implementation plan must include deployment inventory, environment-variable
  transfer, Vercel project/domain cutover, and post-cutover smoke checks.
- Morphe cleanup is not complete while the Sokrates production site still deploys from
  this repo.
- Future Morphe deployments should be named and branded as Morphe playground/demo surfaces,
  not as Sokrates marketing production.

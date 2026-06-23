# ADR-0013 — Split Morphe and Sokrates documentation

- **Status:** Accepted
- **Date:** 2026-06-23
- **Related:** ADR-0008, ADR-0010, ADR-0011, ADR-0012

This repo currently mixes Morphe substrate/product doctrine with Sokrates website
positioning, visual identity, copy, routes, and launch decisions. After extraction,
Morphe documentation should describe Morphe as the product module and playground, while
Sokrates website documentation should describe the public marketing site.

## Decision

Keep Morphe substrate/package/CMS/playground doctrine in this repo: `CONTEXT.md`,
`VISION.md`, `CONTRACT.md`, `PACKAGING.md`, `STATUS.md`, `MIGRATION.md`, and ADRs about
the substrate, package seams, CMS, and Morphe playground. Move or recreate public-site
documentation in `sokrates-website`: Sokrates product positioning, brand/copy canon,
redesign notes, onboarding/contact decisions, composer/ranking decisions, stage-home
intent-engine decisions, and plate narrative material.

`PRODUCT.md` and `DESIGN.md` must be split rather than left as-is: Morphe gets rewritten
product/design docs for the substrate, CMS, and playground; Sokrates gets the current
marketing identity and copy canon.

## Consequences

- The Morphe repo stops treating the Sokrates identity as its default product narrative.
- The Sokrates website repo gains the docs required to own its public copy, brand assets,
  deployment, and conversion flows.
- Existing ADRs whose scope is Sokrates-specific should be copied/moved/superseded during
  extraction rather than silently left as active Morphe doctrine.

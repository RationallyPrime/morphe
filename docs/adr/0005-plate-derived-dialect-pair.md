# ADR-0005 — Plate-derived dialect pair; gallery-light is the default ground

- **Status:** Accepted
- **Date:** 2026-06-10
- **Deciders:** Hákon (founder), D6 of the site-reconstruction grill
- **Related:** DESIGN.md, CONTRACT.md §8 (intent keyset), ADR-0006 (the stage + intent
  engine), the Timaeus plates (`static/images/plates/`, KRA-325/327)

## Context

The nine Timaeus plates are now the site's visual canon: luminous cobalt/cyan
wireframe engravings on a blue-black night — monochrome luminism with white-hot
cores. The shipped default theme (`icelandic-archive`: amber `#f2ca50` beacon on
neutral charcoal `#121416`) predates them and fights them — the amber beacon and
the plates' blue read as two different brands, and dark plates on a dark page
lose their glow entirely (verified against full-page renders).

The substrate was built for exactly this move: a dialect remaps the intent layer
and nothing else, so the entire visual system can change without touching one
authored tree (Lemma 4). No dialect is sacred; the substrate is the locked part.

## Decision

1. **Two new dialects, both derived from the plates' own palette:**
   - **`gallery`** — the museum ground. Warm bone/plaster paper surfaces
     (≈`#EFEBE3` base / `#E4DFD4` secondary), ink-navy text drawn from the plate
     shadows (≈`#101826`), and a single accent: electric cobalt (≈`#1E56E8`),
     the same hue family as the plate light. Plates sit in dark vitrine wells
     and glow against the calm ground. Monochrome + cobalt; no second accent.
   - **`night`** — the immersive ground. Surfaces in the plates' blue-black
     strata (≈`#070B14` base / `#0C1322` raised), ice-white text (≈`#E9F0FA`),
     cobalt as the luminous primary. The inside of the appliance.
2. **`gallery` is the shipped default** for every visitor-facing surface. The
   amber-on-charcoal identity is retired as the default; `icelandic-archive`
   remains a registered dialect (the substrate demo's fixed point) until a
   separate retirement decision.
3. **The CONTRACT §8 core intent keyset is preserved verbatim** in both new
   dialects (`primary-action`, `neutral`, `provenance`, `evidence`, `accession`,
   `caution`, `success`, `info`), and `dialects.test.ts` extends to both.
   Exact hex values above are starting points, tuned in-build against the
   plates; the *relationships* (paper ground / ink text / single cobalt accent;
   night ground / ice text / cobalt glow) are the decision.

## Consequences

**Positive**

- The plates become the brand instead of competing with it; the site's only
  strong visual asset is staged instead of camouflaged.
- Bright-archival ground is differentiated in a market uniformly shipping
  dark-glow AI sites, and matches the brand's own register (archive, accession,
  provenance, folio, seal — a museum vocabulary).
- The change ships as dialects — the mechanism's first real production workout —
  and "flip the lights" becomes a one-click demo of the substrate (ADR-0006).

**Negative / costs**

- Native control-surface chrome (composer controls, forms, nav, onboarding
  gate) styled with `--mo-*` tokens must be audited for hardcoded darks and
  light-ground contrast; this is the real cost of the default flip.
- Two grounds double the visual-QA surface for every future page.

## Alternatives considered

- **Night as default** (plate-immersion everywhere): maximum coherence, cheapest
  flip, but indistinguishable from the dark-glow default of the entire AI
  sector, and it wastes the plates — self-luminous art reads strongest against
  a calm light ground. Kept as the second dialect instead.
- **Keep amber, integrate plates**: rejected — complementary in theory, two
  brands in practice.
- **A two-accent compromise** (cobalt + a warm metal for CTAs): rejected;
  reintroduces the two-master problem the amber retirement solves.

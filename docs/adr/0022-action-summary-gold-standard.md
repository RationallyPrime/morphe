# ADR-0022 — ActionSummary Is the Compound Gold Standard

- **Status:** Accepted
- **Date:** 2026-08-02
- **Driver:** A maintained benchmark for promoted compounds and CMS consumption

## Context

Morphe has one minting lifecycle (`candidate` → `promoted`) but no formal answer to a different
question: which promoted compound demonstrates the complete standard that candidates and older
definitions must meet? Promotion proves that a definition passed the factory gate. It does not, by
itself, prove real presenter use, hostile dialect coverage, CMS ingress, host-bound runtime sockets,
or maintained browser behavior.

`ActionSummary@1.0.0` is the best neutral anchor. It owns only reading order; its required
`eyebrow`, `title`, and `summary` are node-valued, all variable lanes are caller-owned slots, and it
owns neither elevation, geometry, domain policy, nor runtime authority. The same definition already
serves operational exception/action surfaces without smuggling raw-string interpolation into the
factory.

## Decision

1. `GOLD_STANDARD_COMPOUND` is a machine-visible catalog constant whose value is
   `ActionSummary`. Gold certification is orthogonal to the candidate/promoted lifecycle and does
   not change the compound's semantic version.
2. The canonical fixture is `presentActionSummaryGold()` on `/substrate`. It fills every required
   argument and every declared slot (`signal`, `context`, `action`, `detail`). The caller supplies
   the raised `Frame`, proving that elevation remains composition rather than definition identity.
3. The fixture keeps all live authority at the host boundary:
   `MorpheRoot.store` owns bindings for Field, Select, Toggle, and Range;
   `MorpheRoot.actions` resolves the authored button ids; and `MorpheRoot.choices` resolves Vary plus
   targeted Within collapse and density sockets. The authored tree remains stable as those values
   move.
4. The detail lane nests `ProvenanceFooter`, proving recursive promoted-compound expansion and all
   of that definition's slots without giving either compound geometry or side effects.
5. The CMS lowers `ProblemFrame` through `ActionSummary`. Its compile gate validates generic Node
   shape, every recursive compound call against the package-promoted catalog, and the selected
   dialect before it stores a compiled tree. Unknown package names, missing/unknown arguments,
   wrong argument types, and unknown slots fail closed with path-bearing diagnostics.
6. CMS preview query overrides are untrusted render requests. Dialect overrides re-run the tree's
   dialect gate; viewport selection changes the preview boundary; action ids receive preview-only
   receipt handlers; Vary ids receive host controls; and an explicit store is provided. Preview
   handlers never claim production side effects.
7. Certification remains valid only while maintained tests prove:
   catalog identity and factory expansion; all arguments and slots populated; generic and
   promoted-reference validation; the same authored fixture accepted and rendered under all nine
   shipped dialects; CMS presenter/gate participation; real bindings, actions, Vary, and Within
   behavior; narrow reflow, keyboard access, and both Chromium and Firefox browser execution.
8. Tier-2 escalation is not part of this fixture. Morphe has a typed `onEscalate` boundary but no
   shipped in-tree affordance fires it yet; inventing one solely to make the matrix look full would
   violate the reserved-socket contract. Gold means every applicable seam is proved, not that a
   compound absorbs unrelated substrate capabilities.

## Consequences

- New compounds have a concrete comparison target instead of a style example: definition purity,
  caller-owned composition, strict ingress, host wiring, dialect invariance, and maintained browser
  evidence.
- Existing promoted compounds may remain promoted while falling short of gold. Their next review
  compares them to this evidence contract; it does not copy ActionSummary's visual structure.
- Moving the gold marker requires a new ADR and a replacement fixture that satisfies the complete
  matrix in the same change. A red mandatory evidence lane suspends the gold claim until repaired.
- `ActionSummary@1.0.0` stays unchanged because certification adds evidence and integration, not a
  new expansion contract.

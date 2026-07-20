# ADR-0021 — Operational Tasks Own the Heading; Audit Proof Leaves the Primary Scan

- **Status:** Accepted — KRA-798
- **Date:** 2026-07-20
- **Driver:** Timaeus viewer audit P1 hierarchy and provenance findings

## Context

The schema compiler promoted a conventional root identity (`name`/`title`, or even the first
required scalar) to `Text(as:"display")`. Because `display` also rendered as `h1`, an organization
or book name became both the largest line and the document title while the pane's operational task
sat beneath it as `h2`. Receipt ids, hashes, and seals also remained in the main scan. The result was
structurally valid but decision-hostile: context outranked work and audit machinery competed with
the decision it attested.

The signed source already carries enough generic hints to repair presentation without kernel copy,
field-name rules, or a new source contract. The grammar did not, however, have a way to express a
restrained visual heading that is still the logical `h1`.

## Decision

1. `Text` gains optional `level: 1 | 2 | 3`. `as` remains the visual register; `level` chooses the
   native heading element, and an explicit level may pair with any visual register. With no
   explicit level, the existing mapping remains
   `display -> h1`, `heading -> h2`, `subheading -> h3`. The grammar moves to `0.4.0`.
2. On every root strategy, Stage 2 emits exactly one `spec.label` — sourced from the
   producer-authored root schema label/title — as `Text(as:"heading", level:1)`. A legacy root
   `heading:false` cannot erase that task heading; nested heading suppression remains valid and
   nested records never emit level 1. `display` is reserved for deliberate editorial authorship,
   not compiler inference.
3. Stage 1 recognizes only conventional root `name`/`title` scalar identity and lowers it to muted
   `caption`/`folio` context. The former first-required-scalar fallback is removed.
4. Stage 2 performs one stable, hint-led partition: identity context; node diagnostics and
   attention claims; the primary worklist; other task content; provenance. Order inside each lane
   is unchanged. Explicit provenance outranks inferred identity so a signed audit hint always wins
   the classification and each field retains one home.
5. Explicit `provenance`, `accession`, and `seal` children move once to
   `ProvenanceFooter@1.0.0`: a promoted, unframed native disclosure named “Audit proof”, with
   an optional node-valued `heading` parameter plus caller-owned `facts`, `seals`, and `links`
   slots. The heading defaults to an empty caption; the disclosure summary remains the accessible
   control label. Provenance values and labels remain in audit proof, while recursive diagnostics
   hoist exactly once into the visible attention lane outside the initially closed disclosure. No
   value, link, diagnostic, or signed field content is duplicated or dropped (D8).
6. `EntityHeader` moves to `2.0.0` because its task title now precedes the contextual kicker and
   signal cluster. `SignalCard` remains `2.0.0`; KRA-788 already removed its frame and no new
   capability is introduced there.
7. The npm and Python package tracks move together to `0.8.0`. The Python compiler moves to
   `0.3.5`, the TypeScript edge compiler to `0.3.6`, and the generated edge-compiler build digest
   records the exact new runtime closure. No release tag is part of this change.

## Consequences

- Operational panes have exactly one logical task heading without forcing display typography,
  independent of root strategy or a legacy root `heading:false` hint.
- Context and auditability remain visible and accessible but stop competing with the decision path.
- The compiler stays domain-blind: no kernel field-name vocabulary beyond the already-ratified
  conventional root identity rule, and no kernel-authored testimony changes.
- Existing authored trees without `Text.level` keep their DOM hierarchy. Consumers that relied on
  inferred root-display identity receive the intentional compiler-versioned projection change.
- Python and TypeScript emitters must remain byte-parity gated for ordering, heading level, and
  exact-once provenance preservation.

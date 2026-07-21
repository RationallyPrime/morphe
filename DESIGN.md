# Morphe Design Doctrine

Status: package-canonical, reconciled with the implementation on 2026-07-13.

This document governs the visual and interaction character of Morphe itself. It does not define
the identity, copy, information architecture, workflows, or product strategy of any consumer.
Those belong in the consumer's own repository or planning context.

`VISION.md` explains why the adaptive tower exists. `CONTRACT.md` fixes the grammar and algebra.
This document answers a narrower question: what should any conforming Morphe surface feel like
before a consumer supplies its own dialect and content?

## 1. Design target

Morphe should make dense operational truth calm, legible, and trustworthy. It is not a dashboard
template, a page builder, or a collection of decorative components. A good surface has four
qualities:

1. **The hierarchy is obvious without spectacle.** Structure comes from role, scale, spacing, and
   tonal surface changes, not card walls or ornamental chrome.
2. **Meaning survives re-theme.** Authored trees name semantic intents, never colors or scale
   tokens. Every shipped dialect preserves the same information and affordances.
3. **State is explicit.** Status, failure, provenance, selection, and available action are visible
   in text or shape as well as color.
4. **Generated output still feels authored.** The context algebra limits emphasis, density, and
   depth so a schema-derived or model-emitted tree cannot make everything loud at once.

The package default is deliberately neutral. Consumer identity may be distinctive; Morphe's own
proof surfaces must not smuggle a consumer brand back into the substrate.

## 2. The three design inputs

Every rendered decision comes from exactly one of these sources:

| Input | Owns | Must not own |
|---|---|---|
| authored tree | semantic role, priority, intent, content, declared affordance | pixels, colors, live handlers, host state |
| context algebra | density, scale tier, emphasis normalization, surface descent | business meaning or route-specific exceptions |
| dialect | intent-to-scale mapping, surface temperature, bounded root priors, optional compound restriction | grammar mutation or consumer data |

If a visual choice cannot be located in one row, the design is leaking across a seam.

## 3. Composition before decoration

Containers carry roles: `page`, `section`, `panel`, `toolbar`, `list`, `form`, `field-group`, and
`inline`. The child context is derived locally from the parent context and role. Authors do not
specify a bespoke gap, heading size, or card treatment for each occurrence.

- `Frame` is the only context reset. Use it when a region genuinely establishes a new surface,
  scale root, or emphasis budget.
- `Stack`, `Grid`, and `Cluster` compose inside the current context. Do not wrap every group in a
  `Frame`; that turns hierarchy into a wall of cards.
- Prefer one strong reading order over a symmetrical matrix of equally weighted modules.
- Dense records may be compact, but density must not erase grouping, labels, or focus order.
- A single subtree receives only the emphasis the budget permits. A critical claim competes with
  its siblings; it does not mint more visual authority.

Depth is tonal. Raised, base, sunken, and overlay surfaces do the work that drop shadows usually
do. Ambient shadows, glass panels, and decorative borders are not part of the substrate grammar.

## 4. Typography

The token contract exposes three typographic roles:

- `--mo-font-display` / `--mo-font-headline` for titles and deliberate editorial emphasis;
- `--mo-font-body` for prose, controls, and operational labels;
- `--mo-font-mono` / `--mo-font-label` for identifiers, quantities, compact metadata, and
  accession-like captions.

The demo host self-hosts Spectral, Hanken Grotesk, Fragment Mono, and Material Symbols so it can
render without network access. These fonts are not a package requirement: consumers own their
font pipeline and may override the public font tokens.

Use registers semantically:

- `display` is rare, deliberate editorial emphasis; it is never inferred from an organization,
  book, account, or other contextual identity;
- `heading` and `subheading` express actual document structure;
- `body` carries the main reading flow;
- `caption` carries provenance, identifiers, and secondary explanation.

Visual register and outline level are independent. `Text.as` controls the type treatment;
`Text.level` controls the native `h1`/`h2`/`h3` element and may pair with any visual register.
The schema compiler emits operational pane tasks with the calm `heading` register at `level:1`;
identity context stays a caption below it. Older authored text without `level` keeps the established
display/heading/subheading element mapping.

Do not place a tiny uppercase mono eyebrow above every heading. Repetition is not hierarchy.

## 5. Color and intent

The token stack is strict:

```text
neutral scales -> semantic intents -> component slots
```

Authored trees may reference only the closed `IntentRef` vocabulary:

- core: `primary-action`, `neutral`, `provenance`, `evidence`, `accession`, `caution`,
  `success`, `info`;
- register: `folio`, `marginalia`, `seal`.

Primitive components consume slots. Dialects map intents and surfaces onto neutral scale values.
No authored tree, primitive, or dialect may bypass this direction with an ad hoc hex value.

`primary-action` is a beacon, not a general accent. A surface should normally have one obvious
primary action. `caution`, `success`, and `info` are functional and must always be paired with
text, an icon, a border/shape change, or another non-color signal.

## 6. Dialects

Nine dialects currently ship: `gallery` (default), `night`, `icelandic-archive`, `clinical`,
`reykjavik-registry`, `timaeus`, `ledger`, `estate`, and `foundry`.

The default is one fixed point in dialect-space, not the design system. No palette is sacred.
The invariant is that every dialect:

- covers the same intent/channel keyset;
- maps through neutral scale variables or permitted color expressions;
- preserves readable contrast and visible focus;
- keeps algebra priors inside their bounds;
- leaves the authored tree untouched.

The shipped dialects provide distinct intent maps, surface stacks, and priors. Their compound
policies are explicit and generated from the Python catalog: `clinical` allowlists the full
promoted package catalog (promoted-only — the restriction excludes unreviewed consumer
compounds, never the reviewed package vocabulary; ratified KRA-788), while the other eight
remain unrestricted for compatibility. Every dialect ships a
versioned `G|D` decoder mask. Appearance still comes only from intents and bounded priors; a
compound policy narrows structural vocabulary and never licenses geometry or consumer data.

## 7. Operational surfaces

Schema-derived surfaces should be intentional projections, not pretty-printed API responses.

- Define a purpose-built Pydantic view model at the producer boundary.
- Lead with the pane's operational task. Every root strategy receives exactly one compiler-owned
  logical `h1`, even when a legacy root carries `heading:false`; organization, book, account, and
  record identity are context, not a billboard above it. Nested heading suppression is unchanged.
- Order the primary scan as context, diagnostics/attention, the primary worklist, other task
  content, then audit proof. This is a stable projection: source order is retained inside each
  tier, and no signed field is duplicated, rewritten, or dropped. An explicit provenance hint wins
  over inferred identity, so audit material has one unambiguous trailing home.
- Keep hashes, receipts, seals, accession ids, and similar lineage out of the primary scan unless
  the operator genuinely needs them there. When explicitly hinted as provenance, preserve them in
  the trailing `ProvenanceFooter` disclosure; quiet does not mean absent.
- Format quantities, dates, references, and lineage before compilation when their display needs
  domain knowledge.
- An explicit `temporal: date-time-minute` policy gives compiler-generated scalar text one generic
  timestamp floor: a full RFC 3339 value displays at minute precision with an explicit zone. The
  source value and intermediate surface spec remain exact; timestamp-like opaque strings are never
  inferred, and producers still own every domain-specific date or calendar representation.
- Keep repeated record rows flat and scalar when they should lower to a grid. One nested field can
  correctly force a card-stack fallback; do not fight that fallback with renderer exceptions.
- Use enums when a value should become a badge. The label must remain sufficient without color.
- Sort rows producer-side. A renderer must not invent business order.
- Preserve visible diagnostics. Unsupported or malformed data degrades to an `inline-alert` and a
  diagnostic sidecar, never a blank surface or an unhandled exception.

Read-only is the fixed point. Add interaction only when a consumer supplies a real action/store
adapter and the authored tree can remain declarative.

## 8. Interaction boundary

Morphe nodes describe affordances; hosts own effects.

- `Button` carries an action id. The host injects the action map at `MorpheRoot`.
- `Link` navigates with a real `href`; it is not a button with link styling.
- Inputs carry typed accessibility relationships and optional store paths. The store is injected;
  live values and callbacks never enter the tree.
- Dialog, popover, and disclosure use platform semantics and the top layer rather than portals and
  z-index systems.
- Host chrome, authentication, routing, side effects, and destructive confirmation stay outside
  the authored tree.

Tier-0 interaction is component-local. Tier-1 state commits to the injected client store. Tier-2
events are designed to cross the host boundary with a digest. The tier-2 provider exists, but no
shipped primitive currently produces one; documentation and demos must not imply a completed
escalation circuit.

## 9. Adaptation

Adaptation must narrow authority as it moves inward:

```text
grammar -> dialect -> emitted tree -> live variation ids -> accepted choices
```

`Vary` is operational: a host can provide choices, and epoch-checked deltas can update them before
render. The authored default remains the total fallback.

`Within` owns at most one explicit target. Density changes that target's incoming algebra context;
emphasis becomes the target's claim in its parent's bounded emphasis economy; collapse wraps the
target in a native labelled disclosure. Choices remain numeric and bounded at the delegation
boundary, then resolve into these typed substrate inputs rather than raw CSS. A targetless legacy
`Within` renders nothing and never reaches across to a sibling.

The adaptive sidecar and `/api/adaptive/decision` route are lab proofs. They demonstrate schema-
valid output and deterministic fallback, not a production slow or mid loop.

## 10. The stripped viewer

The viewer is a deployment renderer, not a second application shell. Its surface is intentionally
tiny:

- `/surfaces/[artifactId]` renders one compiled artifact;
- `/healthz` reports readiness and the supported grammar version.

It must remain free of the playground, CMS, adaptive outbound route, source credentials, and
consumer-specific integrations. It fails closed on an unsupported `grammar_version`. The next
hardening step is full runtime validation of the fetched tree; producer validation alone is not a
trust boundary.

When a surface cannot render, the host should still provide a concise text digest or diagnostic.
The viewer link is an enhancement, never the only copy of an operational outcome.

## 11. Accessibility and motion

Accessibility is part of the grammar:

- every input has a typed label relationship;
- media always has `alt` (empty only when decorative);
- icons declare decorative or image semantics;
- feedback has a non-color signal;
- buttons and links use native elements;
- focus is visible through tokenized rings;
- overlays use the platform's focus and dismissal semantics.

Motion explains state change; it never supplies meaning. Every transition must respect
`prefers-reduced-motion`. Indeterminate progress may animate, but determinate progress and status
must remain legible when all motion is removed.

## 12. Reject on sight

- raw colors, pixel geometry, or scale-token names in authored trees;
- clickable non-interactive elements;
- runtime class-name synthesis matrices;
- card grids used as the default answer to every information architecture problem;
- shadows as depth, glassmorphism, gradient text, ambient decoration, or ornamental charts;
- color-only status and icon-only controls without accessible names;
- consumer copy, assets, routes, or product strategy committed as Morphe doctrine;
- direct source/storage calls from primitives, the renderer, or the stripped viewer;
- claims that a typed provider alone constitutes a finished tier-2 production circuit.

## 13. Verification

For any package design change:

```bash
just gates
```

In addition to automated gates, inspect the affected surface at desktop and narrow widths, with
keyboard-only navigation and reduced motion. Verify at least `gallery` and one dark dialect, then
confirm the same authored tree remains valid under all registered dialects. Viewer changes must be
tested through the stripped app, not inferred from the playground.

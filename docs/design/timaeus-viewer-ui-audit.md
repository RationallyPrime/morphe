# Timaeus Viewer UI and Product Audit

**Date:** 2026-07-20

**Target:** `https://timaeus.sokrates.is`

**Scope:** The stripped Morphe viewer, its live source panes, shared renderer primitives,
dialect behavior, and promoted compound vocabulary.

## Executive verdict

Morphe has a strong substrate and an under-edited product surface. The live viewer proves that
typed source testimony can be admitted, compiled, re-dialected, and rendered across six kernels,
but the result still reads like a compiler proof rather than an operator tool. It is structurally
coherent and technically distinctive, yet it repeatedly exposes schema shape, contract vocabulary,
and substrate controls in place of task hierarchy and editorial judgment.

The principal failures are not cosmetic:

1. Unfilled semantic text consumes token channels intended for text painted on a filled intent
   surface, producing severe contrast failures in several dialects.
2. Tabular data uses CSS grid geometry without sufficient table semantics or a viable narrow-width
   presentation.
3. Cell diagnostics remain inside individual table tracks, where alert minimum widths can obscure
   neighboring values.
4. Page hierarchy promotes organization identity over the operator's task.
5. Raw identifiers, hashes, compiler codes, and duplicate representations occupy primary reading
   space instead of a progressively disclosed provenance register.
6. Repeated raised KPI cards and equal-weight home panels substitute symmetry for prioritization.

**UI design health: 14/40 — poor.** This score deliberately excludes the quality of the underlying
architecture.

The corrective direction is fixed in [`PRODUCT.md`](../../PRODUCT.md): operator comprehension wins;
the product should feel calm, exact, and trustworthy; generated surfaces must feel deliberately
edited; and WCAG 2.2 AA is a release requirement across every dialect and supported viewport.

## Where the viewer and renderer live

The deployed surface is the separate `viewer/` application:

- `viewer/src/routes/+page.svelte` renders the composed home.
- `viewer/src/routes/surfaces/+page.svelte` renders the declared surface catalog.
- `viewer/src/routes/s/[source]/[surfaceId]/+page.svelte` renders one source pane.
- `viewer/src/pane-load.server.ts` resolves a declared source and routes it through the shared
  admission pipeline.
- `viewer/src/source-envelope.ts` verifies source testimony and invokes deterministic edge
  compilation.
- `viewer/src/surface-load.server.ts` applies the final grammar, dialect, and delivery-receipt gates.
- `src/lib/render/MorpheRoot.svelte` provides the dialect, context, compound resolver, state seams,
  and recursive `Node` renderer.
- `src/lib/render/Node.svelte` dispatches the closed grammar and expands compounds.
- `py/morphe_grammar/catalog.py` owns the promoted compound catalog; generated TypeScript artifacts
  are downstream products and must not be hand-edited.

The live public deployment currently composes the Morphe viewer with six kernel sources. All 22
declared panes responded with populated surfaces during this audit.

| Source | Live panes |
|---|---|
| Taxis | `orgs`, `employees`, `employee`, `roster`, `overview`, `reconciliation` |
| Misthos | `run-summary`, `period`, `payslip` |
| chreos | `obligations`, `horizon`, `overview` |
| Obolos | `treasury`, `finality`, `exceptions` |
| Apotheke | `orgs`, `stock`, `expiry`, `trace` |
| zygos | `books`, `overview`, `events` |

Representative drill-ins worked for Taxis employee detail, Misthos payslip, Apotheke lot trace, and
zygos account events. The zygos event stream still ends without a declared transaction pane, so the
operator cannot continue from an event to the transaction it names.

## Method

The audit combined two independent assessments:

- a design-director review of hierarchy, information architecture, emotional fit, task clarity,
  cognitive load, accessibility, and Nielsen's usability heuristics;
- a deterministic source scan plus live browser inspection at desktop and 390px widths, including
  computed foreground/background contrast on representative dialects.

The deterministic scanner reported three `broken-image` findings in comments inside
`src/lib/primitives/content/Media.svelte`; all three were false positives. It found no actionable
viewer-markup defect. The consequential failures were visible only through composed browser output,
confirming that geometry, contrast, hierarchy, and task usefulness need browser-level contracts.

## Design health

| # | Heuristic | Score | Principal failure |
|---:|---|---:|---|
| 1 | Visibility of system status | 2/4 | Status exists, but freshness and progress lack priority. |
| 2 | Match between system and real world | 1/4 | IDs, hashes, and compiler vocabulary leak into the product. |
| 3 | User control and freedom | 2/4 | Breadcrumbs help; useful operational controls are absent. |
| 4 | Consistency and standards | 2/4 | Components cohere, but dialect legibility and alert composition do not. |
| 5 | Error prevention | 2/4 | Read-only behavior is safe; interpretation errors remain easy. |
| 6 | Recognition rather than recall | 2/4 | Alerts often lose the row or subject they concern. |
| 7 | Flexibility and efficiency | 1/4 | No search, sort, filter, sticky headers, shortcuts, or batch paths. |
| 8 | Aesthetic and minimalist design | 1/4 | Giant titles, card walls, duplicated state, and raw metadata. |
| 9 | Error recognition and recovery | 1/4 | Codes appear without consequence, owner, or next action. |
| 10 | Help and documentation | 0/4 | `Time`, `Dialect`, and domain terms are unexplained. |
|  | **Total** | **14/40** | **Poor** |

Six of eight cognitive-load checks fail: single focus, chunking, visual hierarchy, minimal choices,
working-memory burden, and progressive disclosure. Grouping and one-thing-at-a-time behavior mostly
survive.

## Findings

### P0 — Semantic intent channels do not guarantee contrast for unfilled content

`Text.svelte` and `Number.svelte` use an intent's `on` channel when a semantic intent is present.
That channel is appropriate when the component also paints the corresponding intent `surface`; it
is not generally readable as freestanding ink on the page surface. `SLOTS.link.on` makes the inverse
mistake for explicit non-provenance links by using the intent's `surface` channel as text color.

Relevant code:

- `src/lib/primitives/content/Text.svelte:40-55`
- `src/lib/primitives/content/Number.svelte:24-30`
- `src/lib/tokens/slots.ts:76-92`
- `src/lib/primitives/action/Link.svelte:50-66`

Representative computed failures from visible live content:

| Surface | Element | Contrast |
|---|---|---:|
| Taxis / `clinical` | Employee links | 1.84:1 |
| Taxis / `clinical` | Blocking KPI value | 1.05:1 |
| Misthos / `estate` | Payslip link/header | 1.06:1 |
| zygos / `ledger` | Account links | 1.24:1 |

The collapsed Timaeus home itself passed the visible-text sample, with a minimum measured ratio of
4.66:1. Initial apparent failures there belonged to hidden disclosure descendants. The problem is
therefore localized channel misuse, not a universal indictment of dark dialects.

#### Required correction

Add contrast-guaranteed unfilled-ink channels, including the hover state, to the intent contract.
`surface + on` remains the pair for filled components such as badges, statuses, alerts, and solid
buttons. Freestanding `Text`, `Number`, and `Link` consume `ink`/`ink-hover` through component slots.
Regenerate every dialect and mask, and test the rendered result on base, raised, and sunken surfaces.

Token-key parity alone is insufficient. The release gate must compute contrast from actual browser
styles after `var()` and `color-mix()` resolution.

### P0 — Tabular Grid is not a complete table capability

`Grid.svelte` supports aligned visual columns through a shared template and subgrid, but the result
remains a `role="list"`-shaped node tree rather than a real data-table relationship. It lacks robust
column-header/cell associations and has no structural narrow-width presentation.

At 390px, the chreos obligations document avoided page-level horizontal overflow while its internal
headers, IDs, badges, dates, amounts, links, and states overlapped into unreadable content. This is
worse than an honest horizontal scroller because the page appears to fit while the information does
not.

#### Required correction

Introduce a genuine typed table capability in the Pydantic-owned grammar, or an equivalently
explicit semantic table mode. It must own:

- caption and accessible table name;
- column headers and cell/header relationships;
- row semantics;
- numeric alignment;
- a declared responsive policy: horizontal scroll, priority-column collapse, or labelled record
  rows at narrow widths;
- sticky headers where long operational tables require them;
- row-level status, action, and diagnostics regions.

This is a closed-capability expansion, not a promoted compound. A `DataTable` compound cannot safely
interpolate arbitrary header strings or own browser table semantics under the current factory
contract.

### P0 — Cell diagnostics obscure the data they explain

The compiler emits row diagnostics as full-width siblings, which matches the subgrid contract, but
cell diagnostics remain inside a `Stack` within the individual cell. `InlineAlert.svelte` then
enforces a 12rem readable minimum width. In narrow or densely columned rows, the alert paints over
neighboring values.

Relevant code:

- `py/morphe_surface/emit.py:476-504`
- `src/lib/surface-edge/emit.ts:608-629`
- `src/lib/primitives/feedback/InlineAlert.svelte:81-92`
- `src/lib/primitives/layout/Grid.svelte:105-116`

This was visible in chreos obligations and Apotheke stock, where the warning surface covered the
amount or stock values that made the warning meaningful.

#### Required correction

Lift cell diagnostics into a row-associated diagnostics lane immediately after the affected row.
Preserve the field label and subject in the diagnostic's visible copy so the association survives
the move. Once diagnostics span the row, remove the minimum-width workaround from table contexts.

### P1 — Organization identity outranks the operator's task

`name` or `title` root identity fields are automatically promoted to `display`/`critical`. The
result is an enormous serif `Krates ehf` heading on operational views where `Weekly roster`,
`Obligations`, or `Payroll run` should be the primary title. Tiny mono captions and large editorial
display type create a disjoint rather than useful hierarchy.

#### Required correction

- Make the operational task the H1.
- Demote organization or book identity to breadcrumb/context.
- Reserve `display` for the composed home and deliberately editorial surfaces.
- Use a fixed, restrained product type ramp for operational panes.
- Restore a logical heading outline; metric labels must not precede the pane's content heading in
  the accessibility tree.

### P1 — Surface models expose contract data instead of operational decisions

The live panes promote raw UUIDs, hashes, sequences, `include_pii`, `milestone_overdue`, scale,
`First use`, lock-boundary internals, and duplicate raw/display amounts. Diagnostics expose machine
codes without consistently naming the affected subject, consequence, owner, or next action.

This directly conflicts with `DESIGN.md` section 7: operational surfaces are purposeful projections,
not pretty-printed API responses.

#### Required correction

Every pane should answer, in order:

1. What am I looking at?
2. What requires attention?
3. What changed or matters now?
4. What can I inspect or do next?
5. Where is the audit proof?

Producer-owned Pydantic surface models should hide implementation fields before signing when the
operator does not need them. Necessary IDs, hashes, receipts, and seals belong in a quiet provenance
footer or disclosure, not the main scan path.

### P1 — Card walls replace prioritization

The composed home presents six equal raised panels with the same `Open full surface` disclosure.
Operational KPI bands repeatedly render `SignalCard`, which itself always creates a raised `Frame`.
Everything therefore receives similar visual mass regardless of urgency or task relevance.

#### Required correction

- Home leads with freshness and exceptions, then domain navigation.
- A pane leads with one outcome or attention summary, followed by one primary worklist.
- Metric bands become a single composed region with internal rhythm or separators rather than a row
  of individually raised cards.
- Version `SignalCard` so it does not force a raised frame. Callers that genuinely need a card can
  wrap it at the authored-tree level.

### P1 — Viewer chrome prioritizes substrate inspection over operator work

`ViewerChrome.svelte` permanently exposes `Dialect` and often an ambiguous `Time` selector. At
390px, the control row reached beyond the viewport, clipped the dialect control, and effectively
eliminated the breadcrumb context. Native date/select controls measured about 27px high, below the
44px touch-target floor.

Meanwhile, long tables offer no search, sort, filter, sticky header, or resolution path.

#### Required correction

- Separate operator mode from substrate-inspection mode.
- Hide dialect switching from the normal operational path or place it behind a clearly labelled
  inspection control.
- Rename temporal policy options in user language and explain their effect.
- Allow chrome to wrap or collapse at narrow widths without sacrificing the breadcrumb.
- Meet the 44px target floor.
- Add only task-relevant controls owned by the host boundary.

## Persona failures

### Operations lead

The operator can see that a violation exists but cannot reliably identify its subject, understand
its consequence, filter the worklist, or reach a resolution path. Equal-weight cards force manual
scanning instead of presenting an attention queue.

### Controller or auditor

Lineage exists, which is a real strength, but it is mixed into primary content. The auditor receives
raw hashes and identifiers without a clean relationship between decision, evidence, and receipt.
Progressive provenance would improve both routine scanning and deep audit work.

### Keyboard or low-vision user

Several dialect/content combinations fail text contrast; heading order is misleading; visual tables
do not expose sufficient table relationships; narrow table content collides; and important native
controls miss the touch-target floor.

## What is already working

- The viewer successfully renders six independently owned sources through one admission and render
  path.
- Breadcrumbs and native controls use genuine browser semantics.
- Numeric alignment is generally strong before diagnostics disrupt the grid.
- Status primitives normally pair text and shape with color.
- Failure posture is explicit and stale-beats-blank on the composed home.
- The substrate avoids glass, ornamental shadows, gradient text, and other generic landing-page
  decoration.

The desired product should preserve those strengths while replacing machine-shaped composition with
operator-shaped composition.

## Action plan

### Phase 0 — Make unreadable states unshippable

1. Add unfilled semantic ink channels and migrate `Text`, `Number`, and `Link`.
2. Build a browser contrast matrix across all nine dialects, base/raised/sunken surfaces, and
   default/hover/focus/disabled states.
3. Add representative composed fixtures from Taxis, Misthos, chreos, Apotheke, and zygos.
4. Gate WCAG AA from computed styles, not static token strings.
5. Lift cell diagnostics into full-width associated rows.
6. Add 390px, 200% zoom, keyboard-only, forced-colors, and reduced-motion browser checks.

### Phase 1 — Add the missing structural capability

7. Design and add the typed table capability through the Python grammar authority.
8. Generate TypeScript types, JSON schemas, dialect masks, and package artifacts.
9. Implement semantic desktop and narrow presentations.
10. Add sticky headers and host-owned filtering only where the surface purpose requires them.

### Phase 2 — Rebuild operational hierarchy

11. Make task title, scope/freshness, attention state, primary collection, and provenance the
    canonical pane reading order.
12. Demote organization identity and raw machinery.
13. Replace repeated raised KPI cards with a composed metric band.
14. Rewrite diagnostics as subject + consequence + next action; keep the machine code in technical
    detail.
15. Fix zygos transaction drill-through or deliberately remove the implied relation.
16. Recompose home around attention and freshness rather than six equal disclosures.

### Phase 3 — Art-direct the dialects

17. Give each dialect a real visual register while preserving the same semantic and accessibility
    contract.
18. Stop making every operational dialect a slightly different dark terminal.
19. Define product-appropriate typography per dialect or product host without changing authored
    business meaning.
20. Normalize casing, language, labels, empty states, and contextual help.

## Compound vocabulary expansion

Six promoted compounds currently ship:

- `SignalCard`
- `EntityHeader`
- `StatBand`
- `Breakdown`
- `TrailEntry`
- `KeyValuePanel`

The catalog is coherent but middle-heavy. Page, section, signal, provenance, row, and empty-state
structures remain hand-built by compiler emitters. The following candidates expand composition
without smuggling browser authority, host state, or consumer vocabulary into the package.

All variability below is carried by node parameters or slots. No proposal interpolates into
`Disclosure.summary`, `Badge.label`, `Status.signal.text`, `Field.a11y`, `Media.src`, `Icon.name`,
`Link`, or `Button` string fields.

### Promote now

#### `ContentSection`

- Params: optional `title: node`
- Slots: `signals`, `alerts`, `body`, `provenance`
- Owns: ordered `stack(section)` composition
- Replaces: hand-built `_section` ordering in both compilers

#### `SignalBand`

- Params: none
- Slots: `signals`, `context`, `alerts`
- Owns: compact signal cluster followed by associated diagnostics
- Solves: readiness/compliance/finality bands repeated across all kernels

#### `ProvenanceFooter`

- Params: optional `heading: node`
- Slots: `facts`, `seals`, `links`
- Owns: subdued provenance region without a `Frame` reset
- Solves: flat trailing IDs, hashes, timestamps, and receipts

#### `DefinitionRow`

- Params: required `label: node`, required `value: node`
- Slots: `detail`
- Owns: stable label/value relationship
- Solves: repeated hand-built definition grids and `KeyValuePanel` internals

#### `ProgressRow`

- Params: required `label: node`, `progress: node`, `value: node`
- Slots: `detail`
- Owns: labelled progress/value composition
- Solves: hand-built `Breakdown` rows

#### `Trail`

- Params: optional `title: node`
- Slots: `entries`, `empty`, `provenance`
- Owns: the collection shape around existing `TrailEntry` nodes
- Solves: the currently orphaned event-entry aggregate

### Promote next

#### `OperationalPane`

- Params: required `identity: node`
- Slots: `context`, `metrics`, `signals`, `content`, `provenance`
- Owns: the canonical five-band pane order
- Requires: an explicit root-only compiler strategy; never structural name inference

#### `RecordCard`

- Params: required `title: node`
- Slots: `signal`, `facts`, `relations`, `provenance`
- Owns: nested-record/card-stack fallback presentation
- Constraint: never use it as the default page information architecture

### Hold as later candidates

#### `DiagnosticGroup`

- Params: optional `title: node`
- Slots: `alerts`, `context`
- Owns: a grouped exception/worklist diagnostics region

#### `EmptyState`

- Params: required `message: node`
- Slots: `detail`, `navigation`
- Owns: caller-authored empty-state composition without compiler-generated product copy

### Repair the current catalog before expanding it

1. Omitted `SignalCard.measure` and `EntityHeader.keyFigure` must not assert a factual zero.
2. `SignalCard.body` must not fall back to visible `No body supplied` copy.
3. `TrailEntry` needs `signals` and `detail` slots; zygos explicitly rejects `trail` because valid
   event fields currently classify into no arm and disappear.
4. `SignalCard` should stop forcing a raised `Frame`; framing is composition, not signal identity.
5. Resolve policy drift: the live clinical catalog allows all six promoted compounds, while current
   doctrine still describes a SignalCard-only restriction.

### Explicit non-candidates

- `DataTable`: a genuine primitive/capability gap, not a compound.
- `DisclosureSection` or `DialogCard`: variable visible labels occupy raw string fields and cannot be
  lawfully parameterized by the factory.
- `KpiCard`, `MetricCard`, `HeaderCard`, `CardGrid`: redundant with the existing signal/header/band
  vocabulary.
- `ActivityEntry`: extend `TrailEntry` instead of adding a synonym.
- `StatusChip`, `Alert`, `Panel`: shallow aliases over existing primitives.
- `PayslipBreakdown`, `TreasuryExposure`, `ObligationCard`, `LotTrace`, `LedgerPosting`: consumer
  domain vocabulary.
- Breadcrumbs, back links, filters, pagination, and action bars: host chrome and live authority.

## Promotion discipline

A candidate enters the promoted catalog only when:

1. the same structural need appears in at least two independent consumers;
2. every variable element is a node parameter or slot;
3. the definition contains no host state, live authority, consumer vocabulary, or hidden geometry;
4. expansion survives the factory gate, depth limits, and dialect restrictions;
5. the same authored call remains legible under all shipped dialects;
6. Python and TypeScript compilation remain byte-identical where parity applies;
7. real-browser geometry, semantics, contrast, desktop, and narrow behavior are pinned.

This yields a larger vocabulary without turning the catalog into a component junk drawer.

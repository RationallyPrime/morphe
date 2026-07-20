# ADR-0020 — `Table`: Data Tables Are a Closed Capability, Not a Compound

- **Status:** Accepted — founder gate waived 2026-07-20
- **Date:** 2026-07-20
- **Driver:** KRA-788 Deliverable 2; audit P0 "Tabular Grid is not a complete table capability"
  (`docs/design/timaeus-viewer-ui-audit.md`)

## Context

`Grid.svelte`'s tabular mode aligns columns beautifully — shared tracks, subgrid rows, ledger
rules — but the result is geometry wearing a `role="list"` tree. It has no caption, no
column-header/cell associations, no row semantics, and **no structural narrow-width presentation**:
at 390px the chreos obligations pane *appeared* to fit while headers, IDs, badges, dates, and
amounts overlapped into unreadable content. A page that looks fine while the information is not is
worse than an honest horizontal scroller.

This cannot be a compound. The factory contract substitutes node params and fills slots; it never
interpolates a node's string fields — so a `DataTable` compound could not carry per-column header
strings — and no composition of existing primitives can produce genuine `<table>`/`<th scope>`
semantics. Browser table capability is exactly the class of thing the grammar ships as a **kind**
(the same argument that made Button/Link/Dialog kinds): the platform semantics ARE the feature.

## Decision

### 1. The grammar gains one structural kind

```
TableColumn { header: string; numeric?: boolean; priority?: "primary"|"secondary"|"detail"; intent?: IntentRef }
TableCell   { children: readonly Node[] }
TableRow    { cells: readonly TableCell[]; diagnostics?: readonly Node[] }
Table {
  kind: "table";
  caption:        string;                              // REQUIRED accessible name (visible pattern)
  captionHidden?: boolean;                             // name without repeating an adjacent heading
  columns:        readonly TableColumn[];              // ≥ 1
  rows:           readonly TableRow[];
  rowHeader?:     boolean;                             // first column cells are <th scope="row">
  responsive?:    "scroll" | "collapse" | "records";   // declared policy; default "scroll"
  sticky?:        boolean;                             // sticky header inside the scroll container
  emphasis?:      EmphasisClaim;
}
```

A validator (Pydantic authority; mirrored structurally in the generated schema where expressible)
enforces that every row carries exactly `len(columns)` cells — a ragged table is unrepresentable.
`caption` and every `header` require at least one perceivable code point (`VISIBLE_LABEL_PATTERN`),
so an unnamable table or a blank column head cannot be authored.

### 2. What the capability owns (the audit's checklist, answered structurally)

- **Caption / accessible name.** `caption` renders as a real `<caption>`; `captionHidden` keeps it
  in the accessibility tree while visually deferring to an adjacent authored heading. There is no
  unnamed table.
- **Header/cell relationships.** Column heads are `<th scope="col">`; with `rowHeader`, each row's
  first cell is `<th scope="row">`. Assistive tech announces coordinates natively — no ARIA
  simulation over divs.
- **Row semantics.** A row is a `<tr>` — one record, one element, selectable and navigable as such.
- **Numeric alignment.** `TableColumn.numeric` right-aligns the column (head and cells) and sets
  the tabular-figure register, completing the half of ledger alignment `Text.numeric` started.
- **A declared responsive policy.** `responsive` is authored intent, never inference:
  - `"scroll"` (default) — the table keeps its geometry inside an `overflow-x` container with
    focus-reachable scrolling: honest overflow instead of silent collision.
  - `"collapse"` — container queries progressively hide `priority: "detail"` then `"secondary"`
    columns as the container narrows; `"primary"` columns never disappear. Priority is declared
    per column by the author who knows the data.
  - `"records"` — at narrow widths each row becomes a labelled record: cells stack block-wise,
    each labelled by its column header (stamped as data, so the pairing is structural, not
    positional guesswork). The 390px overlap class becomes unrepresentable.
- **Sticky headers.** `sticky` pins the header row inside the scroll container for long
  operational tables — declared where warranted, not ambient.
- **Row-level status / action / diagnostics regions.**
  - *Status and actions* are ordinary authored columns — a `status`/`badge`/`button` node in a
    cell under a labelled header. The capability adds no parallel channel that would need
    package-owned copy; the column header names the region, and every responsive mode carries it.
  - *Diagnostics* get the dedicated structural lane the audit demanded: `TableRow.diagnostics`
    renders as a full-width row (`<td colspan>`) immediately after its row, so an alert explains
    its subject without painting over neighboring cells. Inside the lane the alert's readable
    minimum width is free to apply; inside a cell it never belonged.

### 3. Placement in the algebra

`Table` is structural but is **not a generic container**: it carries no `ContainerRole` and is not
a `Frame`-style context reset. It enters the context algebra as a list-shaped boundary (the same
descent Grid's tabular mode uses), and each cell's children render with that child context.
`emphasis` on the table is a claim its parent renormalizes, exactly like Stack/Grid/Cluster.

Compound templates may contain tables: the factory's expansion, the dialect compound walk, and the
artifact structural walk all recurse into `rows[].cells[].children` and `rows[].diagnostics`, so
ParamRef/Slot leaves inside cells resolve under the ordinary hygiene rules.

### 4. Grid's tabular mode is not retired

`Grid.columns` subgrid remains the right tool for *layout* alignment (definition grids,
label/value pairs, non-record compositions). What changes is doctrine: **data records with column
relationships belong to `table`**. The edge compilers' `table` strategy cuts over from
Grid-emission to `Table`-emission as the follow-up stage of this ADR — deterministically, in both
compilers in one change, together with the conformance-fixture regeneration and the migration of
the real-browser edge contract (whose current assertions pin the subgrid geometry). That cutover is
sequenced behind the KRA-796 Phase-0 renderer work now in flight on those same emit paths; the
lowering contract it must satisfy is fixed here: one testimony row → one `TableRow`; column heads
→ `TableColumn.header` (numeric columns marked); cell diagnostics lift into the row's
`diagnostics` lane with their subject preserved; empty cells are genuinely empty `<td>`s (the
Spacer placeholder hack retires with the subgrid).

### 5. Dialect and token treatment

The table is chrome-light: header register rides the caption/label type ramp, rules reuse the
ledger hairline (`--mo-intent-outline`), and cell content is ordinary node content under each
dialect's existing contract. Numeric cells inherit the tabular-figure register. Sticky headers
paint the base surface (never a raised card) so pinning adds no visual mass. No dialect may
restrict the kind — capabilities are closed vocabulary, uniformly available; dialects restrict
compounds only.

## Consequences

- The 390px failure class — apparent fit with unreadable collision — becomes structurally
  unrepresentable under every declared responsive policy.
- Keyboard and screen-reader users get genuine table navigation (row/column announcement,
  header context) on all nine dialects for free, from the platform.
- Grid sheds the pressure to become a table; each primitive keeps one job.
- The grammar version moves to 0.3.0 (shared with ADR-0019; one additive release, one kernel
  re-pin).
- The compiler cutover (§4) retires the audit's P0-2 and P0-3 for every kernel at once when it
  lands, with no kernel-side changes — testimony shape is unchanged.

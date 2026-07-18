# Krepis surface style guide

How a kernel authors a Morphe surface that reads as one product across the family.
Written against `morphe-grammar` **py-v0.6.1** (grammar 0.2.0, compiler 0.3.1 — the
floor for link-intent fidelity and producer-labelled absent relations). The
authority order: the grammar (`py/morphe_grammar/models.py`) > this guide > per-kernel
taste. If the guide fights the grammar, the grammar wins and the guide has a bug.

## The one rule

A surface is a **Pydantic view model + `x-morphe` hints**, compiled by
`morphe_surface.surface_from_model`. Kernels never hand-assemble grammar `Node` dicts
and never import Svelte-side anything. If a pane needs a shape the hint vocabulary
cannot select, the fix is a compiler strategy (in this repo, behind `resolve_strategy`),
not a bespoke tree in one kernel.

Import the authoring helpers from the library — do not re-declare them per repo:

```python
from morphe_surface import KpiCell, morphe_hint, surface_from_model
```

`morphe_hint(...)` is strict (raises on a typo'd strategy/intent at authoring time);
the consuming parser stays total (a malformed block degrades to the floor). Delete the
kernel-local `_morphe_hint` / `_hint` copies when adopting py-v0.6.0.

## The pane template

Every org-scoped pane composes the same five bands, in order. Omit a band when the
domain genuinely has nothing for it — never reorder.

1. **Identity line.** The org/book display name as the root's identity field (a
   top-level `name`/`title` scalar — the compiler promotes it to display/critical
   automatically). Roots set `morphe_hint(heading=False)` so route chrome owns the page
   title; the identity field IS the in-tree title.
2. **KPI band.** One `list[KpiCell]` field, `morphe_hint(strategy="kpi-row",
   heading=False)`, 3–5 cells. Kickers are short register words ("Treasury",
   "Week 30", "Run"), labels name the measure, values are raw numbers (see Money).
   The FIRST cell is the pane's headline number.
3. **Signal band.** The pane's states as `status`/`badge` fields with per-value
   `intents=` maps (see Tone maps): period lock, seal state, compliance, finality.
   Domain drama (a live violation, a returned payment, an expiring lot) rides
   path-keyed `Diagnostic`s passed to `compile_surface`/`surface_from_model` — they
   render as inline alerts exactly where they belong. Severity `warning` for
   founder-visible drama, `info` for narrative notes.
4. **Primary collection.** The main ruled table (first list field on the root — the
   compiler promotes it to `strong`). Column order: identity → status → quantities →
   provenance. Status columns carry tone maps; money columns are `number` fields;
   foreign keys are pre-resolved `SurfaceRef {label, href}` with
   `strategy="linked-ref"` — never a raw UUID column (zygos's `_account_href` pattern).
5. **Provenance footer.** Ids, hashes, timestamps as a trailing section:
   `role="provenance"` on ids/timestamps, `role="seal"` on content hashes
   (`result_hash`, `payload_hash`) — the seal register intent is exactly for this.
   Wire-only fields the pane shouldn't paint keep `hidden=True`, they never get
   deleted from the wire model.

Detail records nest as objects (the compiler collapses them behind a native
disclosure); default-open only when the pane exists to show that detail
(`collapse=False` opens it).

## Money

- Plain ISK (scale 0) and any clean numeric: a **`number` field** —
  `morphe_hint(strategy="number", format="currency", currency="ISK")`. The renderer
  does locale-correct Intl formatting with tabular figures; do NOT pre-format into
  strings.
- Scaled minor units (zygos commodities with scale > 0): keep the canonical string
  (`role="evidence"`) plus the display-formatted sibling (`format_display_quantity`
  pattern) — string math stays exact; don't round through float.
- Percentages are **0..1 fractions** (`format="percent"` multiplies by 100).
- Counts that headline a KPI cell may use `format="compact"` (1.2K) only when the
  precise figure appears elsewhere on the pane.
- `polarity` is inferred for scalar numerics automatically; signed deltas as text get
  it for free. A `number` node signs itself.

## Tone maps (canonical)

One vocabulary family-wide; per-value `intents=` maps on `status`/`badge` fields:

| Domain state | intent |
|---|---|
| settled, active, sealed, resolved, clean, available, executed, run_committed | `success` |
| pending, proposed, expiring, in_flight, signature_routing, open (violations) | `caution` |
| breached, returned, failed, expired, rest-debt, violations | `caution` — AND a path-keyed warning Diagnostic so it also alerts |
| held, quarantined, locked, dispositioned, informational states | `info` |
| draft, closed, terminated, withdrawn, neutral lifecycle | `neutral` |

There is deliberately no "error" tone — `caution` + an inline alert IS the escalation.
Never encode state in label text alone ("BREACHED!"); the map carries the color, the
alert carries the drama.

## Intent taxonomy (field-level `role=`)

Copy zygos's discipline verbatim:

- `provenance` — ids, timestamps, hashes-as-context, cursors
- `accession` — names, labels, "what is this" identity fields
- `evidence` — canonical quantities/amounts (the auditable values)
- `info` — kind/category tags
- `seal` — content hashes that certify (result_hash) — footer only
- `folio` — KPI kickers get this automatically from the compiler
- `marginalia` — asides/redaction notes (e.g. "PII redacted — governed read")
- `primary-action` — at most ONE per pane, on the pane's single drill-in link

## Progress (use sparingly, honestly)

`strategy="progress"` for genuine 0..1 fractions ONLY: window coverage, run
completeness, stock reservation share, period elapsed. The label must name the
fraction ("Matched hours", "Window settled"). Never use progress as a decorative
meter for an unbounded quantity.

## Dialect map (set in the viewer's source config, not in the kernel)

Same tree, different room — structure above is identical everywhere; the dialect is
the register:

| Surface owner | dialect |
|---|---|
| viewer index | `timaeus` |
| Taxis (workforce ops/compliance) | `clinical` |
| Misthos (payroll operations) | `estate` |
| chreos (commitments/legal) | `reykjavik-registry` |
| Obolos (treasury) | `ledger` |
| zygos (books) | `ledger` |
| Apotheke (goods/QC) | `foundry` |

Obolos and zygos share `ledger` deliberately — they are the money pair. The `?dialect=`
override is the live re-theme proof; nothing in a kernel may depend on its dialect.

## The don'ts

- No `field`/`select`/`toggle`/`range`/`button` — the schema compiler is read-only by
  construction and will not emit them (D4). Actions are a v2 concern (Organon executes).
- No geometry, no hex, no px — if you reach for one, you wanted an intent or emphasis.
- No `emphasis="critical"` claims from kernels — identity promotion already spends the
  one critical the budget allows. `strong` is the ceiling for authored claims.
- No dead vocabulary: don't set hints that render nothing (a `tones` map on a plain
  text field, `currency` without `format="currency"`).
- No raw foreign keys in tables; no `href="#"`; an absent relation renders as an
  unlinked em-dash label (`SurfaceRef(label="—")`).
- No pre-formatted number strings where a `number` field fits.
- Grammar-version boot assertion stays (`EXPECTED_GRAMMAR_VERSION` pattern), sourced
  from `morphe_surface.GRAMMAR_VERSION`.

## Interaction & navigation

A surface is read-only (D4) — "interaction" here is **navigation**, not action. The
family reads as one product only if a user can move through it the same way everywhere:
every reference goes somewhere, every pane knows where it sits, and nothing that looks
clickable is a dead end. The ownership split below is load-bearing — a gap on the wrong
side of it is unfixable from the other.

### The navigation contract

- **A reference to another entity is a `linked-ref`, never inert text.** A foreign key,
  a counterparty, a parent account — anything that has a detail surface — is a
  pre-resolved `SurfaceRef {label, href}` lowered with `strategy="linked-ref"`. Structural
  inference would otherwise render an object as a nested record-card and a scalar as plain
  text; the hint is what makes it navigable.
- **An absent target is an em-dash, never a dead or self link.** When no surface can
  receive the reference, emit `SurfaceRef(label="—")` (href-less → plain text) — do **not**
  point the href back at the current pane to "have a link". A link that navigates to the
  page you are on is worse than honest text: it looks actionable and does nothing.
- **No raw id or slug where a display label exists.** An id that has a name beside it is
  `hidden=True` (kept on the wire, out of the tree) or lives in the provenance footer with
  `role="provenance"`. A bare UUID in a table cell or, worse, inside summary prose, is the
  one thing the intent taxonomy exists to prevent. An id with genuinely no friendlier form
  is footer provenance at most — never a column a user scans.
- **At most one `primary-action` per pane** (already the intent-taxonomy rule) — the pane's
  single drill-in. Navigation has one obvious next step, not a field of equal buttons.
- **A filtering reference carries its filter in the query** (`…?party_id=…`). The producer
  builds the href against its own origin with the filter attached; the viewer preserves
  the query across the rewrite and forwards it onto the fetch. A kernel that emits a filter
  query it cannot honor is authoring a lie — emit the plain reference instead.

### Who owns what (do not cross this line)

- **The viewer owns the trail.** Breadcrumb, back-to-collection, and the "one of N"
  context are host chrome, built from the source config's declared `collectionRoot` (the
  surface id of a source's collection pane) — never inferred, never assembled in a kernel.
  A kernel that hand-rolls a "back" link or a breadcrumb is reaching across the boundary;
  the fix is a viewer/source-config change, not a per-kernel tree. `collectionRoot` is
  optional: undeclared keeps the flat index as the only way back.
- **The viewer owns cross-origin rewriting.** A kernel compiles hrefs against *its own*
  origin; the viewer resolves them against declared surface paths (match by path, query
  carried forward) and **degrades any href it cannot resolve to plain text**. So a kernel
  may reference a target the viewer has not declared — it simply renders as a label, never
  a broken in-viewer link. The kernel never needs to know the viewer's routes.
- **The kernel owns per-row references and their labels.** Which fields are `linked-ref`,
  what the label says (under its own PII governance), and what origin-relative href it
  points at. If a reference has no navigable target *in the domain* (no per-entity surface
  exists), that is **missing surface data** — a new pane to author, not a chrome tweak and
  not something to paper over with a self-link.

### The three failure classes (name them when auditing)

A navigation gap is exactly one of these, and the class names the fix locus:

1. **General-Morphe / viewer mechanism** — the trail, the rewrite, query preservation.
   One fix, every pane benefits. Lives in the viewer/grammar, never in a kernel.
2. **Kernel annotation** — the mechanism exists; the kernel does not emit the hint, the
   `hidden=True`, or the parent reference. A one-field change in the surface model.
3. **Missing surface data** — the target pane, the history endpoint, the filtered view
   does not exist. Real domain work; the honest answer is a new surface, never a dead link
   standing in for one.

## Per-kernel pane specs (the KRA-752 demo scope)

Shared: every org pane leads with the org name identity line + KPI band + signal band.
"Add" means a new declared pane in the viewer source config.

**Taxis** — `orgs`: keep table, add per-org confirmed-hours + violation columns.
`overview`: KPI band (headcount, confirmed shifts, confirmed hours, open violations,
absence days); signal band (period lock, compliance w/ tone map); rest-debt warning
Diagnostic when live. `roster`: worker rows w/ role badges, hours as numbers,
night-shift flagged via badge tone map; violation rows alert in place. `reconciliation`:
matched-fraction progress bar, variance columns as signed numbers, per-worker status
tone map.

**Misthos** — `run-summary`: KPI band (gross, net, employer cost, headcount); seal
state + compliance signal band; per-worker table w/ net `number` column + status; earn/
deduct/employer breakdown as collapsed sections; `result_hash` in footer as `seal`.
`period`: seal-state progression (status w/ tone map), inputs coverage progress,
filings table. ADD `payslip` (Auður): earning/deduction sides w/ signed numbers,
garnishment/pension/union lines visible.

**chreos** — `obligations`: standing tone map over the kernel's OWN Standing type
(active=success, expiring/breached=caution + Diagnostic on breached,
pending_signature=caution, draft/terminated/withdrawn/expired/closed=neutral —
"expired" ran its course; the bad ending is "breached"); counterparty as linked-ref
where PII allows, else "PII redacted" marginalia note. `horizon`: days-to-due as
signed numbers (negative = overdue), urgency tone map, next-duty identity.
`overview`: KPI band (total, active, expiring, breached, open adjudications) —
"expiring" is the CLASSIFIER's count under the org's bound expiry_horizon rules,
never a pane-invented window; a pane must not disagree with the kernel about the
kernel's own word.

**Obolos** — `treasury`: KPI band (net position, in-flight total, settled count,
exceptions count); two ruled tables (exposure, buckets) w/ ISK number columns.
`finality`: window-settled progress bar, per-instruction status tone map
(settled=success, in_flight/pending=caution, returned=caution+Diagnostic), rail as
accession. `exceptions`: alert band (each exception a warning Diagnostic), drill-in
linked-ref stays `primary-action`.

**Apotheke** — `orgs`: keep + item/lot counts. `stock`: KPI band (SKUs, on-hand value
ISK, reserved share progress, lots expiring ≤7d); state tone map (available=success,
expiring=caution, expired=caution+Diagnostic, held=info). `expiry`: days_remaining as
signed numbers, horizon tone map, soonest-expiry KPI. ADD `trace` (the quarantined
lot): lifecycle table (received→reserved→issued→held) w/ status tone map + hold
Diagnostic.

**zygos** — `books`: SignalCard-shaped KPI cells per book (accounts, commodities, last
posted) + open link (`primary-action`). `overview`: KPI band (cash, receivables,
revenue, net movement — display-quantity strings as textual KpiCell values where scaled);
accounts table w/ balance numbers; keep the collapsed book record + `heading=False`
discipline. ADD `events` (the audit stream): kind badges w/ tone map, sequence as
provenance, tx links degrade gracefully outside the kernel origin.

## Testing the upgrade (per kernel)

Keep the kernel's existing surface tests green; add per-pane assertions that (a) the
compiled tree contains the expected 0.3.0 kinds (`number`/`status`/`progress`/
`compound` where specced), (b) every status field's tone map covers the enum it
annotates (exhaustiveness test over the Literal), (c) `validate_node` passes (it runs
inside `compile_surface` — assert the call doesn't raise with REAL projector output,
not synthetic fixtures), (d) the org id never renders as a bare table cell.

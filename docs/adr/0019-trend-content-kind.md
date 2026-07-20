# ADR-0019 — `Trend`: A Series Is a Content Kind

- **Status:** Accepted — founder gate waived 2026-07-20
- **Date:** 2026-07-20
- **Driver:** KRA-788 Deliverable 1; motivated by the Breakdown can't-express record (`9705ae8`)
  and the 2026-07-20 viewer product audit (`docs/design/timaeus-viewer-ui-audit.md`)

## Context

No primitive draws a *series*. `progress` + `number` cover bounded quantity — the promoted
`Breakdown` compound composes them into proportion rows — but a value *over time* has no honest
representation. Kernels that hold period-resolved projections (payroll runs per month, obligations
per week, stock movement per day) can only render the latest point and discard the shape, or fake a
series with a wall of numbers. The audit's operator persona needs exactly this: "what changed or
matters now" is a question about a trajectory, not a scalar.

A series is **content**, not layout: like `text` and `number` it presents one datum (a sampled
quantity) and owns no children, no roles, and no context descent. It is also not a compound —
its variability is a typed value vector, not node params or slots, and its rendering (an SVG path)
is genuine platform capability the factory cannot compose out of existing primitives.

## Decision

### 1. The grammar gains one Content kind

```
TrendPoint { period: string; value: number }
Trend {
  kind: "trend";
  points:    readonly TrendPoint[];       // the typed series, in period order
  summary:   string;                      // REQUIRED — visible text, ≥1 perceivable code point
  baseline?: "zero" | "min";              // geometric honesty; default "zero"
  intent?:   IntentRef;
  emphasis?: EmphasisClaim;
}
```

Authored in `py/morphe_grammar/models.py` (the single grammar authority); `src/lib/grammar/types.ts`,
the JSON Schemas, and every dialect decoder mask are regenerated artifacts. `summary` reuses the
`VISIBLE_LABEL_PATTERN` contract that already guards `Within.summary` — an unlabelled series is
unrepresentable, in all three validation engines identically.

### 2. Data-source contract (ratified 2026-07-20 — settled, recorded here, not reopened)

- **The series is the kernel's projection table queried with a period axis.** The kernel filters
  its existing fold by the `as_of` parameter's window and groups by period. No new storage, no new
  artifact kind — a series is one more shape the projection already answers with.
- **The `as_of` family convention is the single temporal parameterization** for both point-in-time
  panes (KRA-779 navigation) and series windows. One convention, two consumers.
- **Testimony carries the typed result** — `[(period, value), …]` as typed values, never
  pre-rendered strings. On the wire this is a JSON array of `{"period": string, "value": number}`
  objects: self-describing, schema-typed, and order-preserving under RFC 8785.
- **Bucketing granularity (day/week/month) is query parameterization, kernel-owned.** The grammar
  never encodes granularity; `period` labels are opaque kernel-authored strings. A consumer that
  wants weekly buckets asks the projection for weekly buckets — Morphe renders what it is told.
- **The edge compiler derives nothing.** Lowering a series testimony to a `Trend` node is a
  deterministic per-testimony mapping — no aggregation, no interpolation, no windowing in Morphe —
  preserving byte-identical py/TS compiler parity and the Morphe-never-written-against-kernels
  boundary.

### 3. Accessibility: the paired text summary is the primary channel

`summary` is required and **always rendered as visible text** at caption register beside the
figure. The SVG figure itself is `aria-hidden` — the shape is an enhancement over the words, never
the only signal (the same law `Status` obeys with its text+shape pair, PRODUCT.md AA floor).
The kernel authors the summary as part of the typed testimony; the compiler never composes prose.

An empty or single-point series stays total: the summary renders alone (zero points) or with a
single terminal dot (one point). No copy is invented for the degenerate cases.

### 4. Geometric honesty: `baseline`

`baseline: "zero"` (the default) anchors the y-axis at zero, so the drawn amplitude is proportional
truth — the right default for operational quantities, per the anti-reference on ornamental charts.
`baseline: "min"` is the explicit opt-in variation lens (a Tufte sparkline) for dense series whose
absolute magnitude is carried elsewhere. The choice is authored, never inferred.

### 5. Dialect and token treatment

The stroke is **unfilled ink on the page surface**, exactly the class of content the audit's P0
found broken under the `on`-channel convention. `Trend` therefore consumes the ink channel the
Phase-0 token work (KRA-796) introduces — `--mo-intent-<intent>-ink` — falling back to the
guaranteed on-surface ink (`--mo-intent-on-surface`) where a dialect predates the channel. It never
reads an intent's `surface` or `on` channel as freestanding stroke color. The terminal dot marks
the latest value with the same ink; emphasis modulates stroke weight (a non-color channel), muted
tones through the muted ink. No fills, no gradients, no ambient decoration.

### 6. Reachability staging

This ADR lands the capability through the grammar authority with regenerated artifacts and the
renderer (`primitives/content/Trend.svelte`). The edge-compiler `trend` strategy — the
`x-morphe` hint plus the deterministic testimony→`Trend` lowering in both compilers — ships with
the KRA-779 period-axis work that gives kernels the `as_of`-windowed projection query to answer
with; its contract is fully fixed by §2 above, so that change is mechanical and fork-free.

## Consequences

- Bounded quantity (`progress`), scalar quantity (`number`), and sampled quantity over a period
  axis (`trend`) now partition quantitative content — each honest, none overlapping.
- The series is typed end to end: kernel fold → signed testimony → grammar node → SVG geometry.
  No pre-rendered images, no derived aggregates, no compiler-authored prose.
- Screen-reader and low-vision users get the authored summary as first-class content on every
  dialect, not an `alt` afterthought.
- The grammar version moves to 0.3.0 (additive kind; decoder masks change shape).

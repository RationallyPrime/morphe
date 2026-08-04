# ADR-0023 — Mint the Neutral Promoted Compound Set

- **Status:** Accepted
- **Date:** 2026-08-04
- **Driver:** A reusable structural vocabulary for operational and control-plane surfaces

## Context

ADR-0022 established `ActionSummary@1.0.0` as the singular compound gold standard. The next
question is not whether Morphe should acquire product-specific cards for Recipes, Laws, kernels,
models, or telemetry. Those names carry governance and data authority that belong to the host and
the owning Sokrates services. The useful substrate vocabulary is the smaller set of structures that
repeat across those domains without changing their meaning.

The eight older promoted definitions also predate the complete ADR-0022 evidence matrix. Their
factory admission and strategy tests are strong, but promotion alone does not prove a complete call,
strict CMS ingress, all-dialect acceptance, SSR, or one maintained comparison ledger.

## Decision

### New definitions

Nine `1.0.0` definitions join the promoted package catalog:

| Compound | Node-valued parameters | Caller-owned slots | Structural responsibility |
|---|---|---|---|
| `ContentSection` | required `heading`; optional `summary` | `meta`, `body`, `actions`, `detail` | stable section reading order |
| `SignalBand` | required `heading`; optional `summary` | `meta`, `signals`, `detail` | labelled wrap-capable signal collection |
| `DefinitionRow` | required `term`, `value` | `signal`, `detail`, `actions` | one term/value relationship |
| `ProgressRow` | required `label`, `progress`; optional `value` | `signal`, `detail` | labelled measure plus exact value/context |
| `Trail` | required `heading`; optional `summary` | `meta`, `items`, `actions`, `provenance` | ordered evidence collection |
| `OperationalPane` | required `title`; optional `eyebrow`, `summary` | `signal`, `controls`, `body`, `detail`, `provenance` | route-owned pane reading order |
| `RecordCard` | required `title`; optional `eyebrow`, `summary` | `signal`, `facts`, `actions`, `provenance` | neutral persistent-record summary |
| `DiagnosticGroup` | required `heading`; optional `summary` | `signal`, `diagnostics`, `actions`, `detail` | scoped diagnostic collection |
| `EmptyState` | required `title`, `summary` | `symbol`, `actions`, `detail` | explicit absence and next-step orientation |

Every variable phrase is a node parameter or slot fill. The templates contain no buttons, links,
inputs, overlays, `Vary`, `Within`, action ids, bind paths, raw URLs, domain nouns, or `Frame`.
Callers may put action and navigation nodes in declared slots, but authority remains at the host.

### Explicit non-compounds

Search, filters, pagination, breadcrumbs, action bars, virtualized grids, authentication, routing,
permissions, live queries, and proposal/ratification workflows remain native host capabilities.
`RecipeCard`, `LawCard`, `KernelCard`, and `ModelCard` are rejected names: consumers compose the
neutral `RecordCard` while canonical services retain identity, provenance, and mutation policy.

### Existing promoted definitions

The eight older definitions retain their current versions and expansion contracts. The audit found
no unrepresented string variability, host authority, or accidental domain policy:

- `SignalCard`, `StatBand`, `Breakdown`, `TrailEntry`, and `KeyValuePanel` own only their named
  reading order or collection geometry.
- `ProvenanceFooter` keeps one fixed `Disclosure.summary` because the factory cannot interpolate a
  raw-string field; all variable proof remains in node slots.
- `EntityHeader` keeps its intentional `Frame` because its contract is the context-resetting lede
  of a detail pane. This is not copied into the new pane/card definitions and is covered as an
  explicit historical exception.
- `ActionSummary` remains the only gold-marked definition.

Their missing evidence is repaired through the shared fixture ledger rather than semantic-version
churn.

### Evidence and admission

1. `/substrate` gains a separate Compound Mint exhibit for all sixteen non-gold promoted
   definitions. Each fixture supplies every declared argument and every slot with non-empty authored
   nodes; nested fixtures prove recursive expansion.
2. Tests combine those fixtures with `presentActionSummaryGold()` and require exact parity with the
   seventeen-entry promoted catalog. Expansion must leave no `slot` or `param-ref` leaf.
3. Every complete reference must pass the strict package compound validator, Clinical CMS compile
   gate, all nine dialect gates, and SSR under every dialect.
4. Browser evidence covers the complete mint at desktop and 390px in Chromium and Firefox, dialect
   switching, host-owned action receipts, keyboard reachability, and horizontal reflow.
5. Clinical's promoted-only allowlist derives directly from `PROMOTED_COMPOUNDS`; minting can no
   longer create a hand-maintained partial admission list.
6. Python remains the catalog authority. TypeScript definitions, dialect constraints, JSON Schema,
   package masks, and manifests are regenerated artifacts.

## Consequences

- Consumers can compose the planned control-plane surfaces without introducing product-specific
  substrate vocabulary.
- A promoted compound is not declared gold merely because it passes the shared ledger. Gold remains
  the one maximally wired comparison fixture and can move only through a replacement ADR.
- Future catalog additions must add a complete fixture in both language lanes and pass the CMS,
  dialect, SSR, and relevant browser evidence in the same change.
- Host capabilities remain obvious because no compound definition can make an action executable,
  perform a query, ratify a Law, edit a Recipe, or mutate a governed record.

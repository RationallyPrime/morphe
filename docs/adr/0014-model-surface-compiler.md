# ADR-0014 — Model Surface Compiler (`morphe_surface`)

- **Status:** Accepted
- **Date:** 2026-06-25
- **Related:** ADR-0007 (packaged library boundary), ADR-0009 (keep morphe-cms behind a service seam)

The Morphe design-notes arc (*Missing Scaffold* / *Morphe Design Notes* / *Agent
Affordance Substrate*) reframes Morphe as the adaptive **surface projection** of an
agent-native operational substrate: UI/API/tools/audit are projections of one typed
operational model, with ingestion (Hyle) and action-projection (Organon) already built
upstream. The keystone net-new Morphe primitive is a generic compiler that renders
arbitrary typed models into `Node` trees without bespoke UI per domain object.

What already exists: `morphe_grammar` (the Pydantic `Node` mirror + JSON Schema +
TS codegen) and `morphe_cms` (editorial drafts → **bespoke** per-artifact presenter →
`CompiledTree` → `Publication`, behind the `validate_node` gate and an MCP surface). What
is missing: any generic `model → Node` compilation, the `x-morphe` hint convention, and
an action-declaration layer. v1 is **read-only** (render typed records and operation
results; no mutation).

## Decision

Build `morphe_surface`, a read-only Pydantic Model Surface Compiler, as an **operational
pipeline parallel to** the editorial `morphe_cms`. Both emit the same `Node` union and
pass the same `validate_node` gate; that gate is the shared spine. The compiler is a pure
deterministic function over typed schema + data.

| # | Decision | Rationale (short) |
|---|----------|-------------------|
| D1 | **Input = JSON Schema** (+ optional data instance, + `x-morphe` hints). Pydantic is one adapter → `(model_json_schema(), model_dump())`. | The mission (render BD's OpenAPI without glue) forces schema-in; not Python-coupled. Repo already treats JSON Schema as first-class. |
| D1′ | Hints are **first-class/by-design** (BD + WFM specs are controlled). Hint-free rendering is the **floor** (third-party specs); rich hints are the **target** (flagship). Bare schema must still render acceptably. | Controlling the specs means co-authoring the UI via `x-morphe`; the spec pressure-test and the hint vocabulary are one artifact viewed twice. |
| D2 | **Two-stage:** `schema → SurfaceSpec (typed, recursive) → Node`. All heuristics in stage 1; emission mechanical. | Open/closed + testability: snapshot the resolved `SurfaceSpec` without pinning Node output. Re-applies the substrate's "what vs how" layering. |
| D3 | **Closed strategy enum** (`record-card`, `table`, `card-stack`, `timeline`, `key-value`, `collapsed-section`, `diagnostic-list`, `badge`, `linked-ref`…) via a single `resolve_strategy(schema_shape, x-morphe)` chokepoint. Whole-type bespoke Node presenters deferred. | A bounded, enumerable strategy space is itself the inspectability feature. The chokepoint keeps a future registry non-breaking. Hints select among the closed set, never below it. |
| D4 | **Pure static `(schema, data) → Node`.** Values baked as literals. Embedded/bounded collections render supplied rows; **queried/paginated collections deferred**; `bind` is the v2 interactive seam. | Read-only ⇒ no two-way binding. "Render the rows you're given" stays inside Morphe; pagination/query is an API/Organon contract Morphe must not own. |
| D5 | **Emit adaptation sockets** — `Within(dimension="collapse")` for nested sections (carrying a sane default), context-free. `Within(density/emphasis)` + `Vary` are the next increments. | Morphe is an *adaptive* substrate; a flat generator is off-thesis and forks the adaptation logic. The grammar already ships these sockets. Compiler decides "adaptable + default"; runtime context drives. |
| D6 | **Diagnostics + provenance via path-keyed sidecars + an envelope adapter** (`{data, meta, links, diagnostics}` → sidecars). Diagnostics fully in v1; provenance restrained. | Makes the compiler render an *operation result*, not just a shape. Primitives already exist (`InlineAlert`/`Status`, the `provenance` intent, the `Diagnostic` model). |
| D7 | **`morphe_surface` is a new top-level package**; shared contracts (`Diagnostic`, provenance map, `RenderHints`, base model, compiled-artifact envelope) promote into a thin new **`morphe_contracts`**. Dependency tree: `grammar ← contracts ← {cms, surface}` — independent siblings. | The frame is cms = editorial, surface = operational. A `surface → cms` edge would drag marketing `Audience`/`Slug`/drafts into operational rendering. `Diagnostic` is already the substrate's exact shape, homeless in cms by accident. |
| D8 | **Total compilation.** An unrenderable construct (`oneOf` without discriminator, `$ref` cycle, bare `object`) emits a visible diagnostic node **and** a diagnostics-list entry, field-level — never throws, never silently drops. CI asserts **zero** such diagnostics for controlled specs. | Extends the "render stays total" invariant upstream, and operationalizes the pressure-test for free: an unrenderable region literally renders as "not agent-coherent." |
| D9 | **Data-driven embed-vs-link with a hard depth bound + cycle-break.** Embedded object in data → inline `Within(collapse)` section; bare ID/reference → `linked-ref`; cycles/bound → degrade to link or a depth diagnostic. **REVISIT** when graph-shaped surfaces need richer boundary handling. | Termination is non-negotiable (operational graphs are cyclic). The data already says embed-vs-reference; don't guess from schema. Mirrors the compound depth bound. |
| D10 | **Output is a versioned `CompiledSurface` artifact** (`{tree, grammar_version, compiler_version, diagnostics, compiled_at}`), sharing the compiled-envelope base in `morphe_contracts`; cms `CompiledTree` becomes the sibling specialization. Deterministic / byte-stable. | Matches the existing parity-gate culture; caching, snapshotting, CI. |
| D11 | **Library-first, MCP-ready.** Ship the pure compiler + tests; expose as an MCP tool (beside the cms MCP surface) only after the surface vocabulary stabilizes. | The signature is already typed/JSON-serializable/deterministic, so MCP-wrapping is non-breaking. Don't expose a churning vocabulary to agents. |
| D12 | **Actions are out of v1.** "Read-only" excludes them. In v2, `@morphe_action` is a **presentation** layer over the canonical `ActionContract` (Affordance Substrate doc): Morphe declares + renders the affordance (action bar, preview/commit/explain, result/repair). **Organon executes**; Morphe never runs the side effect. | The design constraints forbid Morphe owning governance/execution. |

## Consequences

- A small, real refactor: introduce `morphe_contracts` and migrate `Diagnostic`,
  `RenderHints`/`MorpheControls`, provenance, and the compiled-artifact envelope into it;
  rewire `morphe_cms` to depend on it. `morphe_grammar` stays the pure `Node` algebra.
- The compiler is a pure deterministic function; `CompiledSurface` is byte-stable and
  testable with golden snapshots (on both `SurfaceSpec` and `Node`) plus property tests
  over arbitrary schemas.
- Morphe gains the ability to render an **operation result** (data + diagnostics), the
  highest-value operational surface, and the renderer doubles as a live API-quality linter
  for controlled specs.
- The compiler **engages the adaptive tower** (`Within(collapse)`) rather than running a
  flat path beside it.
- **Out of v1, by decision:** mutations/actions (D12), queried/paginated collections (D4),
  `bind`/interactivity (D4), an open strategy registry (D3), and bespoke per-type Node
  presenters (D3). Each has a named seam to land in without a rewrite.
- **REVISIT:** D9's graph-traversal policy is the first place expected to need rework, when
  graph-shaped operational surfaces outgrow collapse-or-link at the boundary.

# Prompt: Morphe edge-compilation design pass

Run from `~/projects/morphe`. Deliverable: a single markdown design document at `docs/design/edge-compilation-pass.md` — that file is the only edit to make. If it already exists (an earlier xhigh draft may be on disk), read it critically first and **supersede it in place**: keep what survives your scrutiny, replace what doesn't, and say in a preamble what you overturned and why.

Read widely in this repo (py compiler `py/morphe_surface/`, grammar, viewer `src/lib/` + trust gate, dialects, README). Also read two representative kernel consumers: `~/projects/Obolos/src/obolos/surfaces.py` and `~/projects/Taxis/src/taxis/surfaces.py`.

## Context

Morphe's founding thesis (README ¶1): **UI is authored as data — a typed Node tree rendered through a fixed grammar.** During the KRA-752 wave the implementation drifted: the compiled Node tree became the *wire format*. Six business kernels (Taxis, Misthos, chreos, Obolos, Apotheke, zygos) each vendor the py package `morphe_surface` (git-pinned by tag), author Pydantic view-models annotated with `morphe_hint(...)` (strategies, per-value intent maps, kpi-row, hidden, heading, currency), and compile **server-side** to a `CompiledSurface` envelope `{tree, content-hash seals, dialect_id, grammar_version}`. A SvelteKit viewer validates the envelope at a trust gate (rejects invalid artifacts), then renders the tree through dialects/tokens.

Measured cost of the drift (2026-07-17): a **one-line compiler fix** required tag `py-v0.6.4` → six pyproject pin bumps → six lock regens → six CI gates → six docker image rebuilds → two deployment re-pins. Three such fixes shipped that day alone.

**The founder's ruling: compilation belongs at the edge, over typed data.** Kernels ship typed view-model data + hints; the viewer/edge runs the surface compiler. A compiler fix must become one viewer deploy, zero kernel rebuilds.

## Design questions — answer decisively (recommend, don't survey)

1. **Wire contract.** What exactly do kernels ship? (JSON Schema of the view-model with `x-morphe` hint blocks + a data payload? The current `build_surface(schema, data)` input pair? How do *per-request computed* hints — per-value intent maps, `KpiCell`s built in code — serialize?)
2. **Trust re-anchoring.** Today the content-hash seals + trust gate attach to the compiled tree — the artifact is the kernel's *testimony*. If the tree is computed at the edge: what is signed, what does the trust gate verify, and what stops a compromised viewer from lying about kernel data? Keep the artifact-as-testimony property or consciously replace it.
3. **Version negotiation.** Kernels on old hint vocabulary vs a newer edge compiler (hints are `extra="ignore"` forward-open today — preserve that), and the reverse.
4. **Migration.** A staged path from six-kernel tree-emission to edge compilation with **zero flag-day**; can the viewer accept BOTH envelope kinds during transition?
5. **What stays kernel-side.** Enumerate what genuinely cannot move (anything touching kernel-private state at render time?), and what the py package shrinks to (authoring/hint vocabulary + view-model contracts only?).
6. **The seam contract.** Today emit-shape ↔ renderer-CSS is one contract split across py and web with nothing pinning it (a subgrid layout bug lived exactly there: the compiler stack-wrapped alerting rows, the renderer only subgrids direct children). In the edge design both sides live in one runtime — **specify the test that pins the seam.**

## Constraints

- Pydantic stays the system contract. The hint vocabulary is established and six kernels annotate with it — **do not redesign the authoring surface; relocate the compilation.**
- Dialects stay viewer-side.
- The viewer trust gate must remain meaningful.
- Include a cost/risk table for the recommended migration stages.

## Deliverable shape

Opinionated: recommended architecture, typed wire-contract sketch, trust model, staged migration plan, and a short clearly-separated list of open questions that genuinely require founder judgment (few).

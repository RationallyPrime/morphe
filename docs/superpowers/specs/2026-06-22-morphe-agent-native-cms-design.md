# Morphe Agent-Native CMS — v0 Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — pending implementation plan
**Source PRD:** `morphe-agent-native-cms-prd.md` (repo root)
**Supersedes (where they conflict):** the PRD's stale Literals (§8.1), the dual-runtime ambiguity (§19), and the runtime render-smoke step (§12).

This document is the **as-built decision delta** on top of the PRD. The PRD's philosophy, artifact model (§7), tool I/O models (§9), policy list (§13), and storage/publishing semantics (§15–§17) stand as written. This doc commits the architecture, reconciles the contracts to the live substrate, and scopes the first slice.

The core bet is unchanged:

> Agents author typed semantic content artifacts, not pages. Morphe compiles those artifacts into valid `Node` trees through deterministic presenters, gates them, and publishes immutable revisions by pointer.

---

## 1. Architecture & the language boundary

```
PydanticAI / Claude agent
   │  MCP tool calls (fastapi-mcp)
   ▼
py/morphe_cms/  ── ALL CMS RUNTIME IS PYTHON ───────────────────────────┐
   contracts/   Pydantic = source of truth      → schema/cms/*.json     │
   presenter/   draft → Node dict (primitives, deterministic)           │
   validation/  pydantic → policy → validate_node  (the grammar gate)   │
   store/       append-only flat-file revisions + publications          │
   tools/       create / validate / preview / publish                   │
   mcp/         fastapi-mcp server exposing the tools                   │
                                                                        ┘
        ▼ writes compiled/<type>/<slug>/rev-NNN.tree.json (valid Node JSON)
   ▼
src/routes/   SvelteKit = RENDER SURFACE ONLY
   preview/[artifactId]/[revisionId]/+page.server.ts   → read tree → <MorpheRoot>
   p/[slug]/+page.server.ts            → publications.json → tree → <MorpheRoot>
```

**The boundary is a file of validated Node JSON.** Python never imports Svelte; SvelteKit never imports Pydantic. They meet only at the compiled-tree artifact. This is the content⊥presentation seam the substrate already guarantees, made physical.

**Why Python owns the runtime** (decided): it is the most spec-faithful (Pydantic *is* the runtime validator), it matches the project's Python/Pydantic/PydanticAI/MCP standards, agent tools are Python-native, and — decisively — it reuses the existing `py/morphe_grammar` Pydantic mirror. `validate_node` (`py/morphe_grammar/models.py:475`) already validates any `Node` dict against the full grammar. The hardest part of a headless CMS (the trusted JSON→typed-content boundary) is therefore *already built*.

**New package:** `py/morphe_cms/` joins the uv workspace. Deps: `pydantic` (v2), `fastapi`, `fastapi-mcp`, `uvicorn`; dev: `pytest`, `hypothesis`. It depends on `morphe_grammar` for `validate_node` and the `Node` types.

---

## 2. Contracts — reconciled to the live substrate

The PRD's shared types (§8.1) were written against an older snapshot. Corrected against `py/morphe_grammar/models.py` and `CONTRACT.md §8`:

| PRD | Live reality | v0 contract |
|---|---|---|
| `IntentRef` includes `"action"`, omits `provenance` | `IntentRef = CoreIntent \| RegisterIntent`; core = `primary-action, neutral, provenance, evidence, accession, caution, success, info`; register = `folio, marginalia, seal` | Closed grouped literal of the **real 11**. Used on every intent field. No CTA-only restriction — agents may use any registered intent anywhere (per decision: beacon-scarcity-as-type was too restrictive). CTA merely **defaults** to `primary-action`. |
| 6 dialects | 9 registered | `DialectName = gallery, night, icelandic-archive, clinical, reykjavik-registry, timaeus, ledger, estate, foundry` |
| `SurfaceRef = default/raised/sunken/inset/scrim` | `Frame.surface ∈ base/raised/sunken` | `SurfaceRef = base \| raised \| sunken` |
| `EmphasisLevel = low/normal/high` | `EmphasisClaim ∈ muted/normal/strong/critical` | `EmphasisClaim = muted \| normal \| strong \| critical` |
| `Audience` | (no substrate constraint) | keep PRD list: `founder, operator, cto, cfo, operations_lead, developer, buyer` |

`IntentRef` is intentionally a **closed grouped `Literal`** in the CMS contract and the grammar mirror so the exported JSON Schema constrains agent generation to known intents.

**`dialect` is a render hint, not content.** Per content⊥presentation, the presenter does **not** emit dialect into the tree. `MorpheControls.dialect` is carried on the artifact and passed to `MorpheRoot` at the preview/publication route. `primary_intent`, `surface`, and `emphasis` genuinely shape the tree, so they stay authoring-side in `MorpheControls`:

```python
class MorpheControls(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dialect: DialectName = "gallery"          # render hint only
    primary_intent: IntentRef = "evidence"
    surface: SurfaceRef = "base"
    emphasis: EmphasisClaim = "normal"
```

Otherwise the v0 content contract is the PRD's `CapabilityPageDraft` (§8.6) and its blocks/sections (§8.3–§8.5), with the corrected Literals and `CTA.intent` defaulting to `primary-action`.

---

## 3. The validation gate — and why it is all-Python

```
tool call
  → pydantic shape validation
  → CMS policy validation (PRD §13)
  → presenter compile (draft → Node dict)
  → validate_node  ◄── the grammar gate; fail-closed
  → write revision (status frozen) + compiled tree (atomically)
```

**Key insight — render totality makes a runtime render-smoke unnecessary.** The Morphe renderer is *total*: unknown compounds render-nothing, no node kind throws (verified in recon; CONTRACT R0.2). So any tree that passes `validate_node` **should not crash the renderer because of authored tree shape**. That is a claim about *tree shape only* — it deliberately does **not** cover renderer bugs, TS↔Python schema drift, file corruption, or unsupported runtime assumptions. Those residual risks are real, which is exactly why the SSR smoke stays. So:

- **Runtime gate (inside each MCP tool):** pydantic → policy → `validate_node`. Pure Python, fail-closed, zero cross-language hop. This guarantees *authored-shape* validity, nothing more.
- **Render-smoke** moves out of the runtime path (a deliberate deviation from PRD §12, approved): it lives as
  1. a **Vitest SSR test** (TS) that imports `MorpheRoot`, renders committed compiled-tree fixtures, and asserts no throw — catching the residual risks above (drift, renderer regressions) on real fixtures; and
  2. the live `/preview` route as the human visual smoke.

Failures save as draft (PRD §12) and never publish. Policy returns repairable diagnostics (PRD §13/§22 `Diagnostic` model) keyed by `path` with `repair_hint`.

---

## 4. Presenter

`present_capability_page(draft: CapabilityPageDraft) -> dict` — pure, deterministic, no clock/RNG/IO. v0 **emits grammar primitives directly** (`{"kind":"text","value":...,"as":"heading","intent":...}`) because a CapabilityPage is string-heavy (titles, claims, labels) and direct primitive emission avoids the ergonomics of compound *param interpolation*: the substrate's hard constraint is that string fields can't be threaded through `ParamRef` params — compounds carry strings fine when authored in the template, they just can't be *parameterised* by them. Repeated section forms can graduate to compounds later. Small section-presenter helpers compose into the page frame.

Conceptual mapping (corrected from PRD §11/§21):

| Draft piece | Node output |
|---|---|
| page root | `Frame{role:page, surface:morphe.surface, children:[…]}` |
| `hero` | `Stack{role:section}` → `Text{as:display}` title, `Text{as:body}` thesis, optional kicker/supporting `Text` |
| `hero_variation` (if present) | `Vary{id, objective, options:[hero Stack per variant], default:0}` — renders default branch only in v0 (mid-loop dormant), forward-compatible |
| `proof_points` | `Grid`/`Cluster{role:list}` of `Stack`(`Badge{label}` + `Text{claim}` + optional `Text{evidence}`) |
| `problemFrame` | `Stack{role:section}`: heading `Text`, claim `Text`, evidence as `Stack` of `Text` |
| `workflowMap` | `Stack{role:section}`: title + ordered steps (`Badge` index + `Text` label + `Text` description) |
| `caseProof` | `Stack{role:section}`: title, company_shape, before/after `Text` pair, metrics as `Text` rows |
| `faq` | `Stack{role:section}`: title + `Disclosure{summary:question, children:[Text answer]}` per item |
| `cta` | `action_id` → `Button{label, action, intent}`; else `href` → `Link{href, label, intent}` |

A11y is satisfied structurally: `Button` always carries `label`; no inputs appear in a CapabilityPage, so no `InputA11y` burden in v0. Text fields are authored directly (the presenter owns the register via `as`/`intent`/`emphasis`).

---

## 5. Storage & publishing (PRD §15–§17, verbatim semantics)

```
content/capability-pages/<slug>/rev-001.json        # ArtifactEnvelope, data = CapabilityPageDraft
compiled/capability-pages/<slug>/rev-001.tree.json  # CompiledTree, tree = validated Node dict
publications.json                                    # slug → {artifact_id, revision_id, channel, …}
```

- `artifact_id = capability-page.<slug>`; `revision_id = rev-NNN` (zero-padded, per artifact).
- **`CompiledTree` carries `render_hints`** so it is self-sufficient to render — the route reads **one file**:
  ```python
  class CompiledTree(BaseModel):   # extends PRD §7.2
      ...
      render_hints: RenderHints     # {"dialect": draft.morphe.dialect}
  ```
  The dialect lives here (a render hint), **not** in the `tree` (content⊥presentation, §2).
- **Immutability (resolves append-only vs "mark validated"):** a revision file is **written exactly once and never mutated**. Its `status` is frozen at write time — `draft` if the gate failed, `validated` if it passed — and never changes afterward. **"Published" is not a revision-file status; it is the existence of a pointer in `publications.json`.** Equivalently: a revision is *validated* iff a matching compiled tree exists with ok diagnostics; *published* iff a publication pointer references it. Per-revision diagnostics are written once alongside the revision (`content/.../rev-NNN.diagnostics.json`), never edited.
- **Publish = pointer move** in `publications.json`. **Rollback = repoint** to an earlier revision. Publish **fails closed** unless that exact revision has a stored, gate-passing compiled tree.
- **Single-writer (v0):** v0 assumes a single writer. All file writes use temp-file + atomic rename (`os.replace`). Revision-number allocation and `publications.json` pointer moves are **not** concurrency-safe; concurrent revision creation is out of scope (no locking in v0).
- v0 is **local/dev file-backed** (PRD §18). Production-on-Vercel persistence (compiled trees readable by serverless render routes) is the explicit later-DB step (PRD §15) — out of scope for v0.

---

## 6. Agent-facing tools (MCP via fastapi-mcp)

A FastAPI app mounts `fastapi-mcp`, exposing four tools. Each is a typed function with the PRD's I/O models (§9):

1. **`createCapabilityPage`** — validate draft → save artifact revision → compile → gate → save compiled tree. Returns `{ok, artifact_id, revision_id, diagnostics}`.
2. **`validateContentArtifact`** — run the full gate on an existing revision without publishing. Returns `{ok, compiled_tree_id, diagnostics}`.
3. **`renderPreview`** — returns a `/preview/<artifact>/<rev>` URL (+ optional dialect/viewport).
4. **`publishContentArtifact`** — pointer move to a validated revision. Fails unless that revision passed the gate.

**Tool input stays typed** (`CreateCapabilityPageInput`, etc.) so fastapi-mcp advertises the full JSON Schema to the agent — that is the constrained-generation benefit from PRD §3, which an untyped `dict` input would forfeit. Consequence: FastAPI validates *shape* before the tool body runs. So:

- **Schema-invalid calls** (wrong shape / unknown literal) are rejected before the tool body runs and **are not persisted**. The error surface is **transport-dependent** (verified empirically against fastapi-mcp 0.4.0 in the verification pass):
  - **Direct REST path:** a custom `RequestValidationError` handler converts Pydantic's `ValidationError` into our `Diagnostic` shape (PRD §22) — repairable, `path`-keyed, status 422. The fully-structured envelope is always available here.
  - **MCP transport (the agent path):** more limited. The MCP server pre-validates against the advertised JSON Schema and surfaces closed-literal/shape violations as a plain MCP error string (`isError`) *before* the REST handler runs; pydantic-only violations (model-validators, patterns) reach the handler but fastapi-mcp re-wraps the 422 body as an exception string. So over MCP the **constrained-generation schema is the primary repair mechanism** — the advertised enums/patterns (incl. the closed `IntentRef`/`DialectName` and the `revision_id`/`artifact_id` patterns) stop most bad emissions at the source. Clean structured `Diagnostic`s over MCP are guaranteed for **policy/business** failures (next bullet), not for raw shape violations. Owning the tool dispatch to also structure shape errors over MCP is a future iteration (out of v0 scope).
- **Shape-valid but policy/grammar-invalid** drafts *are* persisted, as a `draft`-status revision with a diagnostics record, and returned as a **200 `ToolResult{ok:false, diagnostics}`** — which passes through cleanly over **both** REST and MCP — so the agent can iterate against a stored artifact.

This is the explicit resolution of "failed artifacts save as draft": *shape* failures return diagnostics only (structured on REST; schema-constrained-at-source + string-surfaced over MCP); *policy/grammar* failures save as draft and return structured diagnostics on both transports.

Deferred to iteration 2: **`reviseContentArtifact`** (decision) and **`proposeCompound`** (PRD §26.5).

---

## 7. Render surface (SvelteKit)

- `src/routes/preview/[artifactId]/[revisionId]/+page.server.ts` — reads the **one** compiled-tree file, passes `tree` to `MorpheRoot` and `render_hints.dialect` as the dialect (overridable by `?dialect=`).
- `src/routes/p/[slug]/+page.server.ts` — resolves `publications.json` → compiled-tree file → `MorpheRoot` (dialect from `render_hints`).
- Both are thin: read one JSON file, render. No business logic, no second file to join. The TS side trusts the Python gate (the JSON is already `validate_node`-valid; the TS grammar mirror is kept in sync).

---

## 8. Schema export

`py/morphe_cms/schema.py` mirrors `py/morphe_grammar/schema.py`: emit `CapabilityPageDraft.model_json_schema()` plus each tool's input schema, normalized, written to `schema/cms/`:

```
schema/cms/capability-page.schema.json
schema/cms/create-capability-page.schema.json
schema/cms/validate-content-artifact.schema.json
schema/cms/publish-content-artifact.schema.json
```

Committed. These are the wire/tool contracts; TS consumer types, if needed later, are generated *from* these (never hand-maintained — PRD §25 drift risk).

---

## 9. Testing (PRD §23, scoped to v0)

- **Contract (pytest):** valid draft accepted; unknown field rejected (`extra="forbid"`); CTA requires `action_id`|`href`; section discriminator works; unknown section kind / unknown intent / unsupported dialect / overlong title rejected; policy rejects raw css/class/hex/DOM/component-path fields.
- **Presenter (pytest):** valid draft → tree that `validate_node` accepts; each section kind → expected structure; `hero_variation` → `Vary`; CTA → button vs link; output deterministic (stable across runs).
- **Integration (pytest):** create→validate→compile→preview-url; create→validate→publish→pointer written; invalid draft cannot publish; rollback repoints; publish requires the exact validated revision.
- **Render-smoke (Vitest, TS):** load committed compiled-tree fixture → SSR `MorpheRoot` → assert no throw.
- **Property (hypothesis, later):** generated valid drafts → presenter never throws, output always `validate_node`-valid, no unknown intents/compounds.

---

## 10. Scope

**In v0:** the `CapabilityPageDraft` contract (corrected); JSON Schema export; file store; deterministic presenter; the all-Python validation gate; four MCP tools (create/validate/preview/publish); two SvelteKit render routes; the test suite above.

**Out of v0:** human editor UI; auth/permissions beyond local/dev; DB persistence; localization; asset upload; `reviseContentArtifact`; `proposeCompound`; additional content types; production-Vercel content persistence. (Matches PRD §18 "Skip", plus the two deferral decisions.)

**Acceptance:** PRD §24, minus the revise-related criteria, plus: compiled trees pass `validate_node`; preview + publication routes render through the real `MorpheRoot`; the Vitest render-smoke passes.

---

## 11. Decisions recorded

1. **Runtime home:** Python owns all CMS runtime; SvelteKit is render-only. Boundary = validated Node JSON file.
2. **Tool transport:** fastapi-mcp MCP server from day one.
3. **Render-smoke:** runtime gate is `validate_node` only — it guarantees authored-tree-shape validity, *not* freedom from renderer bugs/drift/corruption; render-smoke (Vitest SSR + preview route) stays to cover that residual risk.
4. **Intents:** closed 8-intent `Literal`; full freedom on all fields; CTA defaults to `primary-action`; no beacon-scarcity type restriction.
5. **Revise/propose:** deferred to iteration 2.
6. **Stale-Literal corrections:** intents, dialects (9), surface (`base/raised/sunken`), emphasis (`muted/normal/strong/critical`) all reconciled to `morphe_grammar/models.py`.
7. **Render hints:** `CompiledTree.render_hints.dialect` makes a compiled tree self-sufficient to render; routes read one file; dialect never enters the `tree`.
8. **Persistence on failure:** schema-invalid → `Diagnostic`-shaped repair errors, *not persisted*; shape-valid but policy/grammar-invalid → saved as `draft` with diagnostics.
9. **Immutability:** revision files written once, `status` frozen at write (`draft`|`validated`); "published" is pointer existence, not a file field.
10. **Concurrency:** v0 single-writer; temp-file + atomic rename; concurrent creation out of scope.

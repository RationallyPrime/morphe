# Morphe Agent-Native CMS (v0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a v0 agent-native content compiler — agents submit a typed `CapabilityPageDraft` through MCP tools; Morphe validates it, compiles it to a `Node` tree via a deterministic Python presenter, gates it with `validate_node`, stores immutable revisions in flat files, and renders/publishes through SvelteKit.

**Architecture:** All CMS runtime is Python in a new `py/morphe_cms/` package (contracts, presenter, validation gate, file store, MCP tools). The boundary to the frontend is a file of validated `Node` JSON; SvelteKit reads it and renders `MorpheRoot`. Reuses the existing `py/morphe_grammar` Pydantic mirror (`validate_node`) as the grammar gate. See `docs/superpowers/specs/2026-06-22-morphe-agent-native-cms-design.md`.

**Tech Stack:** Python 3.12, Pydantic v2, FastAPI + fastapi-mcp, uv workspace, pytest (+ hypothesis), SvelteKit/Svelte 5 + Vitest. Commands: `env -u PYTHONPATH uv run pytest` (py tests), `bun run test` (vitest), `bun run check` (svelte-check), `env -u PYTHONPATH uv run ruff check`, `env -u PYTHONPATH uv run ty check`.

**Conventions (apply to every task):**
- Run py tests with `env -u PYTHONPATH uv run pytest` from the repo root (the leading-colon `PYTHONPATH` footgun breaks `ty` import resolution).
- Python: full type hints, no `Any` except the envelope `data` field (PRD design), `ConfigDict(extra="forbid")` on every model.
- New py tests live in `py/tests/` (the `testpaths`).
- Commit after each task. Do **not** `git push` (user's call). We are on `master`; commit directly (docs/code adds, no branch switch — Codex shares this checkout, so never switch branches here).

---

## File Structure

```
py/morphe_cms/
  __init__.py              # public exports
  contracts/
    __init__.py
    shared.py              # Slug, IntentRef, DialectName, Audience, EmphasisClaim,
                           #   SurfaceRef, MorpheControls, RenderHints, Diagnostic
    capability_page.py     # HeroBlock, ProofPoint, CTA, section variants,
                           #   HeroVariation, CapabilityPageDraft
    artifact.py            # ArtifactProvenance, ArtifactEnvelope, CompiledTree, Publication
  presenter/
    __init__.py
    capability_page.py     # present_capability_page + section/hero/cta helpers
  validation/
    __init__.py
    diagnostics.py         # pydantic ValidationError -> Diagnostic
    policy.py              # policy rules pydantic can't express (e.g. unique section ids)
    gate.py               # compile_and_gate(draft) -> (CompiledTree | None, [Diagnostic])
  store/
    __init__.py
    files.py               # FileStore: atomic, append-only revisions + publications
  tools/
    __init__.py
    models.py              # Create/Validate/RenderPreview/Publish I/O models + ToolResult
    service.py             # create/validate/preview/publish functions over FileStore + gate
  mcp/
    __init__.py
    app.py                 # FastAPI app, endpoints, fastapi-mcp mount, error handler
  schema.py                # emit schema/cms/*.json (--write/--check), mirrors grammar/artifacts

py/tests/
  test_cms_shared.py
  test_cms_capability_page.py
  test_cms_artifact.py
  test_cms_schema.py
  test_cms_presenter.py
  test_cms_gate.py
  test_cms_store.py
  test_cms_service.py
  test_cms_mcp.py
  cms_fixtures.py          # a canonical valid CapabilityPageDraft payload

schema/cms/
  capability-page.schema.json
  create-capability-page.schema.json
  validate-content-artifact.schema.json
  publish-content-artifact.schema.json

src/routes/preview/[artifactId]/[revisionId]/
  +page.server.ts
  +page.svelte
src/routes/p/[slug]/
  +page.server.ts
  +page.svelte
src/lib/cms/
  render-smoke.test.ts     # Vitest SSR smoke over a committed compiled-tree fixture
  fixtures/
    capability-page.tree.json

Justfile                   # + cms-schema-write / cms-schema-check, wired into `gates`
pyproject.toml             # + morphe_cms module, fastapi-mcp dep, hypothesis dev dep
```

---

## Task 1: Package skeleton & dependencies

**Files:**
- Modify: `pyproject.toml` (deps + `module-name`)
- Create: `py/morphe_cms/__init__.py`
- Create: `py/morphe_cms/contracts/__init__.py`, `py/morphe_cms/presenter/__init__.py`, `py/morphe_cms/validation/__init__.py`, `py/morphe_cms/store/__init__.py`, `py/morphe_cms/tools/__init__.py`, `py/morphe_cms/mcp/__init__.py`
- Test: `py/tests/test_cms_shared.py` (import smoke)

- [ ] **Step 1: Add the package to the build + new deps**

In `pyproject.toml`, add to `[project].dependencies` (after the existing entries):

```toml
	"fastapi-mcp>=0.1.0",
```

(No new dev deps: `pytest` is already present, and `hypothesis` property tests are iteration-2 scope.)

Change the build module list:

```toml
[tool.uv.build-backend]
module-root = "py"
module-name = ["morphe_grammar", "morphe_agent", "morphe_cms"]
```

- [ ] **Step 2: Create empty package files**

Create `py/morphe_cms/__init__.py` with:

```python
"""Morphe agent-native CMS: typed content artifacts -> Node trees -> published revisions."""
```

Create each of these as an empty file (one blank line):
`py/morphe_cms/contracts/__init__.py`, `py/morphe_cms/presenter/__init__.py`, `py/morphe_cms/validation/__init__.py`, `py/morphe_cms/store/__init__.py`, `py/morphe_cms/tools/__init__.py`, `py/morphe_cms/mcp/__init__.py`.

- [ ] **Step 3: Write an import smoke test**

Create `py/tests/test_cms_shared.py`:

```python
from __future__ import annotations


def test_package_imports() -> None:
    import morphe_cms

    assert morphe_cms.__doc__ is not None
```

- [ ] **Step 4: Sync deps and run the smoke test**

Run: `env -u PYTHONPATH uv sync`
Then: `env -u PYTHONPATH uv run pytest py/tests/test_cms_shared.py -v`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml uv.lock py/morphe_cms py/tests/test_cms_shared.py
git commit -m "feat(cms): scaffold morphe_cms package + deps"
```

---

## Task 2: Shared contracts

**Files:**
- Create: `py/morphe_cms/contracts/shared.py`
- Test: `py/tests/test_cms_shared.py` (extend)

- [ ] **Step 1: Write failing tests**

Append to `py/tests/test_cms_shared.py`:

```python
import pytest
from pydantic import ValidationError

from morphe_cms.contracts.shared import Diagnostic, MorpheControls


def test_morphe_controls_defaults() -> None:
    mc = MorpheControls()
    assert mc.dialect == "gallery"
    assert mc.primary_intent == "evidence"
    assert mc.surface == "base"
    assert mc.emphasis == "normal"


def test_morphe_controls_rejects_unknown_dialect() -> None:
    with pytest.raises(ValidationError):
        MorpheControls(dialect="fantasy-dialect")


def test_morphe_controls_rejects_extra_field() -> None:
    with pytest.raises(ValidationError):
        MorpheControls(color="#0047ff")


def test_diagnostic_shape() -> None:
    d = Diagnostic(code="X", severity="error", path="a.b", message="m")
    assert d.repair_hint is None
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_shared.py -v`
Expected: FAIL (ImportError: cannot import name `MorpheControls`).

- [ ] **Step 3: Implement `shared.py`**

Create `py/morphe_cms/contracts/shared.py`:

```python
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# Closed grouped Literal mirror of morphe_grammar IntentRef (CONTRACT.md §8), so the
# exported JSON Schema constrains agent generation to known intents.
CoreIntent = Literal[
    "primary-action",
    "neutral",
    "provenance",
    "evidence",
    "accession",
    "caution",
    "success",
    "info",
]
RegisterIntent = Literal["folio", "marginalia", "seal"]
IntentRef = CoreIntent | RegisterIntent

# The nine registered dialect ids (src/lib/dialects/registry.ts).
DialectName = Literal[
    "gallery",
    "night",
    "icelandic-archive",
    "clinical",
    "reykjavik-registry",
    "timaeus",
    "ledger",
    "estate",
    "foundry",
]

# Frame.surface in the grammar is exactly these three.
SurfaceRef = Literal["base", "raised", "sunken"]

# EmphasisClaim in the grammar.
EmphasisClaim = Literal["muted", "normal", "strong", "critical"]

Audience = Literal[
    "founder",
    "operator",
    "cto",
    "cfo",
    "operations_lead",
    "developer",
    "buyer",
]

Slug = Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]


class CmsModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MorpheControls(CmsModel):
    # `dialect` is a RENDER HINT only — never emitted into the tree (content ⊥ presentation).
    dialect: DialectName = "gallery"
    primary_intent: IntentRef = "evidence"
    surface: SurfaceRef = "base"
    emphasis: EmphasisClaim = "normal"


class RenderHints(CmsModel):
    dialect: DialectName = "gallery"


class Diagnostic(CmsModel):
    code: str
    severity: Literal["error", "warning", "info"]
    path: str
    message: str
    repair_hint: str | None = None
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_shared.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/contracts/shared.py py/tests/test_cms_shared.py
git commit -m "feat(cms): shared contract types reconciled to live substrate"
```

---

## Task 3: CapabilityPage content contracts

**Files:**
- Create: `py/morphe_cms/contracts/capability_page.py`
- Create: `py/tests/cms_fixtures.py`
- Test: `py/tests/test_cms_capability_page.py`

- [ ] **Step 1: Write the canonical fixture**

Create `py/tests/cms_fixtures.py`:

```python
from __future__ import annotations

from typing import Any

# A canonical, valid CapabilityPageDraft payload (kebab-correct intents/dialects).
VALID_DRAFT: dict[str, Any] = {
    "slug": "workflow-automation",
    "audience": "operations_lead",
    "morphe": {
        "dialect": "gallery",
        "primary_intent": "evidence",
        "surface": "base",
        "emphasis": "normal",
    },
    "hero": {
        "kicker": "Capability",
        "title": "Workflow automation that stays accountable",
        "thesis": "Morphe encodes operational workflows as adaptive, auditable interfaces.",
        "supporting_claim": "The interface changes register and emphasis without escaping the grammar.",
    },
    "proof_points": [
        {"label": "Typed", "claim": "Every artifact is validated before it reaches the renderer.", "intent": "evidence"},
        {"label": "Adaptive", "claim": "Variation happens inside authorized Morphe envelopes.", "intent": "info"},
    ],
    "sections": [
        {
            "kind": "problemFrame",
            "id": "problem",
            "title": "The problem",
            "claim": "Most workflow UIs collapse when operational context changes.",
            "evidence": [
                "Different roles need different levels of detail.",
                "Operational states change faster than static frontend releases.",
            ],
            "intent": "caution",
        },
        {
            "kind": "workflowMap",
            "id": "how-it-works",
            "title": "How it works",
            "steps": [
                {"label": "Model the operation", "description": "Define the domain objects, actions, and transitions."},
                {"label": "Compile the interface", "description": "Render the workflow through grammar + dialect."},
            ],
            "intent": "info",
        },
    ],
    "cta": {"label": "See the workflow", "action_id": "open_composer", "intent": "primary-action"},
    "source_ids": [],
}
```

- [ ] **Step 2: Write failing tests**

Create `py/tests/test_cms_capability_page.py`:

```python
from __future__ import annotations

import copy

import pytest
from pydantic import ValidationError

from morphe_cms.contracts.capability_page import CapabilityPageDraft

from .cms_fixtures import VALID_DRAFT


def test_valid_draft_accepts() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    assert draft.slug == "workflow-automation"
    assert draft.sections[0].kind == "problemFrame"


def test_rejects_unknown_field() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["hero"]["color"] = "#0047ff"
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_cta_requires_action_or_href() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["cta"] = {"label": "Go", "intent": "primary-action"}
    with pytest.raises(ValidationError, match="action_id or href"):
        CapabilityPageDraft.model_validate(payload)


def test_unknown_section_kind_rejected() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["kind"] = "mysterySection"
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_unknown_intent_rejected() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["proof_points"][0]["intent"] = "urgent-blue"
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_overlong_title_rejected() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["hero"]["title"] = "x" * 200
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_requires_at_least_one_section() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"] = []
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)
```

- [ ] **Step 3: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_capability_page.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 4: Implement `capability_page.py`**

Create `py/morphe_cms/contracts/capability_page.py`:

```python
from __future__ import annotations

from typing import Annotated, Literal, Self, Union

from pydantic import Field, HttpUrl, model_validator

from .shared import Audience, CmsModel, IntentRef, MorpheControls, Slug


class HeroBlock(CmsModel):
    kicker: Annotated[str | None, Field(max_length=48)] = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    thesis: Annotated[str, Field(min_length=20, max_length=320)]
    supporting_claim: Annotated[str | None, Field(max_length=220)] = None


class ProofPoint(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=64)]
    claim: Annotated[str, Field(min_length=8, max_length=240)]
    evidence: Annotated[str | None, Field(max_length=240)] = None
    intent: IntentRef | None = None


class CTA(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=48)]
    action_id: Annotated[str | None, Field(pattern=r"^[a-z][a-z0-9_]*$")] = None
    href: HttpUrl | None = None
    intent: IntentRef = "primary-action"

    @model_validator(mode="after")
    def require_action_or_href(self) -> Self:
        if not self.action_id and not self.href:
            raise ValueError("CTA requires either action_id or href")
        return self


class ProblemFrameSection(CmsModel):
    kind: Literal["problemFrame"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    claim: Annotated[str, Field(min_length=12, max_length=280)]
    evidence: Annotated[
        list[Annotated[str, Field(min_length=4, max_length=220)]],
        Field(default_factory=list, max_length=5),
    ]
    intent: IntentRef | None = None


class WorkflowStep(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=64)]
    description: Annotated[str, Field(min_length=8, max_length=220)]
    evidence: Annotated[str | None, Field(max_length=220)] = None


class WorkflowMapSection(CmsModel):
    kind: Literal["workflowMap"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    steps: Annotated[list[WorkflowStep], Field(min_length=2, max_length=7)]
    intent: IntentRef | None = None


class Metric(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=64)]
    value: Annotated[str, Field(min_length=1, max_length=32)]
    explanation: Annotated[str | None, Field(max_length=160)] = None


class CaseProofSection(CmsModel):
    kind: Literal["caseProof"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    company_shape: Annotated[str | None, Field(max_length=120)] = None
    before: Annotated[str, Field(min_length=8, max_length=240)]
    after: Annotated[str, Field(min_length=8, max_length=240)]
    metrics: Annotated[list[Metric], Field(default_factory=list, max_length=4)]
    intent: IntentRef | None = None


class FAQItem(CmsModel):
    question: Annotated[str, Field(min_length=8, max_length=140)]
    answer: Annotated[str, Field(min_length=12, max_length=420)]


class FAQSection(CmsModel):
    kind: Literal["faq"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    items: Annotated[list[FAQItem], Field(min_length=2, max_length=8)]
    intent: IntentRef | None = None


CapabilitySection = Annotated[
    Union[  # noqa: UP007 - discriminated union needs Annotated[Union[...], Field(...)]
        ProblemFrameSection,
        WorkflowMapSection,
        CaseProofSection,
        FAQSection,
    ],
    Field(discriminator="kind"),
]


class HeroVariant(CmsModel):
    angle: Literal["governance", "speed", "cost", "trust", "technical"]
    title: Annotated[str, Field(min_length=4, max_length=96)]
    thesis: Annotated[str, Field(min_length=20, max_length=320)]


class HeroVariation(CmsModel):
    objective: Literal["salience", "density", "compactness"] = "salience"
    variants: Annotated[list[HeroVariant], Field(min_length=2, max_length=5)]


class CapabilityPageDraft(CmsModel):
    slug: Slug
    audience: Audience
    morphe: MorpheControls = Field(default_factory=MorpheControls)
    hero: HeroBlock
    hero_variation: HeroVariation | None = None
    proof_points: Annotated[list[ProofPoint], Field(default_factory=list, max_length=6)]
    sections: Annotated[list[CapabilitySection], Field(min_length=1, max_length=8)]
    cta: CTA
    source_ids: Annotated[list[str], Field(default_factory=list, max_length=12)]
```

- [ ] **Step 5: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_capability_page.py -v`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add py/morphe_cms/contracts/capability_page.py py/tests/cms_fixtures.py py/tests/test_cms_capability_page.py
git commit -m "feat(cms): CapabilityPageDraft content contract"
```

---

## Task 4: Artifact envelope contracts

**Files:**
- Create: `py/morphe_cms/contracts/artifact.py`
- Test: `py/tests/test_cms_artifact.py`

- [ ] **Step 1: Write failing tests**

Create `py/tests/test_cms_artifact.py`:

```python
from __future__ import annotations

import pytest
from pydantic import ValidationError

from morphe_cms.contracts.artifact import ArtifactEnvelope, CompiledTree, Publication


def _envelope(**overrides: object) -> ArtifactEnvelope:
    base = {
        "id": "capability-page.workflow-automation",
        "type": "capabilityPage",
        "schema_version": "0.1.0",
        "presenter_version": "0.1.0",
        "status": "validated",
        "data": {"slug": "workflow-automation"},
        "provenance": {"created_by": "agent", "created_at": "2026-06-22T00:00:00Z"},
    }
    base.update(overrides)
    return ArtifactEnvelope.model_validate(base)


def test_envelope_accepts_valid() -> None:
    env = _envelope()
    assert env.status == "validated"
    assert env.provenance.created_by == "agent"


def test_envelope_rejects_unknown_status() -> None:
    with pytest.raises(ValidationError):
        _envelope(status="totally-shipped")


def test_compiled_tree_carries_render_hints() -> None:
    ct = CompiledTree.model_validate(
        {
            "artifact_id": "capability-page.x",
            "revision_id": "rev-001",
            "grammar_version": "0.1.0",
            "presenter_version": "0.1.0",
            "tree": {"kind": "frame", "role": "page", "children": []},
            "render_hints": {"dialect": "gallery"},
            "compiled_at": "2026-06-22T00:00:00Z",
        }
    )
    assert ct.render_hints.dialect == "gallery"


def test_publication_shape() -> None:
    pub = Publication.model_validate(
        {
            "slug": "workflow-automation",
            "artifact_id": "capability-page.workflow-automation",
            "revision_id": "rev-001",
            "channel": "site",
            "published_at": "2026-06-22T00:00:00Z",
            "published_by": "agent",
        }
    )
    assert pub.channel == "site"
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_artifact.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement `artifact.py`**

Create `py/morphe_cms/contracts/artifact.py`:

```python
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .shared import CmsModel, Diagnostic, RenderHints

ArtifactType = Literal[
    "landingPage",
    "capabilityPage",
    "caseStudy",
    "comparisonPage",
    "article",
    "campaignPage",
]


class ArtifactProvenance(CmsModel):
    created_by: Literal["agent", "human", "migration"]
    prompt_id: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    created_at: str


class ArtifactEnvelope(CmsModel):
    id: str
    type: ArtifactType
    schema_version: str
    presenter_version: str
    # Frozen at write time: "draft" (gate failed) or "validated" (gate passed). Never
    # mutated. "published"/"archived" are pointer facts, not file mutations (see store).
    status: Literal["draft", "validated", "published", "archived"]
    data: dict[str, Any]
    provenance: ArtifactProvenance


class CompiledTree(CmsModel):
    artifact_id: str
    revision_id: str
    grammar_version: str
    presenter_version: str
    tree: dict[str, Any]
    render_hints: RenderHints
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    compiled_at: str


class Publication(CmsModel):
    slug: str
    artifact_id: str
    revision_id: str
    channel: Literal["site", "preview", "campaign"]
    published_at: str
    published_by: Literal["agent", "human", "system"]
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_artifact.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/contracts/artifact.py py/tests/test_cms_artifact.py
git commit -m "feat(cms): artifact envelope, compiled tree, publication models"
```

---

## Task 5: Presenter — hero, proof points, CTA

**Files:**
- Create: `py/morphe_cms/presenter/capability_page.py`
- Test: `py/tests/test_cms_presenter.py`

This task builds the leaf presenters. Each returns a `dict` that is a valid grammar `Node` (field names from `py/morphe_grammar/models.py`: `Text` uses `value` + `as`; `Frame.surface ∈ base/raised/sunken`; `Stack/Cluster` use `role` + `children`; `Badge.label`; `Button.label/action/intent`; `Link.href/label/intent`).

- [ ] **Step 1: Write failing tests**

Create `py/tests/test_cms_presenter.py`:

```python
from __future__ import annotations

from morphe_grammar import validate_node

from morphe_cms.contracts.capability_page import CTA, HeroBlock, ProofPoint
from morphe_cms.contracts.shared import MorpheControls
from morphe_cms.presenter.capability_page import (
    present_cta,
    present_hero,
    present_proof_points,
)


def test_hero_emits_valid_stack() -> None:
    hero = HeroBlock(title="A clear title", thesis="A thesis long enough to satisfy the bound.")
    node = present_hero(hero, None, MorpheControls())
    assert node["kind"] == "stack"
    assert node["role"] == "section"
    validate_node(node)
    # title is a display Text
    titles = [c for c in node["children"] if c.get("as") == "display"]
    assert titles and titles[0]["value"] == "A clear title"


def test_cta_with_action_is_button() -> None:
    cta = CTA(label="Go now", action_id="open_composer")
    node = present_cta(cta)
    assert node["kind"] == "button"
    assert node["action"] == "open_composer"
    assert node["label"] == "Go now"
    validate_node(node)


def test_cta_with_href_is_link() -> None:
    cta = CTA(label="Visit", href="https://example.com/x")
    node = present_cta(cta)
    assert node["kind"] == "link"
    assert node["href"].startswith("https://example.com")
    validate_node(node)


def test_proof_points_emit_valid_list() -> None:
    pts = [ProofPoint(label="Typed", claim="Validated before render.", intent="evidence")]
    node = present_proof_points(pts)
    assert node is not None
    assert node["role"] == "list"
    validate_node(node)


def test_empty_proof_points_returns_none() -> None:
    assert present_proof_points([]) is None
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_presenter.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement the leaf presenters**

Create `py/morphe_cms/presenter/capability_page.py`:

```python
from __future__ import annotations

from typing import Any

from morphe_cms.contracts.capability_page import (
    CTA,
    HeroBlock,
    HeroVariation,
    ProofPoint,
)
from morphe_cms.contracts.shared import MorpheControls

Node = dict[str, Any]


def _text(value: str, *, as_: str, emphasis: str | None = None, intent: str | None = None) -> Node:
    node: Node = {"kind": "text", "value": value, "as": as_}
    if emphasis is not None:
        node["emphasis"] = emphasis
    if intent is not None:
        node["intent"] = intent
    return node


def present_hero(hero: HeroBlock, variation: HeroVariation | None, morphe: MorpheControls) -> Node:
    if variation is not None:
        return _present_hero_variation(hero, variation, morphe)
    return _hero_stack(hero.kicker, hero.title, hero.thesis, hero.supporting_claim, morphe)


def _hero_stack(
    kicker: str | None,
    title: str,
    thesis: str,
    supporting: str | None,
    morphe: MorpheControls,
) -> Node:
    children: list[Node] = []
    if kicker:
        children.append(_text(kicker, as_="caption", intent="accession"))
    children.append(_text(title, as_="display", emphasis="strong", intent=morphe.primary_intent))
    children.append(_text(thesis, as_="body"))
    if supporting:
        children.append(_text(supporting, as_="body", emphasis="muted"))
    return {"kind": "stack", "role": "section", "children": children}


def _present_hero_variation(hero: HeroBlock, variation: HeroVariation, morphe: MorpheControls) -> Node:
    # Vary renders its default branch only until the mid-loop layer lands (CONTRACT §11);
    # default (index 0) is the authored base hero so the page is stable today.
    options: list[Node] = [_hero_stack(hero.kicker, hero.title, hero.thesis, hero.supporting_claim, morphe)]
    options.extend(
        _hero_stack(hero.kicker, v.title, v.thesis, hero.supporting_claim, morphe)
        for v in variation.variants
    )
    return {
        "kind": "vary",
        "id": "hero",
        "objective": variation.objective,
        "default": 0,
        "options": options,
    }


def present_proof_points(points: list[ProofPoint]) -> Node | None:
    if not points:
        return None
    children: list[Node] = []
    for pt in points:
        item: list[Node] = [{"kind": "badge", "label": pt.label}]
        if pt.intent is not None:
            item[0]["intent"] = pt.intent
        item.append(_text(pt.claim, as_="body"))
        if pt.evidence:
            item.append(_text(pt.evidence, as_="caption", emphasis="muted"))
        children.append({"kind": "stack", "role": "inline", "children": item})
    return {"kind": "stack", "role": "list", "children": children}


def present_cta(cta: CTA) -> Node:
    if cta.action_id:
        return {
            "kind": "button",
            "label": cta.label,
            "action": cta.action_id,
            "intent": cta.intent,
        }
    return {
        "kind": "link",
        "href": str(cta.href),
        "label": cta.label,
        "intent": cta.intent,
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_presenter.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/presenter/capability_page.py py/tests/test_cms_presenter.py
git commit -m "feat(cms): hero/proof/cta leaf presenters (grammar-valid Node dicts)"
```

---

## Task 6: Presenter — sections + full page assembly

**Files:**
- Modify: `py/morphe_cms/presenter/capability_page.py`
- Test: `py/tests/test_cms_presenter.py` (extend)

- [ ] **Step 1: Write failing tests**

Append to `py/tests/test_cms_presenter.py`:

```python
from morphe_grammar import validate_node as _vn

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.presenter.capability_page import present_capability_page, present_section
from .cms_fixtures import VALID_DRAFT


def test_each_section_kind_compiles() -> None:
    for section in CapabilityPageDraft.model_validate(VALID_DRAFT).sections:
        node = present_section(section)
        assert node["kind"] == "stack"
        _vn(node)


def test_faq_section_uses_disclosure() -> None:
    draft = CapabilityPageDraft.model_validate(
        {
            **VALID_DRAFT,
            "sections": [
                {
                    "kind": "faq",
                    "title": "Questions",
                    "items": [
                        {"question": "Is it typed?", "answer": "Yes, every artifact is validated."},
                        {"question": "Can it re-theme?", "answer": "Yes, by swapping the dialect."},
                    ],
                }
            ],
        }
    )
    node = present_section(draft.sections[0])
    kinds = [c["kind"] for c in node["children"]]
    assert "disclosure" in kinds


def test_full_page_compiles_and_is_valid() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    tree = present_capability_page(draft)
    assert tree["kind"] == "frame"
    assert tree["role"] == "page"
    assert tree["surface"] == "base"
    _vn(tree)


def test_presenter_is_deterministic() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    assert present_capability_page(draft) == present_capability_page(draft)


def test_hero_variation_emits_vary() -> None:
    draft = CapabilityPageDraft.model_validate(
        {
            **VALID_DRAFT,
            "hero_variation": {
                "objective": "salience",
                "variants": [
                    {"angle": "governance", "title": "Accountable automation", "thesis": "Stay on the record while moving fast."},
                    {"angle": "speed", "title": "Faster operational loops", "thesis": "Cut release latency without losing control."},
                ],
            },
        }
    )
    tree = present_capability_page(draft)
    vary_nodes = [c for c in tree["children"] if c.get("kind") == "vary"]
    assert vary_nodes and vary_nodes[0]["default"] == 0
    _vn(tree)
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_presenter.py -v`
Expected: FAIL (cannot import `present_section`, `present_capability_page`).

- [ ] **Step 3: Implement sections + assembly**

Append to `py/morphe_cms/presenter/capability_page.py`:

```python
from morphe_cms.contracts.capability_page import (  # noqa: E402  (grouped with section impls)
    CapabilityPageDraft,
    CaseProofSection,
    FAQSection,
    ProblemFrameSection,
    WorkflowMapSection,
)

PRESENTER_VERSION = "0.1.0"


def _section_shell(title: str, children: list[Node]) -> Node:
    head: list[Node] = [_text(title, as_="heading", emphasis="strong")]
    return {"kind": "stack", "role": "section", "children": head + children}


def _present_problem_frame(s: ProblemFrameSection) -> Node:
    body: list[Node] = [_text(s.claim, as_="body", intent=s.intent)]
    body.extend(_text(e, as_="body", emphasis="muted") for e in s.evidence)
    return _section_shell(s.title, body)


def _present_workflow_map(s: WorkflowMapSection) -> Node:
    steps: list[Node] = []
    for i, step in enumerate(s.steps, start=1):
        item: list[Node] = [
            {"kind": "badge", "label": str(i)},
            _text(step.label, as_="subheading", emphasis="strong"),
            _text(step.description, as_="body"),
        ]
        if step.evidence:
            item.append(_text(step.evidence, as_="caption", emphasis="muted"))
        steps.append({"kind": "stack", "role": "inline", "children": item})
    return _section_shell(s.title, [{"kind": "stack", "role": "list", "children": steps}])


def _present_case_proof(s: CaseProofSection) -> Node:
    body: list[Node] = []
    if s.company_shape:
        body.append(_text(s.company_shape, as_="caption", intent="provenance"))
    body.append(_text(s.before, as_="body", emphasis="muted"))
    body.append(_text(s.after, as_="body", intent=s.intent))
    for m in s.metrics:
        metric: list[Node] = [
            _text(m.value, as_="display", emphasis="strong", intent="evidence"),
            _text(m.label, as_="caption"),
        ]
        if m.explanation:
            metric.append(_text(m.explanation, as_="caption", emphasis="muted"))
        body.append({"kind": "stack", "role": "inline", "children": metric})
    return _section_shell(s.title, body)


def _present_faq(s: FAQSection) -> Node:
    items: list[Node] = [
        {
            "kind": "disclosure",
            "summary": item.question,
            "children": [_text(item.answer, as_="body")],
        }
        for item in s.items
    ]
    return _section_shell(s.title, items)


def present_section(section: object) -> Node:
    if isinstance(section, ProblemFrameSection):
        return _present_problem_frame(section)
    if isinstance(section, WorkflowMapSection):
        return _present_workflow_map(section)
    if isinstance(section, CaseProofSection):
        return _present_case_proof(section)
    if isinstance(section, FAQSection):
        return _present_faq(section)
    msg = f"unsupported section type: {type(section).__name__}"
    raise ValueError(msg)


def present_capability_page(draft: CapabilityPageDraft) -> Node:
    children: list[Node] = [present_hero(draft.hero, draft.hero_variation, draft.morphe)]
    proof = present_proof_points(draft.proof_points)
    if proof is not None:
        children.append(proof)
    children.append(
        {
            "kind": "stack",
            "role": "section",
            "children": [present_section(s) for s in draft.sections],
        }
    )
    children.append(present_cta(draft.cta))
    return {
        "kind": "frame",
        "role": "page",
        "surface": draft.morphe.surface,
        "children": children,
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_presenter.py -v`
Expected: PASS (all presenter tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/presenter/capability_page.py py/tests/test_cms_presenter.py
git commit -m "feat(cms): section presenters + full page assembly with Vary"
```

---

## Task 7: Diagnostics, policy, and the validation gate

**Files:**
- Create: `py/morphe_cms/validation/diagnostics.py`
- Create: `py/morphe_cms/validation/policy.py`
- Create: `py/morphe_cms/validation/gate.py`
- Test: `py/tests/test_cms_gate.py`

- [ ] **Step 1: Write failing tests**

Create `py/tests/test_cms_gate.py`:

```python
from __future__ import annotations

import copy

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.validation.diagnostics import validation_error_to_diagnostics
from morphe_cms.validation.gate import compile_and_gate
from morphe_cms.validation.policy import policy_diagnostics

from .cms_fixtures import VALID_DRAFT


def test_valid_draft_passes_gate() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    compiled, diagnostics = compile_and_gate(draft)
    assert compiled is not None
    assert compiled.tree["kind"] == "frame"
    assert compiled.render_hints.dialect == "gallery"
    assert [d for d in diagnostics if d.severity == "error"] == []


def test_duplicate_section_ids_rejected_by_policy() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    diags = policy_diagnostics(draft)
    assert any(d.code == "DUPLICATE_SECTION_ID" for d in diags)


def test_policy_failure_blocks_gate() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    compiled, diagnostics = compile_and_gate(draft)
    assert compiled is None
    assert any(d.severity == "error" for d in diagnostics)


def test_validation_error_converts_to_diagnostics() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["cta"] = {"label": "Go", "intent": "primary-action"}
    try:
        CapabilityPageDraft.model_validate(payload)
    except Exception as exc:  # noqa: BLE001 - we assert on the conversion
        diags = validation_error_to_diagnostics(exc)
        assert diags
        assert all(d.severity == "error" for d in diags)
        assert all(d.path for d in diags)
    else:
        raise AssertionError("expected ValidationError")
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_gate.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement diagnostics, policy, gate**

Create `py/morphe_cms/validation/diagnostics.py`:

```python
from __future__ import annotations

from pydantic import ValidationError

from morphe_cms.contracts.shared import Diagnostic


def validation_error_to_diagnostics(exc: Exception) -> list[Diagnostic]:
    if not isinstance(exc, ValidationError):
        return [Diagnostic(code="UNEXPECTED_ERROR", severity="error", path="", message=str(exc))]
    diagnostics: list[Diagnostic] = []
    for err in exc.errors():
        path = ".".join(str(p) for p in err["loc"])
        diagnostics.append(
            Diagnostic(
                code=err["type"].upper().replace(".", "_"),
                severity="error",
                path=path,
                message=err["msg"],
                repair_hint="Adjust this field to satisfy the contract, then resubmit.",
            )
        )
    return diagnostics
```

Create `py/morphe_cms/validation/policy.py`:

```python
from __future__ import annotations

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.contracts.shared import Diagnostic


def policy_diagnostics(draft: CapabilityPageDraft) -> list[Diagnostic]:
    """Policy rules the pydantic shape can't express.

    Most PRD §13 forbidden classes (raw css/hex/class/DOM/unknown intent/dialect)
    are already unrepresentable via `extra="forbid"` + closed Literals, so v0 policy
    is thin. The one real cross-field rule: section ids must be unique within a page.
    """
    diagnostics: list[Diagnostic] = []
    seen: set[str] = set()
    for i, section in enumerate(draft.sections):
        sid = section.id
        if sid is None:
            continue
        if sid in seen:
            diagnostics.append(
                Diagnostic(
                    code="DUPLICATE_SECTION_ID",
                    severity="error",
                    path=f"sections[{i}].id",
                    message=f"Section id '{sid}' is used more than once.",
                    repair_hint="Give each section a unique id, or omit it.",
                )
            )
        seen.add(sid)
    return diagnostics
```

Create `py/morphe_cms/validation/gate.py`:

```python
from __future__ import annotations

from morphe_grammar import validate_node

from morphe_cms.contracts.artifact import CompiledTree
from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.contracts.shared import Diagnostic, RenderHints
from morphe_cms.presenter.capability_page import PRESENTER_VERSION, present_capability_page
from morphe_cms.validation.diagnostics import validation_error_to_diagnostics
from morphe_cms.validation.policy import policy_diagnostics

GRAMMAR_VERSION = "0.1.0"


def compile_and_gate(
    draft: CapabilityPageDraft,
    *,
    artifact_id: str = "",
    revision_id: str = "",
    compiled_at: str = "",
) -> tuple[CompiledTree | None, list[Diagnostic]]:
    """Run policy -> presenter -> validate_node. Returns (compiled | None, diagnostics).

    Fail-closed: any error-severity diagnostic yields a None compiled tree.
    """
    diagnostics = policy_diagnostics(draft)
    if any(d.severity == "error" for d in diagnostics):
        return None, diagnostics

    tree = present_capability_page(draft)
    try:
        validate_node(tree)
    except Exception as exc:  # noqa: BLE001 - convert any grammar failure to diagnostics
        diagnostics.extend(validation_error_to_diagnostics(exc))
        return None, diagnostics

    compiled = CompiledTree(
        artifact_id=artifact_id,
        revision_id=revision_id,
        grammar_version=GRAMMAR_VERSION,
        presenter_version=PRESENTER_VERSION,
        tree=tree,
        render_hints=RenderHints(dialect=draft.morphe.dialect),
        diagnostics=diagnostics,
        compiled_at=compiled_at,
    )
    return compiled, diagnostics
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_gate.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/validation py/tests/test_cms_gate.py
git commit -m "feat(cms): diagnostics, policy, and the fail-closed validation gate"
```

---

## Task 8: File store (atomic, append-only)

**Files:**
- Create: `py/morphe_cms/store/files.py`
- Test: `py/tests/test_cms_store.py`

- [ ] **Step 1: Write failing tests**

Create `py/tests/test_cms_store.py`:

```python
from __future__ import annotations

from pathlib import Path

import pytest

from morphe_cms.contracts.artifact import ArtifactEnvelope, CompiledTree, Publication
from morphe_cms.contracts.shared import RenderHints
from morphe_cms.store.files import FileStore


def _envelope(rev: str, status: str = "validated") -> ArtifactEnvelope:
    return ArtifactEnvelope(
        id="capability-page.demo",
        type="capabilityPage",
        schema_version="0.1.0",
        presenter_version="0.1.0",
        status=status,  # type: ignore[arg-type]
        data={"slug": "demo"},
        provenance={"created_by": "agent", "created_at": "2026-06-22T00:00:00Z"},  # type: ignore[arg-type]
    )


def _compiled(rev: str) -> CompiledTree:
    return CompiledTree(
        artifact_id="capability-page.demo",
        revision_id=rev,
        grammar_version="0.1.0",
        presenter_version="0.1.0",
        tree={"kind": "frame", "role": "page", "children": []},
        render_hints=RenderHints(dialect="gallery"),
        compiled_at="2026-06-22T00:00:00Z",
    )


def test_revision_ids_increment(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    assert store.next_revision_id("demo") == "rev-001"
    store.write_artifact("demo", "rev-001", _envelope("rev-001"))
    assert store.next_revision_id("demo") == "rev-002"


def test_write_and_read_compiled_roundtrip(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    got = store.read_compiled("demo", "rev-001")
    assert got.render_hints.dialect == "gallery"


def test_publish_then_rollback(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    store.write_compiled("demo", "rev-002", _compiled("rev-002"))

    def _pub(rev: str) -> Publication:
        return Publication(
            slug="demo",
            artifact_id="capability-page.demo",
            revision_id=rev,
            channel="site",
            published_at="2026-06-22T00:00:00Z",
            published_by="agent",
        )

    store.publish("demo", _pub("rev-002"))
    assert store.read_publications()["demo"].revision_id == "rev-002"
    store.publish("demo", _pub("rev-001"))  # rollback = repoint
    assert store.read_publications()["demo"].revision_id == "rev-001"


def test_has_validated_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    assert store.has_validated_revision("demo", "rev-001") is False
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    assert store.has_validated_revision("demo", "rev-001") is True
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_store.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement `files.py`**

Create `py/morphe_cms/store/files.py`:

```python
from __future__ import annotations

import json
import os
from pathlib import Path

from morphe_cms.contracts.artifact import ArtifactEnvelope, CompiledTree, Publication
from morphe_cms.contracts.shared import Diagnostic

_TYPE_DIR = "capability-pages"


class FileStore:
    """Flat-file, append-only store. v0 single-writer; writes are atomic (temp + rename)."""

    def __init__(self, root: Path) -> None:
        self._root = Path(root)

    # ---- paths -------------------------------------------------------------
    def _content_dir(self, slug: str) -> Path:
        return self._root / "content" / _TYPE_DIR / slug

    def _compiled_dir(self, slug: str) -> Path:
        return self._root / "compiled" / _TYPE_DIR / slug

    def _publications_path(self) -> Path:
        return self._root / "publications.json"

    # ---- atomic write ------------------------------------------------------
    @staticmethod
    def _atomic_write(path: Path, text: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)

    @staticmethod
    def _dump(model: ArtifactEnvelope | CompiledTree | Publication) -> str:
        return model.model_dump_json(indent=2) + "\n"

    # ---- revisions ---------------------------------------------------------
    def next_revision_id(self, slug: str) -> str:
        content = self._content_dir(slug)
        compiled = self._compiled_dir(slug)
        existing = set()
        for d in (content, compiled):
            if d.exists():
                existing |= {p.stem.split(".")[0] for p in d.glob("rev-*")}
        n = len(existing) + 1
        return f"rev-{n:03d}"

    def write_artifact(self, slug: str, revision_id: str, envelope: ArtifactEnvelope) -> None:
        self._atomic_write(self._content_dir(slug) / f"{revision_id}.json", self._dump(envelope))

    def read_artifact(self, slug: str, revision_id: str) -> ArtifactEnvelope:
        path = self._content_dir(slug) / f"{revision_id}.json"
        return ArtifactEnvelope.model_validate_json(path.read_text(encoding="utf-8"))

    def write_diagnostics(self, slug: str, revision_id: str, diagnostics: list[Diagnostic]) -> None:
        payload = json.dumps([d.model_dump() for d in diagnostics], indent=2) + "\n"
        self._atomic_write(self._content_dir(slug) / f"{revision_id}.diagnostics.json", payload)

    def write_compiled(self, slug: str, revision_id: str, compiled: CompiledTree) -> None:
        self._atomic_write(
            self._compiled_dir(slug) / f"{revision_id}.tree.json", self._dump(compiled)
        )

    def read_compiled(self, slug: str, revision_id: str) -> CompiledTree:
        path = self._compiled_dir(slug) / f"{revision_id}.tree.json"
        return CompiledTree.model_validate_json(path.read_text(encoding="utf-8"))

    def has_validated_revision(self, slug: str, revision_id: str) -> bool:
        return (self._compiled_dir(slug) / f"{revision_id}.tree.json").exists()

    # ---- publications ------------------------------------------------------
    def read_publications(self) -> dict[str, Publication]:
        path = self._publications_path()
        if not path.exists():
            return {}
        raw = json.loads(path.read_text(encoding="utf-8"))
        return {slug: Publication.model_validate(p) for slug, p in raw.items()}

    def publish(self, slug: str, publication: Publication) -> None:
        pubs = self.read_publications()
        pubs[slug] = publication
        payload = json.dumps(
            {s: p.model_dump() for s, p in pubs.items()}, indent=2, sort_keys=True
        )
        self._atomic_write(self._publications_path(), payload + "\n")
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_store.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/store/files.py py/tests/test_cms_store.py
git commit -m "feat(cms): atomic append-only file store with publication pointers"
```

---

## Task 9: Tool service (create / validate / preview / publish)

**Files:**
- Create: `py/morphe_cms/tools/models.py`
- Create: `py/morphe_cms/tools/service.py`
- Test: `py/tests/test_cms_service.py`

- [ ] **Step 1: Write failing tests**

Create `py/tests/test_cms_service.py`:

```python
from __future__ import annotations

import copy
from pathlib import Path

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.store.files import FileStore
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    RenderPreviewInput,
)
from morphe_cms.tools.service import (
    create_capability_page,
    publish_content_artifact,
    render_preview,
)

from .cms_fixtures import VALID_DRAFT

_NOW = "2026-06-22T00:00:00Z"


def _create(store: FileStore, draft_payload: dict) -> tuple[str, str]:
    draft = CapabilityPageDraft.model_validate(draft_payload)
    result = create_capability_page(
        CreateCapabilityPageInput(draft=draft), store, now=_NOW
    )
    assert result.ok is True
    assert result.artifact_id and result.revision_id
    return result.artifact_id, result.revision_id


def test_create_validate_publish(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    artifact_id, revision_id = _create(store, VALID_DRAFT)

    preview = render_preview(RenderPreviewInput(artifact_id=artifact_id, revision_id=revision_id), store)
    assert preview.preview_url == f"/preview/{artifact_id}/{revision_id}"

    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id=artifact_id, revision_id=revision_id, slug="workflow-automation"
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is True
    assert store.read_publications()["workflow-automation"].revision_id == revision_id


def test_policy_invalid_saves_draft_not_published(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    result = create_capability_page(CreateCapabilityPageInput(draft=draft), store, now=_NOW)
    assert result.ok is False
    assert any(d["severity"] == "error" for d in result.diagnostics)
    # the revision is saved as a draft (so the agent can iterate)
    env = store.read_artifact("workflow-automation", result.revision_id or "rev-001")
    assert env.status == "draft"
    # ...but cannot be published
    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id="capability-page.workflow-automation",
            revision_id=result.revision_id or "rev-001",
            slug="workflow-automation",
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is False


def test_publish_requires_exact_validated_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    artifact_id, _ = _create(store, VALID_DRAFT)
    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id=artifact_id, revision_id="rev-999", slug="workflow-automation"
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is False
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_service.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement tool models + service**

Create `py/morphe_cms/tools/models.py`:

```python
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.contracts.shared import CmsModel, DialectName, Slug


class CreateCapabilityPageInput(CmsModel):
    draft: CapabilityPageDraft
    rationale: Annotated[str | None, Field(max_length=800)] = None


class ToolResult(CmsModel):
    ok: bool
    artifact_id: str | None = None
    revision_id: str | None = None
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)


class ValidateContentArtifactInput(CmsModel):
    artifact_id: str
    revision_id: str
    strict: bool = True


class RenderPreviewInput(CmsModel):
    artifact_id: str
    revision_id: str
    viewport: Literal["mobile", "desktop"] = "desktop"
    dialect: DialectName | None = None


class RenderPreviewResult(CmsModel):
    ok: bool
    preview_url: str | None = None
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)


class PublishContentArtifactInput(CmsModel):
    artifact_id: str
    revision_id: str
    slug: Slug
    channel: Literal["site", "preview", "campaign"] = "site"
```

Create `py/morphe_cms/tools/service.py`:

```python
from __future__ import annotations

from morphe_cms.contracts.artifact import ArtifactEnvelope, ArtifactProvenance, Publication
from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.presenter.capability_page import PRESENTER_VERSION
from morphe_cms.store.files import FileStore
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    RenderPreviewInput,
    RenderPreviewResult,
    ToolResult,
    ValidateContentArtifactInput,
)
from morphe_cms.validation.gate import compile_and_gate

SCHEMA_VERSION = "0.1.0"


def _artifact_id(slug: str) -> str:
    return f"capability-page.{slug}"


def create_capability_page(
    payload: CreateCapabilityPageInput, store: FileStore, *, now: str
) -> ToolResult:
    draft = payload.draft
    slug = draft.slug
    artifact_id = _artifact_id(slug)
    revision_id = store.next_revision_id(slug)

    compiled, diagnostics = compile_and_gate(
        draft, artifact_id=artifact_id, revision_id=revision_id, compiled_at=now
    )
    status = "validated" if compiled is not None else "draft"

    envelope = ArtifactEnvelope(
        id=artifact_id,
        type="capabilityPage",
        schema_version=SCHEMA_VERSION,
        presenter_version=PRESENTER_VERSION,
        status=status,
        data=draft.model_dump(mode="json"),
        provenance=ArtifactProvenance(
            created_by="agent", source_ids=list(draft.source_ids), created_at=now
        ),
    )
    store.write_artifact(slug, revision_id, envelope)
    store.write_diagnostics(slug, revision_id, diagnostics)
    if compiled is not None:
        store.write_compiled(slug, revision_id, compiled)

    return ToolResult(
        ok=compiled is not None,
        artifact_id=artifact_id,
        revision_id=revision_id,
        diagnostics=[d.model_dump() for d in diagnostics],
    )


def validate_content_artifact(
    payload: ValidateContentArtifactInput, store: FileStore
) -> ToolResult:
    slug = payload.artifact_id.removeprefix("capability-page.")
    envelope = store.read_artifact(slug, payload.revision_id)
    draft = CapabilityPageDraft.model_validate(envelope.data)
    compiled, diagnostics = compile_and_gate(
        draft, artifact_id=payload.artifact_id, revision_id=payload.revision_id
    )
    return ToolResult(
        ok=compiled is not None,
        artifact_id=payload.artifact_id,
        revision_id=payload.revision_id,
        diagnostics=[d.model_dump() for d in diagnostics],
    )


def render_preview(payload: RenderPreviewInput, store: FileStore) -> RenderPreviewResult:
    slug = payload.artifact_id.removeprefix("capability-page.")
    if not store.has_validated_revision(slug, payload.revision_id):
        return RenderPreviewResult(
            ok=False,
            diagnostics=[
                {
                    "code": "NO_COMPILED_TREE",
                    "severity": "error",
                    "path": "revision_id",
                    "message": "No compiled tree exists for this revision; validate it first.",
                }
            ],
        )
    return RenderPreviewResult(
        ok=True, preview_url=f"/preview/{payload.artifact_id}/{payload.revision_id}"
    )


def publish_content_artifact(
    payload: PublishContentArtifactInput, store: FileStore, *, now: str
) -> ToolResult:
    slug = payload.slug
    if not store.has_validated_revision(slug, payload.revision_id):
        return ToolResult(
            ok=False,
            artifact_id=payload.artifact_id,
            revision_id=payload.revision_id,
            diagnostics=[
                {
                    "code": "REVISION_NOT_VALIDATED",
                    "severity": "error",
                    "path": "revision_id",
                    "message": "Publish requires a revision with a stored, gate-passing compiled tree.",
                }
            ],
        )
    store.publish(
        slug,
        Publication(
            slug=slug,
            artifact_id=payload.artifact_id,
            revision_id=payload.revision_id,
            channel=payload.channel,
            published_at=now,
            published_by="agent",
        ),
    )
    return ToolResult(ok=True, artifact_id=payload.artifact_id, revision_id=payload.revision_id)
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_service.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/tools/models.py py/morphe_cms/tools/service.py py/tests/test_cms_service.py
git commit -m "feat(cms): tool service — create/validate/preview/publish over the store"
```

---

## Task 10: FastAPI app + fastapi-mcp + error handler

**Files:**
- Create: `py/morphe_cms/mcp/app.py`
- Test: `py/tests/test_cms_mcp.py`

- [ ] **Step 1: Write failing tests**

Create `py/tests/test_cms_mcp.py`:

```python
from __future__ import annotations

import copy
from pathlib import Path

from fastapi.testclient import TestClient

from morphe_cms.mcp.app import build_app

from .cms_fixtures import VALID_DRAFT


def _client(tmp_path: Path) -> TestClient:
    return TestClient(build_app(root=tmp_path))


def test_create_endpoint_happy_path(tmp_path: Path) -> None:
    client = _client(tmp_path)
    resp = client.post("/tools/create_capability_page", json={"draft": VALID_DRAFT})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["artifact_id"] == "capability-page.workflow-automation"


def test_schema_invalid_returns_diagnostics_not_persisted(tmp_path: Path) -> None:
    client = _client(tmp_path)
    bad = copy.deepcopy(VALID_DRAFT)
    bad["cta"] = {"label": "Go", "intent": "primary-action"}  # no action_id/href
    resp = client.post("/tools/create_capability_page", json={"draft": bad})
    assert resp.status_code == 422
    body = resp.json()
    # custom handler shape: {ok, diagnostics:[{code,severity,path,message}]}
    assert body["ok"] is False
    assert body["diagnostics"]
    assert all(d["severity"] == "error" for d in body["diagnostics"])
    # nothing persisted
    assert not (tmp_path / "content").exists()


def test_mcp_mounted(tmp_path: Path) -> None:
    client = _client(tmp_path)
    # fastapi-mcp mounts an SSE/HTTP endpoint at /mcp; it should not 404.
    resp = client.get("/mcp")
    assert resp.status_code != 404
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_mcp.py -v`
Expected: FAIL (ImportError).

- [ ] **Step 3: Implement `app.py`**

Create `py/morphe_cms/mcp/app.py`. (If the `mcp.mount()` call signature differs in the installed `fastapi-mcp` version, adjust per its README — the endpoints + handler below are the stable part.)

```python
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi_mcp import FastApiMCP

from morphe_cms.store.files import FileStore
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    RenderPreviewInput,
    RenderPreviewResult,
    ToolResult,
    ValidateContentArtifactInput,
)
from morphe_cms.tools.service import (
    create_capability_page,
    publish_content_artifact,
    render_preview,
    validate_content_artifact,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def build_app(root: Path | None = None) -> FastAPI:
    store = FileStore(Path(root) if root is not None else Path.cwd())
    app = FastAPI(title="Morphe CMS", version="0.1.0")

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # Schema-invalid tool calls -> repairable diagnostics, NOT persisted.
        diagnostics = [
            {
                "code": str(err["type"]).upper().replace(".", "_"),
                "severity": "error",
                "path": ".".join(str(p) for p in err["loc"]),
                "message": err["msg"],
                "repair_hint": "Fix this field to satisfy the tool schema, then resubmit.",
            }
            for err in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"ok": False, "diagnostics": diagnostics})

    @app.post("/tools/create_capability_page", operation_id="createCapabilityPage")
    def _create(body: CreateCapabilityPageInput) -> ToolResult:
        return create_capability_page(body, store, now=_now())

    @app.post("/tools/validate_content_artifact", operation_id="validateContentArtifact")
    def _validate(body: ValidateContentArtifactInput) -> ToolResult:
        return validate_content_artifact(body, store)

    @app.post("/tools/render_preview", operation_id="renderPreview")
    def _preview(body: RenderPreviewInput) -> RenderPreviewResult:
        return render_preview(body, store)

    @app.post("/tools/publish_content_artifact", operation_id="publishContentArtifact")
    def _publish(body: PublishContentArtifactInput) -> ToolResult:
        return publish_content_artifact(body, store, now=_now())

    FastApiMCP(app).mount()
    return app


app = build_app()
```

- [ ] **Step 4: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_mcp.py -v`
Expected: PASS (3 tests). If `GET /mcp` returns a method-not-allowed rather than 404 that's fine (the assertion is `!= 404`).

- [ ] **Step 5: Commit**

```bash
git add py/morphe_cms/mcp/app.py py/tests/test_cms_mcp.py
git commit -m "feat(cms): fastapi-mcp tool server with schema-error diagnostics handler"
```

---

## Task 11: Schema export + byte-stability gate

**Files:**
- Create: `py/morphe_cms/schema.py`
- Create: `schema/cms/*.schema.json` (generated)
- Modify: `Justfile`
- Test: `py/tests/test_cms_schema.py`

- [ ] **Step 1: Write failing test**

Create `py/tests/test_cms_schema.py`:

```python
from __future__ import annotations

from pathlib import Path

from morphe_cms.schema import artifact_documents


def test_committed_cms_schemas_are_byte_stable() -> None:
    root = Path(__file__).resolve().parents[2]  # repo root
    for rel_path, content in artifact_documents().items():
        committed = (root / rel_path).read_text(encoding="utf-8")
        assert committed == content, f"stale schema artifact: {rel_path} — run `just cms-schema-write`"
```

- [ ] **Step 2: Run to verify failure**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_schema.py -v`
Expected: FAIL (ImportError, then missing files).

- [ ] **Step 3: Implement `schema.py`**

Create `py/morphe_cms/schema.py` (mirrors `morphe_grammar/artifacts.py`):

```python
from __future__ import annotations

import json
import sys

from pydantic import BaseModel

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    ValidateContentArtifactInput,
)

_SCHEMAS: dict[str, type[BaseModel]] = {
    "schema/cms/capability-page.schema.json": CapabilityPageDraft,
    "schema/cms/create-capability-page.schema.json": CreateCapabilityPageInput,
    "schema/cms/validate-content-artifact.schema.json": ValidateContentArtifactInput,
    "schema/cms/publish-content-artifact.schema.json": PublishContentArtifactInput,
}


def _document(model: type[BaseModel]) -> str:
    schema = model.model_json_schema()
    return json.dumps(schema, ensure_ascii=True, indent=2, sort_keys=True) + "\n"


def artifact_documents() -> dict[str, str]:
    return {path: _document(model) for path, model in _SCHEMAS.items()}


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    documents = artifact_documents()
    if "--check" in args:
        stale = [p for p, c in documents.items() if (root / p).read_text(encoding="utf-8") != c]
        if stale:
            sys.stderr.write("stale CMS schema artifacts: " + ", ".join(stale) + "\n")
            return 1
        return 0
    if "--write" in args:
        for rel_path, content in documents.items():
            target = root / rel_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        return 0
    sys.stderr.write("usage: python -m morphe_cms.schema [--write|--check]\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Generate the committed schemas**

Run: `env -u PYTHONPATH uv run python -m morphe_cms.schema --write`
Expected: creates 4 files under `schema/cms/`. Verify: `ls schema/cms/`.

- [ ] **Step 5: Add Justfile targets**

In `Justfile`, after the existing `schema-write` target, add:

```justfile
# regenerate committed CMS contract schemas (after a py/morphe_cms contract change)
cms-schema-write:
	env -u PYTHONPATH uv run python -m morphe_cms.schema --write

# committed CMS schemas must equal a fresh emission
cms-schema-check:
	env -u PYTHONPATH uv run python -m morphe_cms.schema --check
```

Find the `gates` recipe and append `cms-schema-check` to its command list (after `schema-check`).

- [ ] **Step 6: Run to verify pass**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_cms_schema.py -v`
Expected: PASS.
Run: `just cms-schema-check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add py/morphe_cms/schema.py schema/cms Justfile py/tests/test_cms_schema.py
git commit -m "feat(cms): JSON Schema export + byte-stability gate"
```

---

## Task 12: SvelteKit preview route

**Files:**
- Create: `src/routes/preview/[artifactId]/[revisionId]/+page.server.ts`
- Create: `src/routes/preview/[artifactId]/[revisionId]/+page.svelte`

The server load reads the **one** compiled-tree file and returns `{ tree, dialectId }` (both serializable). The page resolves the dialect via `getDialect` and renders `MorpheRoot`.

- [ ] **Step 1: Implement the server load**

Create `src/routes/preview/[artifactId]/[revisionId]/+page.server.ts`:

```typescript
/*
 * /preview/<artifactId>/<revisionId> — renders a CMS compiled tree through the real
 * MorpheRoot. v0 reads the compiled-tree JSON the Python gate wrote (the boundary is
 * a file of validate_node-valid Node JSON). Local/dev only; production persistence is
 * the later-DB step (see docs/superpowers/specs/2026-06-22-morphe-agent-native-cms-design.md).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Node } from "$lib";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

interface CompiledTreeFile {
	tree: Node;
	render_hints: { dialect: string };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = params.artifactId.replace(/^capability-page\./, "");
	const path = join(
		process.cwd(),
		"compiled",
		"capability-pages",
		slug,
		`${params.revisionId}.tree.json`,
	);

	let parsed: CompiledTreeFile;
	try {
		parsed = JSON.parse(await readFile(path, "utf-8")) as CompiledTreeFile;
	} catch {
		throw error(404, `No compiled tree for ${params.artifactId}/${params.revisionId}`);
	}

	const dialectId = url.searchParams.get("dialect") ?? parsed.render_hints.dialect;
	return { tree: parsed.tree, dialectId };
};
```

- [ ] **Step 2: Implement the page**

Create `src/routes/preview/[artifactId]/[revisionId]/+page.svelte`:

```svelte
<script lang="ts">
	import { getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const dialect = $derived(getDialect(data.dialectId));
</script>

<MorpheRoot tree={data.tree} {dialect} />
```

- [ ] **Step 3: Verify the route type-checks**

Run: `bun run check`
Expected: no type errors in the new route files. (End-to-end visual verification happens after Task 13 generates a committed fixture and the render-smoke runs. To eyeball it live: create a page via the MCP `create` tool, then `bun run dev` and visit `/preview/capability-page.<slug>/rev-001`.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/preview
git commit -m "feat(cms): /preview route renders a compiled tree via MorpheRoot"
```

---

## Task 13: Publication route + Vitest render-smoke

**Files:**
- Create: `src/routes/p/[slug]/+page.server.ts`
- Create: `src/routes/p/[slug]/+page.svelte`
- Create: `src/lib/cms/fixtures/capability-page.tree.json`
- Create: `src/lib/cms/render-smoke.test.ts`

- [ ] **Step 1: Implement the publication route server load**

Create `src/routes/p/[slug]/+page.server.ts`:

```typescript
/*
 * /p/<slug> — the public publication pointer. Resolves publications.json -> revision ->
 * compiled tree -> MorpheRoot. Publishing is pointer movement; this route follows it.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Node } from "$lib";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

interface PublicationFile {
	revision_id: string;
}
interface CompiledTreeFile {
	tree: Node;
	render_hints: { dialect: string };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const root = process.cwd();
	let publications: Record<string, PublicationFile>;
	try {
		publications = JSON.parse(await readFile(join(root, "publications.json"), "utf-8"));
	} catch {
		throw error(404, "No publications");
	}
	const pub = publications[params.slug];
	if (!pub) throw error(404, `No publication for ${params.slug}`);

	const path = join(root, "compiled", "capability-pages", params.slug, `${pub.revision_id}.tree.json`);
	let parsed: CompiledTreeFile;
	try {
		parsed = JSON.parse(await readFile(path, "utf-8")) as CompiledTreeFile;
	} catch {
		throw error(404, `Missing compiled tree for ${params.slug}`);
	}

	const dialectId = url.searchParams.get("dialect") ?? parsed.render_hints.dialect;
	return { tree: parsed.tree, dialectId };
};
```

- [ ] **Step 2: Implement the publication page**

Create `src/routes/p/[slug]/+page.svelte`:

```svelte
<script lang="ts">
	import { getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const dialect = $derived(getDialect(data.dialectId));
</script>

<MorpheRoot tree={data.tree} {dialect} />
```

- [ ] **Step 3: Generate a committed render-smoke fixture**

Run (from repo root, writes into a temp store then copies the tree):

```bash
env -u PYTHONPATH uv run python - <<'PY'
import json, sys
sys.path.insert(0, "py")
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("cms_fixtures", "py/tests/cms_fixtures.py")
fx = importlib.util.module_from_spec(spec); spec.loader.exec_module(fx)
from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.presenter.capability_page import present_capability_page
draft = CapabilityPageDraft.model_validate(fx.VALID_DRAFT)
tree = present_capability_page(draft)
out = Path("src/lib/cms/fixtures/capability-page.tree.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(tree, indent=2) + "\n", encoding="utf-8")
print("wrote", out)
PY
```

- [ ] **Step 4: Write the Vitest SSR render-smoke**

Create `src/lib/cms/render-smoke.test.ts`:

```typescript
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import { MorpheRoot } from "$lib/components";
import tree from "./fixtures/capability-page.tree.json";

describe("CMS compiled tree render-smoke", () => {
	it("renders a compiled CapabilityPage tree without throwing", () => {
		expect(() => render(MorpheRoot, { props: { tree: tree as unknown as Node } })).not.toThrow();
	});
});
```

> If the repo's Vitest setup uses a different Svelte render helper, match the pattern already used in a neighbouring `*.test.ts` (search for an existing `render(` call). The assertion — "render does not throw on the fixture" — is the stable part.

- [ ] **Step 5: Run the smoke + check**

Run: `bun run test -- render-smoke`
Expected: PASS.
Run: `bun run check`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/p src/lib/cms
git commit -m "feat(cms): /p publication route + Vitest SSR render-smoke fixture"
```

---

## Task 14: Wire into gates + full-suite verification

**Files:**
- Verify only (no new source).

- [ ] **Step 1: Run the full Python suite**

Run: `env -u PYTHONPATH uv run pytest -v`
Expected: all CMS tests PASS alongside existing `morphe_grammar`/`morphe_agent` tests.

- [ ] **Step 2: Run Python lint + types**

Run: `env -u PYTHONPATH uv run ruff check py/morphe_cms`
Run: `env -u PYTHONPATH uv run ty check`
Expected: clean (fix any findings; `ruff format py/morphe_cms` if formatting differs).

- [ ] **Step 3: Run the TS gates**

Run: `bun run lint`
Run: `bun run check`
Run: `bun run test`
Expected: clean.

- [ ] **Step 4: Run the full gate aggregate**

Run: `just gates`
Expected: all green (lint, check, test, build, py-test, py-lint, py-types, schema-check, cms-schema-check).

- [ ] **Step 5: Add `content/` and `compiled/` to `.gitignore` (dev artifacts)**

In `.gitignore`, add (if not present):

```gitignore
/content/
/compiled/
/publications.json
```

(Committed schema fixtures live under `schema/cms/` and `src/lib/cms/fixtures/`; runtime content/compiled/publications are local dev artifacts in v0.)

- [ ] **Step 6: Final commit**

```bash
git add .gitignore
git commit -m "chore(cms): ignore local content/compiled artifacts; v0 gate green"
```

---

## Acceptance (maps to spec §10 / PRD §24)

- [ ] Pydantic defines `CapabilityPageDraft` + shared contracts, reconciled to the live substrate.
- [ ] JSON Schema emitted for the create tool (and friends), committed, byte-stable.
- [ ] An agent can create a versioned `CapabilityPage` via MCP (`createCapabilityPage`).
- [ ] Invalid drafts return structured `Diagnostic`s; schema-invalid not persisted, policy/grammar-invalid saved as `draft`.
- [ ] Valid drafts compile to `Node` trees that pass `validate_node`.
- [ ] `/preview` and `/p/[slug]` render through the real `MorpheRoot`.
- [ ] Publish points a slug to an immutable validated revision; rollback repoints.
- [ ] Publish fails unless the exact revision has a stored compiled tree.
- [ ] No raw CSS/hex/class/DOM/component-ref is representable (closed Literals + `extra="forbid"`).
- [ ] Happy-path and rejection-path tests pass; Vitest render-smoke passes; `just gates` green.

---

## Notes for the executor

- **fastapi-mcp API drift:** the `FastApiMCP(app).mount()` call in Task 10 is the documented pattern, but pin to the installed version's README if the constructor/mount signature differs. The FastAPI endpoints + the `RequestValidationError` handler are version-stable and are what the tests assert against.
- **Timestamps:** the tool service takes `now` as an injected parameter so tests are deterministic; only `mcp/app.py` calls the real clock. Do not call `datetime.now()` inside the service or presenter.
- **Determinism:** the presenter must stay pure (no clock/RNG/IO). The determinism test in Task 6 guards this.
- **Out of scope (iteration 2+):** `reviseContentArtifact`, `proposeCompound`, asset model, additional content types, DB persistence, production-Vercel content reads, human UI, auth. Don't build these now.

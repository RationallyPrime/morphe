# Model Surface Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `morphe_surface`, a read-only compiler that renders a JSON Schema (+ optional data instance) into a validated Morphe `Node` tree, parallel to the editorial `morphe_cms`.

**Architecture:** Two-stage pure pipeline `schema → SurfaceSpec → Node`. Stage 1 (`build_surface`) resolves every render decision through a single closed-enum `resolve_strategy()` chokepoint and emits a typed recursive `SurfaceNode`. Stage 2 (`emit_node`) mechanically renders `SurfaceNode → Node` dicts. Shared substrate contracts move into a new thin `morphe_contracts` so `morphe_cms` and `morphe_surface` are independent siblings over `morphe_grammar`. Authoritative design: `docs/adr/0014-model-surface-compiler.md`.

**Tech Stack:** Python 3.12+, Pydantic v2, uv workspace (`module-root = py`), pytest (+ hypothesis for the totality property test), ruff (`select = ALL`, line 100, double quotes), ty.

## Global Constraints

- Python `>=3.12`; Pydantic `>=2.12`. One line each, copied from `pyproject.toml`.
- `Node` is a plain `dict[str, Any]`; every emitted tree MUST pass `morphe_grammar.validate_node` (raises on invalid).
- The compiler is a **pure deterministic function**: no clock, no RNG, no I/O. `compile_surface(x) == compile_surface(x)` byte-for-byte. Timestamps are passed in, never read.
- **Totality (ADR-0014 D8):** an unrenderable construct emits a diagnostic node **and** a `Diagnostic` list entry; it never raises and never silently drops a field.
- **Read-only (D4):** emit only non-interactive nodes — `Frame/Stack/Grid/Cluster/Text/NumberNode/Badge/Icon/Status/InlineAlert/Disclosure/Link/Within/Vary`. Never `Field/Select/Toggle/Range/Button`.
- Run tests with `env -u PYTHONPATH uv run pytest` (the leading-colon PYTHONPATH footgun breaks `ty`/import resolution). Lint `uv run ruff check`; types `uv run ty check`.
- Ruff `select = ALL`; `S101` (assert) and `D1xx` (docstrings) are already ignored. Match existing module style in `py/morphe_cms`.

## Module Map

```
py/morphe_contracts/__init__.py     ContractModel, Diagnostic, IntentRef, SurfaceRef,
                                    EmphasisClaim, RenderHints, MorpheControls,
                                    ArtifactProvenance, CompiledArtifact
py/morphe_surface/__init__.py       public exports: compile_surface, surface_from_model
py/morphe_surface/strategies.py     Strategy (closed Literal enum), Priority
py/morphe_surface/spec.py           SurfaceNode (recursive Pydantic IR)
py/morphe_surface/hints.py          MorpheHint, parse_hint(schema)
py/morphe_surface/refs.py           resolve_ref(schema, root), schema_type(schema)
py/morphe_surface/resolve.py        resolve_strategy(schema, data, hint) -> Strategy
py/morphe_surface/build.py          build_surface(...) -> SurfaceNode  (stage 1)
py/morphe_surface/emit.py           emit_node(spec) -> Node            (stage 2)
py/morphe_surface/adapters.py       from_pydantic, from_envelope, surface_from_model
py/morphe_surface/compile.py        compile_surface(...) -> CompiledSurface
py/tests/test_contracts_promotion.py
py/tests/test_surface_*.py
```

**Canonical signatures (used across tasks — keep names/types exact):**

```python
Strategy = Literal["scalar","badge","record-card","collapsed-section","linked-ref",
                   "table","card-stack","diagnostic-node"]
Priority = Literal["hero","primary","secondary"]

class MorpheHint(ContractModel):
    strategy: Strategy | None = None
    section: str | None = None
    priority: Priority = "primary"
    label: str | None = None
    role: IntentRef | None = None
    collapse: bool | None = None

class SurfaceNode(ContractModel):
    path: str
    label: str
    strategy: Strategy
    value: str | int | float | bool | None = None
    intent: IntentRef | None = None
    href: str | None = None
    collapse: bool | None = None
    children: tuple[SurfaceNode, ...] = ()
    items: tuple[SurfaceNode, ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()

def parse_hint(schema: dict[str, object]) -> MorpheHint: ...
def resolve_strategy(schema: dict, data: object, hint: MorpheHint) -> Strategy: ...
def build_surface(schema: dict, data: object, *, root: dict, path: str = "$",
                  label: str = "", diagnostics: dict[str, list[Diagnostic]] | None = None,
                  depth: int = 0, seen: frozenset[str] = frozenset()) -> SurfaceNode: ...
def emit_node(spec: SurfaceNode) -> dict[str, object]: ...
def compile_surface(schema: dict, data: object | None = None, *,
                    diagnostics: list[Diagnostic] | None = None,
                    grammar_version: str = "0.1.0", compiler_version: str = "0.1.0",
                    compiled_at: str = "") -> CompiledSurface: ...
```

**MAX_DEPTH = 6** (D9 backstop, mirrors the compound depth bound).

---

## Milestone A — `morphe_contracts` promotion (prerequisite refactor)

### Task A1: Create `morphe_contracts` with the promoted primitives

**Files:**
- Create: `py/morphe_contracts/__init__.py`
- Modify: `pyproject.toml` (`[tool.uv.build-backend].module-name`, `[tool.ty.src].include`)
- Test: `py/tests/test_contracts_promotion.py`

**Interfaces:**
- Produces: `ContractModel`, `Diagnostic`, `IntentRef`, `SurfaceRef`, `EmphasisClaim`, `RenderHints`, `MorpheControls`, `ArtifactProvenance`, `CompiledArtifact`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_contracts_promotion.py
from __future__ import annotations

from morphe_contracts import CompiledArtifact, ContractModel, Diagnostic


def test_diagnostic_shape_matches_affordance_contract() -> None:
    d = Diagnostic(code="X", severity="error", path="$.a", message="bad")
    assert d.severity == "error"
    assert d.repair_hint is None


def test_contract_model_forbids_extra() -> None:
    import pytest
    from pydantic import ValidationError

    class M(ContractModel):
        a: int

    with pytest.raises(ValidationError):
        M(a=1, b=2)  # ty: ignore[unexpected-keyword-argument]


def test_compiled_artifact_base_fields() -> None:
    art = CompiledArtifact(
        tree={"kind": "spacer"},
        grammar_version="0.1.0",
        producer_version="0.1.0",
        diagnostics=[],
        produced_at="",
    )
    assert art.tree["kind"] == "spacer"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_contracts_promotion.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'morphe_contracts'`

- [ ] **Step 3: Create the package**

```python
# py/morphe_contracts/__init__.py
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

IntentRef = Literal[
    "primary-action", "neutral", "provenance", "evidence",
    "accession", "caution", "success", "info",
]
SurfaceRef = Literal["base", "raised", "sunken"]
EmphasisClaim = Literal["muted", "normal", "strong", "critical"]
DialectName = Literal[
    "gallery", "night", "icelandic-archive", "clinical", "reykjavik-registry",
    "timaeus", "ledger", "estate", "foundry",
]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Diagnostic(ContractModel):
    code: str
    severity: Literal["error", "warning", "info"]
    path: str
    message: str
    repair_hint: str | None = None


class RenderHints(ContractModel):
    dialect: DialectName = "gallery"


class MorpheControls(ContractModel):
    dialect: DialectName = "gallery"
    primary_intent: IntentRef = "evidence"
    surface: SurfaceRef = "base"
    emphasis: EmphasisClaim = "normal"


class ArtifactProvenance(ContractModel):
    created_by: Literal["agent", "human", "migration"]
    prompt_id: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    created_at: str


class CompiledArtifact(ContractModel):
    tree: dict[str, Any]
    grammar_version: str
    producer_version: str
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    produced_at: str
```

Then register the module in `pyproject.toml`:

```toml
# [tool.uv.build-backend]
module-name = ["morphe_grammar", "morphe_agent", "morphe_cms", "morphe_contracts", "morphe_surface"]

# [tool.ty.src]
include = ["py/morphe_grammar", "py/morphe_agent", "py/morphe_cms", "py/morphe_surface", "py/morphe_contracts", "py/tests"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_contracts_promotion.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add py/morphe_contracts/__init__.py py/tests/test_contracts_promotion.py pyproject.toml
git commit -m "feat(contracts): add morphe_contracts base package"
```

---

### Task A2: Rewire `morphe_cms` onto `morphe_contracts`

**Files:**
- Modify: `py/morphe_cms/contracts/shared.py` (re-export from contracts; keep `Audience`, `Slug`, `CmsModel` alias)
- Modify: `py/morphe_cms/contracts/artifact.py` (import `ArtifactProvenance` from contracts; make `CompiledTree` extend `CompiledArtifact`)
- Test: existing `py/tests/test_cms_presenter.py` and `py/tests/test_agent_sidecar.py` must stay green.

**Interfaces:**
- Consumes: everything from Task A1.
- Produces: `morphe_cms.contracts.shared` continues to export `Diagnostic`, `RenderHints`, `MorpheControls`, `IntentRef`, … (now re-exported), plus cms-only `Audience`, `Slug`, `CmsModel`.

- [ ] **Step 1: Write the failing test**

```python
# append to py/tests/test_contracts_promotion.py
def test_cms_reexports_are_the_promoted_types() -> None:
    from morphe_cms.contracts.shared import Diagnostic as CmsDiagnostic
    from morphe_contracts import Diagnostic as BaseDiagnostic

    assert CmsDiagnostic is BaseDiagnostic
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_contracts_promotion.py::test_cms_reexports_are_the_promoted_types -v`
Expected: FAIL — `assert CmsDiagnostic is BaseDiagnostic` (two distinct classes)

- [ ] **Step 3: Rewire cms shared + artifact**

Replace the promoted definitions in `py/morphe_cms/contracts/shared.py` with re-exports, keeping only cms-specific symbols:

```python
# py/morphe_cms/contracts/shared.py
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from morphe_contracts import (
    ContractModel,
    Diagnostic,
    DialectName,
    EmphasisClaim,
    IntentRef,
    MorpheControls,
    RenderHints,
    SurfaceRef,
)

__all__ = [
    "Audience", "CmsModel", "Diagnostic", "DialectName", "EmphasisClaim",
    "IntentRef", "MorpheControls", "RenderHints", "Slug", "SurfaceRef",
]

CmsModel = ContractModel  # back-compat alias for existing cms imports

Audience = Literal[
    "founder", "operator", "cto", "cfo", "operations_lead", "developer", "buyer",
]
Slug = Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
```

In `py/morphe_cms/contracts/artifact.py`, import provenance from contracts and base `CompiledTree` on `CompiledArtifact` (keeping its extra fields, renaming `grammar_version`/`tree`/`diagnostics`/`compiled_at` onto the base):

```python
# py/morphe_cms/contracts/artifact.py  (relevant edits)
from morphe_contracts import ArtifactProvenance, CompiledArtifact

from .shared import CmsModel, Diagnostic, RenderHints  # noqa: F401

class CompiledTree(CompiledArtifact):
    artifact_id: str
    revision_id: str
    presenter_version: str
    render_hints: RenderHints
    # inherited: tree, grammar_version, producer_version, diagnostics, produced_at
```

Update `py/morphe_cms/validation/gate.py` construction of `CompiledTree` to the new field names: `producer_version=PRESENTER_VERSION`, `produced_at=compiled_at` (drop the now-inherited `presenter_version=`/`compiled_at=` kwargs, set `presenter_version` as the extra field too).

```python
    compiled = CompiledTree(
        artifact_id=artifact_id,
        revision_id=revision_id,
        grammar_version=GRAMMAR_VERSION,
        producer_version=PRESENTER_VERSION,
        presenter_version=PRESENTER_VERSION,
        tree=tree,
        render_hints=RenderHints(dialect=draft.morphe.dialect),
        diagnostics=diagnostics,
        produced_at=compiled_at,
    )
```

- [ ] **Step 4: Run the full suite to verify green**

Run: `env -u PYTHONPATH uv run pytest`
Expected: PASS (all existing tests + the new promotion test). If a cms test references `CompiledTree.compiled_at`, update it to `produced_at`.

- [ ] **Step 5: Regenerate cms schema artifacts + lint + types**

Run:
```bash
env -u PYTHONPATH uv run python -m morphe_cms.schema --write
env -u PYTHONPATH uv run ruff check --fix py/morphe_cms py/morphe_contracts
env -u PYTHONPATH uv run ty check
```
Expected: schema regenerates (commit the diff if any), ruff clean, ty clean.

- [ ] **Step 6: Commit**

```bash
git add py/morphe_cms py/morphe_contracts py/tests/test_contracts_promotion.py
git commit -m "refactor(cms): depend on morphe_contracts; CompiledTree extends CompiledArtifact"
```

---

## Milestone B — `morphe_surface` compiler

### Task B1: Strategy enum + `SurfaceNode` IR + `MorpheHint`

**Files:**
- Create: `py/morphe_surface/__init__.py`, `py/morphe_surface/strategies.py`, `py/morphe_surface/spec.py`, `py/morphe_surface/hints.py`
- Test: `py/tests/test_surface_spec.py`

**Interfaces:**
- Produces: `Strategy`, `Priority`, `SurfaceNode`, `MorpheHint`, `parse_hint`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_surface_spec.py
from __future__ import annotations

from morphe_surface.hints import parse_hint
from morphe_surface.spec import SurfaceNode


def test_surfacenode_is_recursive_and_frozen_extra() -> None:
    node = SurfaceNode(
        path="$", label="Root", strategy="record-card",
        children=(SurfaceNode(path="$.a", label="A", strategy="scalar", value="x"),),
    )
    assert node.children[0].value == "x"


def test_parse_hint_reads_x_morphe_block() -> None:
    hint = parse_hint({"x-morphe": {"section": "Compliance", "priority": "secondary",
                                     "collapse": True, "strategy": "table"}})
    assert hint.section == "Compliance"
    assert hint.priority == "secondary"
    assert hint.collapse is True
    assert hint.strategy == "table"


def test_parse_hint_defaults_when_absent() -> None:
    hint = parse_hint({"type": "string"})
    assert hint.strategy is None
    assert hint.priority == "primary"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_spec.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'morphe_surface'`

- [ ] **Step 3: Implement the three modules**

```python
# py/morphe_surface/strategies.py
from __future__ import annotations

from typing import Literal

Strategy = Literal[
    "scalar", "badge", "record-card", "collapsed-section",
    "linked-ref", "table", "card-stack", "diagnostic-node",
]
Priority = Literal["hero", "primary", "secondary"]
```

```python
# py/morphe_surface/spec.py
from __future__ import annotations

from morphe_contracts import ContractModel, Diagnostic, IntentRef

from .strategies import Strategy


class SurfaceNode(ContractModel):
    path: str
    label: str
    strategy: Strategy
    value: str | int | float | bool | None = None
    intent: IntentRef | None = None
    href: str | None = None
    collapse: bool | None = None
    children: tuple["SurfaceNode", ...] = ()
    items: tuple["SurfaceNode", ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()


SurfaceNode.model_rebuild()
```

```python
# py/morphe_surface/hints.py
from __future__ import annotations

from morphe_contracts import ContractModel, IntentRef

from .strategies import Priority, Strategy


class MorpheHint(ContractModel):
    strategy: Strategy | None = None
    section: str | None = None
    priority: Priority = "primary"
    label: str | None = None
    role: IntentRef | None = None
    collapse: bool | None = None


def parse_hint(schema: dict[str, object]) -> MorpheHint:
    raw = schema.get("x-morphe")
    if not isinstance(raw, dict):
        raw = {}
    return MorpheHint.model_validate(raw)
```

```python
# py/morphe_surface/__init__.py
from __future__ import annotations

from .hints import MorpheHint, parse_hint
from .spec import SurfaceNode
from .strategies import Priority, Strategy

__all__ = ["MorpheHint", "Priority", "Strategy", "SurfaceNode", "parse_hint"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_spec.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add py/morphe_surface py/tests/test_surface_spec.py
git commit -m "feat(surface): add Strategy enum, SurfaceNode IR, x-morphe hint parser"
```

---

### Task B2: `$ref` resolution + `resolve_strategy` chokepoint

**Files:**
- Create: `py/morphe_surface/refs.py`, `py/morphe_surface/resolve.py`
- Test: `py/tests/test_surface_resolve.py`

**Interfaces:**
- Consumes: `MorpheHint` (B1).
- Produces: `resolve_ref(schema, root)`, `schema_type(schema)`, `resolve_strategy(schema, data, hint) -> Strategy`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_surface_resolve.py
from __future__ import annotations

from morphe_surface.hints import MorpheHint
from morphe_surface.refs import resolve_ref, schema_type
from morphe_surface.resolve import resolve_strategy

ROOT = {"$defs": {"Addr": {"type": "object", "properties": {"city": {"type": "string"}}}}}


def test_resolve_ref_follows_defs() -> None:
    resolved = resolve_ref({"$ref": "#/$defs/Addr"}, ROOT)
    assert schema_type(resolved) == "object"


def test_hint_strategy_wins_over_structure() -> None:
    s = resolve_strategy({"type": "array", "items": {"type": "object"}},
                         data=[], hint=MorpheHint(strategy="card-stack"))
    assert s == "card-stack"


def test_object_resolves_record_card() -> None:
    s = resolve_strategy({"type": "object", "properties": {}}, data={}, hint=MorpheHint())
    assert s == "record-card"


def test_array_of_objects_resolves_table() -> None:
    s = resolve_strategy({"type": "array", "items": {"type": "object"}},
                         data=[{"a": 1}], hint=MorpheHint())
    assert s == "table"


def test_enum_resolves_badge() -> None:
    s = resolve_strategy({"enum": ["a", "b"]}, data="a", hint=MorpheHint())
    assert s == "badge"


def test_scalar_resolves_scalar() -> None:
    s = resolve_strategy({"type": "string"}, data="x", hint=MorpheHint())
    assert s == "scalar"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_resolve.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'morphe_surface.refs'`

- [ ] **Step 3: Implement refs + resolve**

```python
# py/morphe_surface/refs.py
from __future__ import annotations

from typing import Any


def resolve_ref(schema: dict[str, Any], root: dict[str, Any]) -> dict[str, Any]:
    ref = schema.get("$ref")
    if not isinstance(ref, str) or not ref.startswith("#/"):
        return schema
    node: Any = root
    for part in ref[2:].split("/"):
        if not isinstance(node, dict) or part not in node:
            return schema
        node = node[part]
    return node if isinstance(node, dict) else schema


def schema_type(schema: dict[str, Any]) -> str | None:
    t = schema.get("type")
    if isinstance(t, str):
        return t
    if "enum" in schema:
        return "enum"
    if "properties" in schema:
        return "object"
    return None
```

```python
# py/morphe_surface/resolve.py
from __future__ import annotations

from typing import Any

from .hints import MorpheHint
from .refs import schema_type
from .strategies import Strategy


def resolve_strategy(schema: dict[str, Any], data: object, hint: MorpheHint) -> Strategy:
    """Single chokepoint: (schema shape, data, hint) -> closed Strategy.

    Hints win over structural inference; structure is the hint-free floor.
    """
    if hint.strategy is not None:
        return hint.strategy
    if "enum" in schema:
        return "badge"
    t = schema_type(schema)
    if t == "object":
        return "record-card"
    if t == "array":
        items = schema.get("items")
        item_t = schema_type(items) if isinstance(items, dict) else None
        return "table" if item_t == "object" else "card-stack"
    if t in {"string", "integer", "number", "boolean"}:
        return "scalar"
    return "diagnostic-node"  # unrenderable -> totality (D8)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_resolve.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add py/morphe_surface/refs.py py/morphe_surface/resolve.py py/tests/test_surface_resolve.py
git commit -m "feat(surface): $ref resolution and the resolve_strategy chokepoint"
```

---

### Task B3: `build_surface` — scalars + record-card + nested collapse + embed/link + depth bound

**Files:**
- Create: `py/morphe_surface/build.py`
- Test: `py/tests/test_surface_build.py`

**Interfaces:**
- Consumes: `resolve_strategy`, `resolve_ref`, `parse_hint`, `SurfaceNode` (B1–B2).
- Produces: `build_surface(schema, data, *, root, path="$", label="", diagnostics=None, depth=0, seen=frozenset()) -> SurfaceNode`, `MAX_DEPTH`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_surface_build.py
from __future__ import annotations

from morphe_surface.build import MAX_DEPTH, build_surface

WORKER = {
    "type": "object",
    "title": "Worker",
    "properties": {
        "name": {"type": "string", "title": "Name"},
        "address": {"$ref": "#/$defs/Addr"},
        "manager_id": {"type": "string", "x-morphe": {"strategy": "linked-ref"}},
    },
    "$defs": {"Addr": {"type": "object", "title": "Address",
                       "properties": {"city": {"type": "string"}}}},
}


def _build(schema, data):
    return build_surface(schema, data, root=schema)


def test_record_card_has_scalar_child() -> None:
    spec = _build(WORKER, {"name": "Ada", "address": {"city": "Rvk"}, "manager_id": "w-9"})
    assert spec.strategy == "record-card"
    name = next(c for c in spec.children if c.path == "$.name")
    assert name.strategy == "scalar" and name.value == "Ada"


def test_embedded_object_is_collapsed_section() -> None:
    spec = _build(WORKER, {"name": "Ada", "address": {"city": "Rvk"}, "manager_id": "w-9"})
    addr = next(c for c in spec.children if c.path == "$.address")
    assert addr.strategy == "collapsed-section"
    assert addr.collapse is True
    assert addr.children[0].value == "Rvk"


def test_reference_field_is_linked_ref() -> None:
    spec = _build(WORKER, {"name": "Ada", "address": {"city": "Rvk"}, "manager_id": "w-9"})
    mgr = next(c for c in spec.children if c.path == "$.manager_id")
    assert mgr.strategy == "linked-ref"


def test_cycle_degrades_to_linked_ref() -> None:
    cyclic = {"type": "object", "title": "Node", "properties": {"parent": {"$ref": "#"}},
              "$id": "Node"}
    spec = build_surface(cyclic, {"parent": {"parent": {}}}, root=cyclic)
    parent = next(c for c in spec.children if c.path == "$.parent")
    # second visit of the same schema id -> linked-ref, not infinite recursion
    grand = next((c for c in parent.children if c.path == "$.parent.parent"), None)
    assert grand is None or grand.strategy == "linked-ref"


def test_depth_bound_is_finite() -> None:
    # deeply self-nesting data must terminate, never RecursionError
    cyclic = {"type": "object", "properties": {"next": {"$ref": "#"}}, "$id": "L"}
    data = {}
    for _ in range(MAX_DEPTH + 4):
        data = {"next": data}
    spec = build_surface(cyclic, data, root=cyclic)
    assert spec.strategy == "record-card"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_build.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'morphe_surface.build'`

- [ ] **Step 3: Implement `build_surface`**

```python
# py/morphe_surface/build.py
from __future__ import annotations

from typing import Any

from morphe_contracts import Diagnostic

from .hints import parse_hint
from .refs import resolve_ref, schema_type
from .resolve import resolve_strategy
from .spec import SurfaceNode

MAX_DEPTH = 6


def _label(schema: dict[str, Any], hint_label: str | None, fallback: str) -> str:
    if hint_label:
        return hint_label
    title = schema.get("title")
    return title if isinstance(title, str) else fallback


def _ref_id(schema: dict[str, Any]) -> str | None:
    rid = schema.get("$id") or schema.get("$ref")
    return rid if isinstance(rid, str) else None


def build_surface(
    schema: dict[str, Any],
    data: object,
    *,
    root: dict[str, Any],
    path: str = "$",
    label: str = "",
    diagnostics: dict[str, list[Diagnostic]] | None = None,
    depth: int = 0,
    seen: frozenset[str] = frozenset(),
) -> SurfaceNode:
    raw_id = _ref_id(schema)
    resolved = resolve_ref(schema, root)
    hint = parse_hint(schema) if "x-morphe" in schema else parse_hint(resolved)
    node_label = _label(resolved, hint.label, label or path.rsplit(".", 1)[-1])
    diags = tuple((diagnostics or {}).get(path, ()))

    strategy = resolve_strategy(resolved, data, hint)

    # D9 termination: a re-entered schema id, or the depth backstop, becomes a link.
    resolved_id = _ref_id(resolved) or raw_id
    if strategy in {"record-card", "collapsed-section"} and (
        depth >= MAX_DEPTH or (resolved_id is not None and resolved_id in seen)
    ):
        return SurfaceNode(path=path, label=node_label, strategy="linked-ref",
                           value=node_label, diagnostics=diags)

    if hint.strategy == "linked-ref" or strategy == "linked-ref":
        href = data if isinstance(data, str) else None
        return SurfaceNode(path=path, label=node_label, strategy="linked-ref",
                           value=href, href=None, diagnostics=diags)

    if strategy == "scalar":
        return SurfaceNode(path=path, label=node_label, strategy="scalar",
                           value=_as_scalar(data), diagnostics=diags)

    if strategy == "badge":
        return SurfaceNode(path=path, label=node_label, strategy="badge",
                           value=_as_scalar(data), diagnostics=diags)

    if strategy in {"record-card", "collapsed-section"}:
        next_seen = seen | ({resolved_id} if resolved_id else set())
        props = resolved.get("properties", {})
        children = tuple(
            build_surface(
                sub if isinstance(sub, dict) else {}, _get(data, key),
                root=root, path=f"{path}.{key}", label=str(key),
                diagnostics=diagnostics, depth=depth + 1, seen=next_seen,
            )
            for key, sub in (props.items() if isinstance(props, dict) else [])
        )
        # nested object (depth>0) collapses by default (D5); top object is a record-card
        is_section = depth > 0 and strategy != "record-card" or (depth > 0 and schema_type(resolved) == "object" and "x-morphe" not in schema and strategy == "record-card")
        eff_strategy = "collapsed-section" if (depth > 0 and schema_type(resolved) == "object") else "record-card"
        return SurfaceNode(
            path=path, label=node_label, strategy=eff_strategy,
            collapse=True if eff_strategy == "collapsed-section" and hint.collapse is not False else None,
            children=children, diagnostics=diags,
        )

    if strategy in {"table", "card-stack"}:
        items_schema = resolved.get("items")
        items_schema = items_schema if isinstance(items_schema, dict) else {}
        rows = data if isinstance(data, list) else []
        items = tuple(
            build_surface(items_schema, row, root=root, path=f"{path}[{i}]",
                          label=f"{node_label} {i}", diagnostics=diagnostics,
                          depth=depth + 1, seen=seen)
            for i, row in enumerate(rows)
        )
        return SurfaceNode(path=path, label=node_label, strategy=strategy,
                           items=items, diagnostics=diags)

    # totality (D8): unrenderable
    why = f"unrenderable: {schema_type(resolved) or 'unknown construct'}"
    return SurfaceNode(
        path=path, label=node_label, strategy="diagnostic-node", value=why,
        diagnostics=(*diags, Diagnostic(code="UNRENDERABLE", severity="warning",
                                        path=path, message=why)),
    )


def _get(data: object, key: str) -> object:
    return data.get(key) if isinstance(data, dict) else None


def _as_scalar(data: object) -> str | int | float | bool | None:
    if isinstance(data, (str, int, float, bool)) or data is None:
        return data
    return str(data)
```

> Note for the implementer: the two `eff_strategy`/`is_section` lines above are deliberately explicit so the embed-vs-link and depth rules read literally. Simplify to a single helper once the five `test_surface_build.py` cases are green — keep the tests green through the refactor.

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_build.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add py/morphe_surface/build.py py/tests/test_surface_build.py
git commit -m "feat(surface): build_surface — records, embed/link, collapse, depth bound"
```

---

### Task B4: collections — embedded list rows

**Files:**
- Modify: `py/tests/test_surface_build.py` (add cases; build.py already handles lists from B3)
- Test: `py/tests/test_surface_build.py`

**Interfaces:**
- Consumes: `build_surface` (B3).
- Produces: verified table/card-stack item specs.

- [ ] **Step 1: Write the failing test**

```python
# append to py/tests/test_surface_build.py
SCHEDULE = {
    "type": "object", "title": "Schedule",
    "properties": {
        "assignments": {"type": "array", "title": "Assignments",
                        "items": {"type": "object",
                                  "properties": {"worker": {"type": "string"}}}},
        "tags": {"type": "array", "items": {"type": "string"}},
    },
}


def test_object_list_is_table_with_rows() -> None:
    spec = _build(SCHEDULE, {"assignments": [{"worker": "Ada"}, {"worker": "Bo"}], "tags": []})
    a = next(c for c in spec.children if c.path == "$.assignments")
    assert a.strategy == "table"
    assert len(a.items) == 2
    assert a.items[0].children[0].value == "Ada"


def test_scalar_list_is_card_stack() -> None:
    spec = _build(SCHEDULE, {"assignments": [], "tags": ["x", "y"]})
    t = next(c for c in spec.children if c.path == "$.tags")
    assert t.strategy == "card-stack"
    assert [i.value for i in t.items] == ["x", "y"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_build.py -k table -v`
Expected: FAIL on `test_object_list_is_table_with_rows` if B3's list branch needs adjustment; if both pass immediately, B3 already covers it — proceed.

- [ ] **Step 3: Adjust `build_surface` list branch only if a case fails**

If `test_scalar_list_is_card_stack` shows items with empty `value`, ensure the scalar-item branch routes through `resolve_strategy({"type":"string"}, row, hint)`. No new code if green.

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_build.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add py/tests/test_surface_build.py py/morphe_surface/build.py
git commit -m "test(surface): cover embedded object/scalar collections"
```

---

### Task B5: `emit_node` — SurfaceNode → grammar Node (validates)

**Files:**
- Create: `py/morphe_surface/emit.py`
- Test: `py/tests/test_surface_emit.py`

**Interfaces:**
- Consumes: `SurfaceNode` (B1), `build_surface` (B3).
- Produces: `emit_node(spec: SurfaceNode) -> dict[str, object]`. Every output passes `validate_node`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_surface_emit.py
from __future__ import annotations

from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

WORKER = {
    "type": "object", "title": "Worker",
    "properties": {
        "name": {"type": "string", "title": "Name"},
        "status": {"enum": ["active", "leave"], "title": "Status"},
        "address": {"type": "object", "title": "Address",
                    "properties": {"city": {"type": "string", "title": "City"}}},
    },
}
DATA = {"name": "Ada", "status": "active", "address": {"city": "Rvk"}}


def test_record_card_emits_valid_frame() -> None:
    node = emit_node(build_surface(WORKER, DATA, root=WORKER))
    assert node["kind"] == "frame"
    assert node["role"] == "page"
    validate_node(node)


def test_scalar_emits_text() -> None:
    spec = build_surface({"type": "string", "title": "Name"}, "Ada", root={})
    node = emit_node(spec)
    assert node["kind"] == "text"
    assert node["value"] == "Ada"
    validate_node(node)


def test_enum_emits_badge() -> None:
    spec = build_surface({"enum": ["active"], "title": "Status"}, "active", root={})
    node = emit_node(spec)
    assert node["kind"] == "badge"
    assert node["label"] == "active"
    validate_node(node)


def test_collapsed_section_emits_within_collapse() -> None:
    node = emit_node(build_surface(WORKER, DATA, root=WORKER))
    addr = _find(node, lambda n: n.get("kind") == "within")
    assert addr is not None
    assert addr["dimension"] == "collapse"
    validate_node(node)


def _find(node, pred):
    if isinstance(node, dict):
        if pred(node):
            return node
        for v in node.values():
            r = _find(v, pred)
            if r is not None:
                return r
    elif isinstance(node, (list, tuple)):
        for v in node:
            r = _find(v, pred)
            if r is not None:
                return r
    return None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_emit.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'morphe_surface.emit'`

- [ ] **Step 3: Implement `emit_node`**

```python
# py/morphe_surface/emit.py
from __future__ import annotations

from typing import Any

from .spec import SurfaceNode

Node = dict[str, Any]


def emit_node(spec: SurfaceNode) -> Node:
    if spec.strategy == "scalar":
        return _labeled(spec, {"kind": "text", "value": _str(spec.value), "as": "body"})
    if spec.strategy == "badge":
        return {"kind": "badge", "label": _str(spec.value),
                "intent": spec.intent or "neutral"}
    if spec.strategy == "linked-ref":
        return {"kind": "link", "href": spec.href or "#", "label": spec.label}
    if spec.strategy == "diagnostic-node":
        return {"kind": "inline-alert", "tone": "caution", "title": spec.label,
                "detail": _str(spec.value)}
    if spec.strategy in {"table", "card-stack"}:
        return _stack(spec, [emit_node(i) for i in spec.items])
    if spec.strategy == "collapsed-section":
        inner = _stack(spec, [emit_node(c) for c in spec.children])
        return {"kind": "within", "id": spec.path, "dimension": "collapse",
                "range": [0, 1], "default": 1 if spec.collapse else 0, "children": [inner]}
    # record-card
    body = _stack(spec, [emit_node(c) for c in spec.children])
    return {"kind": "frame", "role": "page", "surface": "base", "children": [body]}


def _stack(spec: SurfaceNode, children: list[Node]) -> Node:
    head: Node = {"kind": "text", "value": spec.label, "as": "heading"}
    alerts = [{"kind": "inline-alert", "tone": _tone(d.severity), "title": d.code,
               "detail": d.message} for d in spec.diagnostics]
    return {"kind": "stack", "role": "section", "children": [head, *alerts, *children]}


def _labeled(spec: SurfaceNode, value_node: Node) -> Node:
    return {"kind": "stack", "role": "field-group", "children": [
        {"kind": "text", "value": spec.label, "as": "caption", "intent": "neutral"},
        value_node,
    ]}


def _tone(sev: str) -> str:
    return {"error": "caution", "warning": "caution", "info": "info"}.get(sev, "info")


def _str(value: object) -> str:
    return "" if value is None else str(value)
```

> The `within` node carries `range: [0, 1]` and `default` — exactly `morphe_grammar.Within(dimension="collapse")`. `validate_node` is the gate; if a field name is off, the test fails here, not downstream.

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_emit.py -v`
Expected: PASS (4 passed). If `validate_node` rejects a node, fix the emitted dict to match `py/morphe_grammar/models.py`.

- [ ] **Step 5: Commit**

```bash
git add py/morphe_surface/emit.py py/tests/test_surface_emit.py
git commit -m "feat(surface): emit_node — SurfaceNode to validated grammar Node"
```

---

### Task B6: diagnostics + provenance sidecar attachment

**Files:**
- Modify: `py/morphe_surface/build.py` (thread `diagnostics` by path — already a param; verify attachment), `py/morphe_surface/emit.py` (renders `spec.diagnostics` — already done in `_stack`; add field-level)
- Test: `py/tests/test_surface_sidecars.py`

**Interfaces:**
- Consumes: `build_surface`, `emit_node`.
- Produces: diagnostics keyed by JSON-path attach to the matching `SurfaceNode` and render as `inline-alert`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_surface_sidecars.py
from __future__ import annotations

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

SCHEMA = {"type": "object", "title": "Shift",
          "properties": {"worker_id": {"type": "string", "title": "Worker"}}}


def test_path_keyed_diagnostic_attaches_to_field() -> None:
    diags = {"$.worker_id": [Diagnostic(code="CERT", severity="error",
                                        path="$.worker_id", message="Lacks forklift cert.")]}
    spec = build_surface(SCHEMA, {"worker_id": "w-3"}, root=SCHEMA, diagnostics=diags)
    field = next(c for c in spec.children if c.path == "$.worker_id")
    assert field.diagnostics[0].code == "CERT"


def test_attached_diagnostic_renders_inline_alert() -> None:
    diags = {"$.worker_id": [Diagnostic(code="CERT", severity="error",
                                        path="$.worker_id", message="Lacks forklift cert.")]}
    node = emit_node(build_surface(SCHEMA, {"worker_id": "w-3"}, root=SCHEMA, diagnostics=diags))
    txt = repr(node)
    assert "inline-alert" in txt and "Lacks forklift cert." in txt
    validate_node(node)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_sidecars.py -v`
Expected: FAIL if the field-level `_stack`/`_labeled` does not yet render `spec.diagnostics` for leaf fields. (B5's `_stack` renders them for containers; leaves go through `_labeled`, which does not — that is the gap this task closes.)

- [ ] **Step 3: Render diagnostics on leaf fields too**

In `emit.py`, update `_labeled` to append the field's own alerts:

```python
def _labeled(spec: SurfaceNode, value_node: Node) -> Node:
    alerts = [{"kind": "inline-alert", "tone": _tone(d.severity), "title": d.code,
               "detail": d.message} for d in spec.diagnostics]
    return {"kind": "stack", "role": "field-group", "children": [
        {"kind": "text", "value": spec.label, "as": "caption", "intent": "neutral"},
        value_node, *alerts,
    ]}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_sidecars.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add py/morphe_surface/emit.py py/tests/test_surface_sidecars.py
git commit -m "feat(surface): attach and render path-keyed diagnostics"
```

---

### Task B7: totality property test (never raises)

**Files:**
- Modify: `pyproject.toml` (add `hypothesis` to `[dependency-groups].dev`)
- Test: `py/tests/test_surface_totality.py`

**Interfaces:**
- Consumes: `build_surface`, `emit_node`.
- Produces: a property test asserting D8 — arbitrary nested JSON-Schema-ish dicts never raise and always `validate_node`.

- [ ] **Step 1: Add hypothesis, write the failing test**

```bash
uv add --dev hypothesis
```

```python
# py/tests/test_surface_totality.py
from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

_leaf = st.fixed_dictionaries({"type": st.sampled_from(["string", "integer", "boolean"])})
_schema = st.recursive(
    _leaf | st.just({"enum": ["a", "b"]}) | st.just({"type": "null"}) | st.just({}),
    lambda c: st.fixed_dictionaries(
        {"type": st.just("object"),
         "properties": st.dictionaries(st.text(min_size=1, max_size=6), c, max_size=4)}),
    max_leaves=8,
)


@given(schema=_schema, data=st.none() | st.dictionaries(st.text(), st.integers(), max_size=3))
def test_compiler_is_total_and_valid(schema: dict, data: object) -> None:
    spec = build_surface(schema, data, root=schema)  # must not raise
    node = emit_node(spec)                            # must not raise
    validate_node(node)                               # must produce a valid tree
```

- [ ] **Step 2: Run test to verify it fails (or surfaces a non-total case)**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_totality.py -v`
Expected: FAIL if any generated schema raises or emits an invalid node (e.g. `{}` or `{"type":"null"}` must route to `diagnostic-node`, not crash).

- [ ] **Step 3: Close any non-total gap in `build_surface`/`emit_node`**

Ensure the final `else` of `resolve_strategy` returns `"diagnostic-node"` for unknown/`null`/empty schemas, and `emit_node`'s `diagnostic-node` branch always returns a valid `inline-alert`. No silent drops.

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_totality.py -v`
Expected: PASS (1 passed, many examples)

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml uv.lock py/tests/test_surface_totality.py py/morphe_surface
git commit -m "test(surface): property test — compilation is total and always valid"
```

---

### Task B8: `compile_surface` + adapters + `CompiledSurface`

**Files:**
- Create: `py/morphe_surface/compile.py`, `py/morphe_surface/adapters.py`
- Modify: `py/morphe_contracts/__init__.py` (add `CompiledSurface`), `py/morphe_surface/__init__.py` (export public API)
- Test: `py/tests/test_surface_compile.py`

**Interfaces:**
- Consumes: `build_surface`, `emit_node`, `validate_node`, `CompiledArtifact`.
- Produces: `compile_surface(...) -> CompiledSurface`; `from_pydantic(model) -> (schema, data)`; `from_envelope(envelope) -> (data, diagnostics)`; `surface_from_model(instance, *, compiled_at="") -> CompiledSurface`.

- [ ] **Step 1: Write the failing test**

```python
# py/tests/test_surface_compile.py
from __future__ import annotations

from pydantic import BaseModel

from morphe_grammar import validate_node
from morphe_surface import compile_surface, surface_from_model


class Addr(BaseModel):
    city: str


class Worker(BaseModel):
    name: str
    address: Addr


def test_compile_surface_returns_versioned_artifact() -> None:
    art = compile_surface(Worker.model_json_schema(),
                          {"name": "Ada", "address": {"city": "Rvk"}})
    assert art.grammar_version and art.compiler_version
    assert art.tree["kind"] == "frame"
    validate_node(art.tree)


def test_compile_is_deterministic() -> None:
    schema = Worker.model_json_schema()
    data = {"name": "Ada", "address": {"city": "Rvk"}}
    assert compile_surface(schema, data) == compile_surface(schema, data)


def test_surface_from_model_adapter() -> None:
    art = surface_from_model(Worker(name="Ada", address=Addr(city="Rvk")))
    assert art.tree["kind"] == "frame"
    validate_node(art.tree)


def test_envelope_adapter_unwraps_diagnostics() -> None:
    from morphe_surface.adapters import from_envelope
    data, diags = from_envelope({"data": {"name": "Ada"},
                                 "diagnostics": [{"code": "X", "severity": "info",
                                                  "path": "$.name", "message": "hi"}]})
    assert data == {"name": "Ada"}
    assert diags["$.name"][0].code == "X"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_compile.py -v`
Expected: FAIL — `ImportError: cannot import name 'compile_surface'`

- [ ] **Step 3: Add `CompiledSurface`, `compile.py`, `adapters.py`, exports**

Add to `py/morphe_contracts/__init__.py`:

```python
class CompiledSurface(CompiledArtifact):
    compiler_version: str
    # inherits tree, grammar_version, producer_version, diagnostics, produced_at
```

```python
# py/morphe_surface/compile.py
from __future__ import annotations

from typing import Any

from morphe_contracts import CompiledSurface, Diagnostic
from morphe_grammar import validate_node

from .build import build_surface
from .emit import emit_node


def _collect(spec: Any, out: list[Diagnostic]) -> None:
    out.extend(spec.diagnostics)
    for child in (*spec.children, *spec.items):
        _collect(child, out)


def compile_surface(
    schema: dict[str, Any],
    data: object | None = None,
    *,
    diagnostics: dict[str, list[Diagnostic]] | None = None,
    grammar_version: str = "0.1.0",
    compiler_version: str = "0.1.0",
    compiled_at: str = "",
) -> CompiledSurface:
    spec = build_surface(schema, data, root=schema, diagnostics=diagnostics)
    tree = emit_node(spec)
    validate_node(tree)  # gate: emitted tree must be grammar-valid (raises if not)
    collected: list[Diagnostic] = []
    _collect(spec, collected)
    return CompiledSurface(
        tree=tree, grammar_version=grammar_version, producer_version=compiler_version,
        compiler_version=compiler_version, diagnostics=collected, produced_at=compiled_at,
    )
```

```python
# py/morphe_surface/adapters.py
from __future__ import annotations

from typing import Any

from morphe_contracts import CompiledSurface, Diagnostic
from pydantic import BaseModel

from .compile import compile_surface


def from_pydantic(model: BaseModel) -> tuple[dict[str, Any], dict[str, Any]]:
    return type(model).model_json_schema(), model.model_dump(mode="json")


def from_envelope(envelope: dict[str, Any]) -> tuple[object, dict[str, list[Diagnostic]]]:
    data = envelope.get("data")
    raw = envelope.get("diagnostics") or []
    by_path: dict[str, list[Diagnostic]] = {}
    for item in raw:
        d = Diagnostic.model_validate(item)
        by_path.setdefault(d.path, []).append(d)
    return data, by_path


def surface_from_model(model: BaseModel, *, compiled_at: str = "") -> CompiledSurface:
    schema, data = from_pydantic(model)
    return compile_surface(schema, data, compiled_at=compiled_at)
```

Update `py/morphe_surface/__init__.py`:

```python
from .adapters import from_envelope, from_pydantic, surface_from_model
from .compile import compile_surface
from .hints import MorpheHint, parse_hint
from .spec import SurfaceNode
from .strategies import Priority, Strategy

__all__ = [
    "MorpheHint", "Priority", "Strategy", "SurfaceNode",
    "compile_surface", "from_envelope", "from_pydantic", "parse_hint", "surface_from_model",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `env -u PYTHONPATH uv run pytest py/tests/test_surface_compile.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Full suite + lint + types**

Run:
```bash
env -u PYTHONPATH uv run pytest
env -u PYTHONPATH uv run ruff check --fix py/morphe_surface py/morphe_contracts py/tests
env -u PYTHONPATH uv run ty check
```
Expected: all green; fix any ruff/ty findings (e.g. add return-type annotations) and re-run.

- [ ] **Step 6: Commit**

```bash
git add py/morphe_surface py/morphe_contracts py/tests/test_surface_compile.py
git commit -m "feat(surface): compile_surface, CompiledSurface artifact, pydantic/envelope adapters"
```

---

## Self-Review

**Spec coverage (ADR-0014):** D1 input=JSON Schema → B2/B8 (+ `from_pydantic`). D1′ hints-first → B1 `parse_hint`, B2 hint-wins. D2 two-stage → B3 `build_surface` / B5 `emit_node`. D3 closed enum + chokepoint → B2 `resolve_strategy`. D4 static `(schema,data)`, embedded collections, no bind → B3/B4/B8. D5 `Within(collapse)` → B5. D6 diagnostics+provenance sidecars+envelope → B6/B8 (`from_envelope`). D7 sibling tree + `morphe_contracts` → A1/A2. D8 totality → B7 property test + `diagnostic-node`. D9 embed/link + depth bound + cycle → B3. D10 versioned deterministic `CompiledSurface` → B8 (+ determinism test). D11 library-first/MCP-ready → no MCP task (intentional; signature is JSON-serializable). D12 actions out of v1 → not built (intentional).

**Named scope boundaries (not silent caps):** `timeline`, `key-value`, `diagnostic-list` strategies are declared in the enum but only `scalar/badge/record-card/collapsed-section/linked-ref/table/card-stack/diagnostic-node` are wired in v1 — the rest land via the same `resolve_strategy`→`emit_node` pattern in a follow-up. Provenance is threaded as a sidecar param but only diagnostics are rendered in v1 (D6 "provenance restrained"); the provenance render is a one-task follow-up mirroring B6. MCP exposure (D11) and actions (D12) are deferred by decision.

**Placeholder scan:** no TBD/“handle edge cases”/“similar to Task N”. The one explicit implementer note (B3 `eff_strategy`) is a refactor instruction with green tests as the guardrail, not a missing implementation.

**Type consistency:** `Strategy`/`SurfaceNode`/`MorpheHint` signatures match the Module Map across B1–B8; `compile_surface`/`build_surface`/`emit_node` signatures are stable; `CompiledSurface` extends `CompiledArtifact` (A1) consistently.

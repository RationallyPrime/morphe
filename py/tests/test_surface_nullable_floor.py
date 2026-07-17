"""The nullable floor (0.3.3): ``X | None`` reads as ``X`` structurally.

Every optional field used to classify as unrenderable — a nullable count
degraded to a diagnostic-node (found by the Apotheke surface upgrade). Only
the single-non-null anyOf shape unwraps; genuine multi-branch unions keep the
diagnostic degrade.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pydantic

from morphe_surface.build import build_surface
from morphe_surface.compile import compile_surface
from morphe_surface.hints import MorpheHint
from morphe_surface.resolve import resolve_strategy

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode

COUNT = 3


class Detail(pydantic.BaseModel):
    note: str


class Record(pydantic.BaseModel):
    name: str
    count: int | None = None
    detail: Detail | None = None


def _child(spec: SurfaceNode, path: str) -> SurfaceNode:
    return next(c for c in spec.children if c.path == path)


def test_nullable_scalar_resolves_scalar() -> None:
    schema = Record.model_json_schema()
    assert (
        resolve_strategy(schema["properties"]["count"], hint=MorpheHint(), root=schema) == "scalar"
    )


def test_nullable_nested_record_keeps_its_fields() -> None:
    schema = Record.model_json_schema()
    spec = build_surface(
        schema, {"name": "r", "count": COUNT, "detail": {"note": "hi"}}, root=schema
    )
    detail = _child(spec, "$.detail")
    assert detail.strategy == "collapsed-section"
    assert [c.path for c in detail.children] == ["$.detail.note"]
    count = _child(spec, "$.count")
    assert count.strategy == "scalar"
    assert count.value == COUNT


def test_nullable_field_with_none_data_renders_empty_not_alert() -> None:
    compiled = compile_surface(
        Record.model_json_schema(), {"name": "r", "count": None, "detail": None}
    )
    assert not any(d.code == "UNRENDERABLE" for d in compiled.diagnostics)


def test_true_multi_branch_union_still_degrades() -> None:
    schema = {
        "type": "object",
        "properties": {"x": {"anyOf": [{"type": "integer"}, {"type": "string"}]}},
    }
    assert resolve_strategy(schema["properties"]["x"], hint=MorpheHint(), root=schema) == (
        "diagnostic-node"
    )


def test_hint_still_wins_over_the_unwrap() -> None:
    schema = {
        "type": "object",
        "properties": {
            "n": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "x-morphe": {"strategy": "number", "format": "integer"},
            }
        },
    }
    spec = build_surface(schema, {"n": 9}, root=schema)
    assert _child(spec, "$.n").strategy == "number"

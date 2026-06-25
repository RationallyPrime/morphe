from __future__ import annotations

from pydantic import BaseModel

from morphe_grammar import validate_node
from morphe_surface import compile_surface, surface_from_model
from morphe_surface.adapters import from_envelope


class Addr(BaseModel):
    city: str


class Worker(BaseModel):
    name: str
    address: Addr


def test_compile_surface_returns_versioned_artifact() -> None:
    art = compile_surface(Worker.model_json_schema(), {"name": "Ada", "address": {"city": "Rvk"}})
    assert art.grammar_version
    assert art.compiler_version
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
    data, diags = from_envelope(
        {
            "data": {"name": "Ada"},
            "diagnostics": [{"code": "X", "severity": "info", "path": "$.name", "message": "hi"}],
        },
    )
    assert data == {"name": "Ada"}
    assert diags["$.name"][0].code == "X"

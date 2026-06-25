from __future__ import annotations

from morphe_surface.hints import MorpheHint
from morphe_surface.refs import resolve_ref, schema_type
from morphe_surface.resolve import resolve_strategy

ROOT = {"$defs": {"Addr": {"type": "object", "properties": {"city": {"type": "string"}}}}}


def test_resolve_ref_follows_defs() -> None:
    resolved = resolve_ref({"$ref": "#/$defs/Addr"}, ROOT)
    assert schema_type(resolved) == "object"


def test_hint_strategy_wins_over_structure() -> None:
    s = resolve_strategy(
        {"type": "array", "items": {"type": "object"}},
        hint=MorpheHint(strategy="card-stack"),
    )
    assert s == "card-stack"


def test_object_resolves_record_card() -> None:
    s = resolve_strategy({"type": "object", "properties": {}}, hint=MorpheHint())
    assert s == "record-card"


def test_array_of_objects_resolves_table() -> None:
    s = resolve_strategy({"type": "array", "items": {"type": "object"}}, hint=MorpheHint())
    assert s == "table"


def test_enum_resolves_badge() -> None:
    s = resolve_strategy({"enum": ["a", "b"]}, hint=MorpheHint())
    assert s == "badge"


def test_scalar_resolves_scalar() -> None:
    s = resolve_strategy({"type": "string"}, hint=MorpheHint())
    assert s == "scalar"

from __future__ import annotations

from morphe_surface.hints import MorpheHint
from morphe_surface.refs import resolve_ref, schema_type
from morphe_surface.resolve import resolve_strategy

ROOT = {"$defs": {"Addr": {"type": "object", "properties": {"city": {"type": "string"}}}}}


def test_resolve_ref_follows_defs() -> None:
    resolved = resolve_ref({"$ref": "#/$defs/Addr"}, ROOT)
    assert schema_type(resolved) == "object"


def test_resolve_ref_follows_bounded_chains_and_decodes_pointer_tokens() -> None:
    root = {
        "$defs": {
            "A/B": {"$ref": "#/$defs/T~0arget"},
            "T~arget": {"type": "string", "title": "Resolved"},
        }
    }
    assert resolve_ref({"$ref": "#/$defs/A~1B"}, root) == {
        "type": "string",
        "title": "Resolved",
    }


def test_resolve_ref_rejects_percent_encoded_definition_tokens() -> None:
    reference = {"$ref": "#/$defs/A%20B"}
    root = {
        "$defs": {
            "A B": {"type": "string"},
            "A%20B": {"type": "integer"},
        }
    }
    assert resolve_ref(reference, root) is reference


def test_resolve_ref_terminates_cycles() -> None:
    root = {"$defs": {"A": {"$ref": "#/$defs/B"}, "B": {"$ref": "#/$defs/A"}}}
    assert "$ref" in resolve_ref({"$ref": "#/$defs/A"}, root)


def test_hint_strategy_wins_over_structure() -> None:
    s = resolve_strategy(
        {"type": "array", "items": {"type": "object"}},
        hint=MorpheHint(strategy="card-stack"),
    )
    assert s == "card-stack"


def test_object_resolves_record_card() -> None:
    s = resolve_strategy({"type": "object", "properties": {}}, hint=MorpheHint())
    assert s == "record-card"


def test_array_of_flat_records_resolves_table() -> None:
    items = {"type": "object", "properties": {"name": {"type": "string"}}}
    s = resolve_strategy({"type": "array", "items": items}, hint=MorpheHint())
    assert s == "table"


def test_array_of_ref_items_resolves_table_through_root() -> None:
    s = resolve_strategy(
        {"type": "array", "items": {"$ref": "#/$defs/Addr"}}, hint=MorpheHint(), root=ROOT
    )
    assert s == "table"


def test_array_of_shapeless_objects_resolves_card_stack() -> None:
    # No properties -> no columns -> no grid to lower to (KRA-640 flatness gate).
    s = resolve_strategy({"type": "array", "items": {"type": "object"}}, hint=MorpheHint())
    assert s == "card-stack"


def test_enum_resolves_badge() -> None:
    s = resolve_strategy({"enum": ["a", "b"]}, hint=MorpheHint())
    assert s == "badge"


def test_scalar_resolves_scalar() -> None:
    s = resolve_strategy({"type": "string"}, hint=MorpheHint())
    assert s == "scalar"

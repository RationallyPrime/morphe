from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_surface.build import MAX_DEPTH, build_surface

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode

WORKER = {
    "type": "object",
    "title": "Worker",
    "properties": {
        "name": {"type": "string", "title": "Name"},
        "address": {"$ref": "#/$defs/Addr"},
        "manager_id": {"type": "string", "x-morphe": {"strategy": "linked-ref"}},
    },
    "$defs": {
        "Addr": {"type": "object", "title": "Address", "properties": {"city": {"type": "string"}}},
    },
}

SCHEDULE = {
    "type": "object",
    "title": "Schedule",
    "properties": {
        "assignments": {
            "type": "array",
            "title": "Assignments",
            "items": {"type": "object", "properties": {"worker": {"type": "string"}}},
        },
        "tags": {"type": "array", "items": {"type": "string"}},
    },
}


def _build(schema: dict[str, Any], data: object) -> SurfaceNode:
    return build_surface(schema, data, root=schema)


def test_record_card_has_scalar_child() -> None:
    spec = _build(WORKER, {"name": "Ada", "address": {"city": "Rvk"}, "manager_id": "w-9"})
    assert spec.strategy == "record-card"
    name = next(c for c in spec.children if c.path == "$.name")
    assert name.strategy == "scalar"
    assert name.value == "Ada"


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
    cyclic = {
        "type": "object",
        "title": "Node",
        "properties": {"parent": {"$ref": "#"}},
        "$id": "Node",
    }
    spec = build_surface(cyclic, {"parent": {"parent": {}}}, root=cyclic)
    parent = next(c for c in spec.children if c.path == "$.parent")
    grand = next((c for c in parent.children if c.path == "$.parent.parent"), None)
    assert grand is None or grand.strategy == "linked-ref"


def test_depth_bound_is_finite() -> None:
    cyclic = {"type": "object", "properties": {"next": {"$ref": "#"}}, "$id": "L"}
    data: dict[str, Any] = {}
    for _ in range(MAX_DEPTH + 4):
        data = {"next": data}
    spec = build_surface(cyclic, data, root=cyclic)
    assert spec.strategy == "record-card"


def test_object_list_is_table_with_rows() -> None:
    spec = _build(SCHEDULE, {"assignments": [{"worker": "Ada"}, {"worker": "Bo"}], "tags": []})
    a = next(c for c in spec.children if c.path == "$.assignments")
    assert a.strategy == "table"
    assert [column.label for column in a.children] == ["worker"]
    assert [row.children[0].value for row in a.items] == ["Ada", "Bo"]


def test_scalar_list_is_card_stack() -> None:
    spec = _build(SCHEDULE, {"assignments": [], "tags": ["x", "y"]})
    t = next(c for c in spec.children if c.path == "$.tags")
    assert t.strategy == "card-stack"
    assert [i.value for i in t.items] == ["x", "y"]


def test_nested_record_list_keeps_disclosures_not_grid() -> None:
    # KRA-640 flatness gate: rows with nested structure stay on the per-row disclosure path.
    schema = {
        "type": "object",
        "properties": {
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "detail": {"type": "object", "properties": {"note": {"type": "string"}}},
                    },
                },
            },
        },
    }
    spec = _build(schema, {"entries": [{"label": "x", "detail": {"note": "n"}}]})
    entries = next(c for c in spec.children if c.path == "$.entries")
    assert entries.strategy == "card-stack"


def test_hidden_field_is_omitted_from_record() -> None:
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "payload_hash": {"type": "string", "x-morphe": {"hidden": True}},
        },
    }
    spec = _build(schema, {"name": "Ada", "payload_hash": "abc"})
    assert [c.path for c in spec.children] == ["$.name"]


def test_hidden_field_on_ref_target_is_omitted() -> None:
    schema = {
        "type": "object",
        "properties": {"meta": {"$ref": "#/$defs/Meta"}, "name": {"type": "string"}},
        "$defs": {
            "Meta": {
                "type": "object",
                "x-morphe": {"hidden": True},
                "properties": {"key": {"type": "string"}},
            },
        },
    }
    spec = _build(schema, {"meta": {"key": "k"}, "name": "Ada"})
    assert [c.path for c in spec.children] == ["$.name"]


def test_hidden_column_is_omitted_from_table_and_rows() -> None:
    schema = {
        "type": "object",
        "properties": {
            "rows": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "account": {"type": "string", "title": "Account"},
                        "opened_sequence": {"type": "integer", "x-morphe": {"hidden": True}},
                    },
                },
            },
        },
    }
    spec = _build(schema, {"rows": [{"account": "Cash", "opened_sequence": 7}]})
    rows = next(c for c in spec.children if c.path == "$.rows")
    assert [column.label for column in rows.children] == ["Account"]
    assert [cell.path for cell in rows.items[0].children] == ["$.rows[0].account"]


def test_ref_container_is_labelled_by_field_key_not_class_title() -> None:
    # A $defs target's title is a Pydantic class name, never a label (KRA-677 R1).
    schema = {
        "type": "object",
        "properties": {"book": {"$ref": "#/$defs/BookResponse"}},
        "$defs": {
            "BookResponse": {
                "type": "object",
                "title": "BookResponse",
                "properties": {"name": {"type": "string"}},
            },
        },
    }
    spec = _build(schema, {"book": {"name": "Ledger"}})
    book = next(c for c in spec.children if c.path == "$.book")
    assert book.label == "book"


def test_inline_property_title_still_labels() -> None:
    spec = _build(SCHEDULE, {"assignments": [], "tags": []})
    a = next(c for c in spec.children if c.path == "$.assignments")
    assert a.label == "Assignments"


def test_heading_false_hint_threads_to_spec() -> None:
    schema = {
        "type": "object",
        "title": "BookOverviewSurface",
        "x-morphe": {"heading": False},
        "properties": {"name": {"type": "string"}},
    }
    spec = _build(schema, {"name": "Ledger"})
    assert spec.heading is False


def test_ref_items_flat_record_list_is_table() -> None:
    # Pydantic emits `tuple[BalanceLine, ...]` as items: {"$ref": "#/$defs/BalanceLine"}.
    schema = {
        "type": "object",
        "properties": {
            "balances": {"type": "array", "items": {"$ref": "#/$defs/BalanceLine"}},
        },
        "$defs": {
            "BalanceLine": {
                "type": "object",
                "properties": {
                    "account": {"type": "string", "title": "Account"},
                    "quantity": {"type": "string", "title": "Quantity"},
                },
            },
        },
    }
    spec = _build(schema, {"balances": [{"account": "Cash", "quantity": "150000"}]})
    balances = next(c for c in spec.children if c.path == "$.balances")
    assert balances.strategy == "table"
    assert [column.label for column in balances.children] == ["Account", "Quantity"]
    assert [cell.value for cell in balances.items[0].children] == ["Cash", "150000"]

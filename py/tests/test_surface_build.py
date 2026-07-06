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

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node
from morphe_surface.spec import SurfaceNode

if TYPE_CHECKING:
    from collections.abc import Callable

WORKER = {
    "type": "object",
    "title": "Worker",
    "properties": {
        "name": {"type": "string", "title": "Name"},
        "status": {"enum": ["active", "leave"], "title": "Status"},
        "address": {
            "type": "object",
            "title": "Address",
            "properties": {"city": {"type": "string", "title": "City"}},
        },
    },
}
DATA = {"name": "Ada", "status": "active", "address": {"city": "Rvk"}}
BALANCE_REPORT = {
    "type": "object",
    "title": "Balance report",
    "properties": {
        "balances": {
            "type": "array",
            "title": "Balances",
            "items": {
                "type": "object",
                "properties": {
                    "account": {"type": "string", "title": "Account"},
                    "amount": {"type": "number", "title": "Amount"},
                },
            },
        },
    },
}
BALANCE_DATA = {
    "balances": [
        {"account": "Cash", "amount": 100.0},
        {"account": "Receivables", "amount": 42.5},
    ],
}


def _find(node: object, pred: Callable[[dict[str, Any]], bool]) -> dict[str, Any] | None:
    if isinstance(node, dict):
        found = cast("dict[str, Any]", node)
        if pred(found):
            return found
        for value in found.values():
            hit = _find(value, pred)
            if hit is not None:
                return hit
    elif isinstance(node, list | tuple):
        for value in node:
            hit = _find(value, pred)
            if hit is not None:
                return hit
    return None


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


def test_flat_record_list_emits_tabular_grid_with_text_header() -> None:
    node = emit_node(build_surface(BALANCE_REPORT, BALANCE_DATA, root=BALANCE_REPORT))
    grid = _find(node, lambda n: n.get("kind") == "grid" and "columns" in n)

    assert grid is not None
    assert grid["role"] == "list"
    assert grid["columns"] == ["flexible", "flexible"]

    header = grid["children"][0]
    assert header["kind"] == "grid"
    assert [cell["kind"] for cell in header["children"]] == ["text", "text"]
    assert [cell["value"] for cell in header["children"]] == ["Account", "Amount"]

    rows = grid["children"][1:]
    assert [[cell["value"] for cell in row["children"]] for row in rows] == [
        ["Cash", "100.0"],
        ["Receivables", "42.5"],
    ]
    assert (
        _find(node, lambda n: n.get("kind") == "within" and n.get("id") == "$.balances[0]") is None
    )
    validate_node(node)


def _diag(path: str, code: str) -> Diagnostic:
    return Diagnostic(code=code, severity="warning", path=path, message="probe")


def test_table_cell_diagnostics_stay_visible() -> None:
    diags = {"$.balances[0].amount": [_diag("$.balances[0].amount", "CELL")]}
    spec = build_surface(BALANCE_REPORT, BALANCE_DATA, root=BALANCE_REPORT, diagnostics=diags)
    node = emit_node(spec)
    alert = _find(node, lambda n: n.get("kind") == "inline-alert" and n.get("title") == "CELL")
    assert alert is not None
    validate_node(node)


def test_table_row_diagnostics_stay_visible() -> None:
    diags = {"$.balances[0]": [_diag("$.balances[0]", "ROW")]}
    spec = build_surface(BALANCE_REPORT, BALANCE_DATA, root=BALANCE_REPORT, diagnostics=diags)
    node = emit_node(spec)
    alert = _find(node, lambda n: n.get("kind") == "inline-alert" and n.get("title") == "ROW")
    assert alert is not None
    validate_node(node)


def test_non_record_table_row_renders_itself_not_blank() -> None:
    # A D9 backstop row (linked-ref) must keep its link instead of padding to blanks.
    row = SurfaceNode(path="$.rows[0]", label="Row 0", strategy="linked-ref", href="#acc")
    table = SurfaceNode(path="$.rows", label="Rows", strategy="table", items=(row,))
    node = emit_node(table)
    link = _find(node, lambda n: n.get("kind") == "link" and n.get("href") == "#acc")
    assert link is not None
    validate_node(node)


def test_table_hint_on_scalar_array_keeps_values() -> None:
    schema = {
        "type": "array",
        "title": "Tags",
        "x-morphe": {"strategy": "table"},
        "items": {"type": "string"},
    }
    node = emit_node(build_surface(schema, ["a", "b"], root={}))
    for value in ("a", "b"):
        assert _find(node, lambda n, v=value: n.get("value") == v) is not None
    validate_node(node)

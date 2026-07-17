from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

import pytest

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
LEDGER_HEADER = {
    "type": "object",
    "title": "Ledger header",
    "properties": {
        "title": {"type": "string", "title": "Title"},
        "status": {"type": "string", "title": "Status"},
        "amount": {"type": "string", "title": "Amount"},
    },
}
LEDGER_HEADER_DATA = {"title": "Krates Main Ledger", "status": "open", "amount": "-42.5"}
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


@pytest.mark.parametrize(
    ("raw", "display"),
    [
        ("2026-07-17T15:40:14.582860+00:00", "2026-07-17 15:40 UTC"),
        ("2026-07-17T15:40:59.999999Z", "2026-07-17 15:40 UTC"),
        ("2026-07-17t17:40:10.1+02:00", "2026-07-17 17:40 +02:00"),
        ("2026-02-30T15:40:10Z", "2026-02-30T15:40:10Z"),
        ("2026-07-17T15:40:60Z", "2026-07-17T15:40:60Z"),
        ("2026-07-17T15:40:10+24:00", "2026-07-17T15:40:10+24:00"),
        ("2026-07-17", "2026-07-17"),
    ],
)
def test_scalar_rfc3339_display_is_minute_precise_and_total(raw: str, display: str) -> None:
    schema = {
        "type": "string",
        "title": "System Time",
        "x-morphe": {"temporal": "date-time-minute"},
    }
    spec = build_surface(schema, raw, root=schema)

    assert spec.value == raw
    assert emit_node(spec)["value"] == display


def test_rfc3339_shaped_opaque_string_is_unchanged_without_temporal_policy() -> None:
    opaque = "2026-07-17T15:40:14Z"
    spec = build_surface({"type": "string", "title": "Event ID"}, opaque, root={})

    assert spec.temporal is None
    assert emit_node(spec)["value"] == opaque


def test_timestamp_floor_covers_table_cells_and_textual_kpis_without_mutating_ir() -> None:
    raw = "2026-07-17T15:40:14.582860+00:00"
    display = "2026-07-17 15:40 UTC"
    schema = {
        "type": "object",
        "properties": {
            "summary": {
                "type": "array",
                "x-morphe": {"strategy": "kpi-row"},
            },
            "events": {
                "type": "array",
                "x-morphe": {"strategy": "table"},
                "items": {
                    "type": "object",
                    "properties": {
                        "system_time": {
                            "type": "string",
                            "title": "System Time",
                            "x-morphe": {"temporal": "date-time-minute"},
                        }
                    },
                },
            },
        },
    }
    spec = build_surface(
        schema,
        {
            "summary": [
                {"label": "Newest event", "value": raw, "temporal": "date-time-minute"}
            ],
            "events": [{"system_time": raw}],
        },
        root=schema,
    )
    summary = next(child for child in spec.children if child.path == "$.summary")
    events = next(child for child in spec.children if child.path == "$.events")

    assert summary.items[0].value == raw
    assert events.items[0].children[0].value == raw

    node = emit_node(spec)
    table = _find(node, lambda item: item.get("kind") == "grid" and "columns" in item)
    assert table is not None
    assert _find(table, lambda item: item.get("value") == display) is not None
    assert _find(node, lambda item: item.get("value") == display) is not None
    assert _find(node, lambda item: item.get("value") == raw) is None
    validate_node(node)


def test_root_identity_scalar_emits_display_critical_without_caption() -> None:
    node = emit_node(build_surface(LEDGER_HEADER, LEDGER_HEADER_DATA, root=LEDGER_HEADER))
    display = _find(node, lambda n: n.get("as") == "display")

    assert display is not None
    assert display["value"] == "Krates Main Ledger"
    assert display["emphasis"] == "critical"
    assert _find(node, lambda n: n.get("as") == "caption" and n.get("value") == "Title") is None
    validate_node(node)


def test_enum_emits_badge() -> None:
    spec = build_surface({"enum": ["active"], "title": "Status"}, "active", root={})
    node = emit_node(spec)
    assert node["kind"] == "badge"
    assert node["label"] == "active"
    validate_node(node)


def test_collapsed_section_emits_within_collapse() -> None:
    surface = build_surface(WORKER, DATA, root=WORKER)
    address = next(child for child in surface.children if child.path == "$.address")
    address = address.model_copy(update={"emphasis": "critical"})
    node = emit_node(address)

    assert node["kind"] == "within"
    assert node["dimension"] == "collapse"
    assert node["summary"] == "Address"
    assert node["target"]["kind"] == "stack"
    assert node["target"]["role"] == "section"
    assert node["target"]["emphasis"] == "critical"
    assert [child["kind"] for child in node["target"]["children"]] == ["grid"]
    assert _find(node["target"], lambda child: child.get("value") == "Address") is None
    validate_node(node)


@pytest.mark.parametrize("hostile_label", [" ", "\u0085", "\u200b", "\u2800", "\ufe0f", "\ufeff"])
def test_collapsed_section_repairs_invisible_summary_to_keep_emission_total(
    hostile_label: str,
) -> None:
    schema = {
        "type": "object",
        "properties": {"nested": {"type": "object", "title": hostile_label, "properties": {}}},
    }
    node = emit_node(build_surface(schema, {"nested": {}}, root=schema))
    collapsed = _find(node, lambda child: child.get("kind") == "within")

    assert collapsed is not None
    assert collapsed["summary"] == "Details"
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


def test_record_scalars_emit_two_column_definition_grid() -> None:
    node = emit_node(build_surface(LEDGER_HEADER, LEDGER_HEADER_DATA, root=LEDGER_HEADER))
    grid = _find(
        node,
        lambda n: (
            n.get("kind") == "grid"
            and n.get("role") == "field-group"
            and n.get("columns") == ["content", "flexible"]
        ),
    )

    assert grid is not None
    assert [cell["value"] for cell in grid["children"]] == ["Status", "open", "Amount", "-42.5"]
    amount = grid["children"][3]
    assert amount["numeric"] is True
    assert amount["polarity"] == "negative"
    validate_node(node)


def test_primary_collection_heading_emits_strong_claim() -> None:
    node = emit_node(build_surface(BALANCE_REPORT, BALANCE_DATA, root=BALANCE_REPORT))
    heading = _find(node, lambda n: n.get("as") == "heading" and n.get("value") == "Balances")

    assert heading is not None
    assert heading["emphasis"] == "strong"
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


def test_table_row_alert_is_a_sibling_never_a_wrapper() -> None:
    # A wrapped row is a grandchild of the table grid, so it never adopts the
    # subgrid tracks and collapses into the first column. The alert must ride as
    # a direct-child sibling of its row grid inside the columned table grid.
    diags = {"$.balances[0]": [_diag("$.balances[0]", "ROW")]}
    spec = build_surface(BALANCE_REPORT, BALANCE_DATA, root=BALANCE_REPORT, diagnostics=diags)
    node = emit_node(spec)
    table = _find(node, lambda n: n.get("kind") == "grid" and "columns" in n)
    assert table is not None
    kinds = [child.get("kind") for child in table["children"]]
    assert "inline-alert" in kinds, "row alert must be a direct child of the table grid"
    assert all(k in ("grid", "inline-alert") for k in kinds), (
        "table grid children are row grids and their sibling alerts only — no wrappers"
    )


def test_non_record_table_row_renders_itself_not_blank() -> None:
    # A D9 backstop row (linked-ref) must keep its link instead of padding to blanks.
    row = SurfaceNode(path="$.rows[0]", label="Row 0", strategy="linked-ref", href="#acc")
    table = SurfaceNode(path="$.rows", label="Rows", strategy="table", items=(row,))
    node = emit_node(table)
    link = _find(node, lambda n: n.get("kind") == "link" and n.get("href") == "#acc")
    assert link is not None
    validate_node(node)


def test_nullable_table_cell_keeps_its_grid_position() -> None:
    schema = {
        "type": "array",
        "title": "Roster",
        "x-morphe": {"strategy": "table"},
        "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "title": "Name"},
                "rate": {"anyOf": [{"type": "number"}, {"type": "null"}], "title": "Rate"},
                "profile": {
                    "type": "object",
                    "title": "Profile",
                    "x-morphe": {"strategy": "linked-ref"},
                },
            },
        },
    }
    data = [{"name": "Ada", "rate": None, "profile": {"label": "Open Ada", "href": "/ada"}}]
    node = emit_node(build_surface(schema, data, root=schema))
    table = _find(
        node,
        lambda candidate: candidate.get("kind") == "grid" and "columns" in candidate,
    )

    assert table is not None
    row = table["children"][1]
    assert [cell["kind"] for cell in row["children"]] == ["text", "spacer", "link"]
    assert row["children"][1] == {"kind": "spacer", "size": "xs"}
    validate_node(node)


def test_heading_false_suppresses_section_heading() -> None:
    schema = {
        "type": "object",
        "title": "BookOverviewSurface",
        "x-morphe": {"heading": False},
        "properties": {"name": {"type": "string", "title": "Name"}},
    }
    node = emit_node(build_surface(schema, {"name": "Ledger"}, root=schema))
    heading = _find(node, lambda n: n.get("as") == "heading")
    assert heading is None
    validate_node(node)


def test_empty_href_linked_ref_emits_blank_text_not_dead_link() -> None:
    # KRA-677 R3: an absent relation must not render as a dead href="#" link.
    schema = {
        "type": "object",
        "properties": {"reverses": {"type": "string", "x-morphe": {"strategy": "linked-ref"}}},
    }
    node = emit_node(build_surface(schema, {"reverses": ""}, root=schema))
    assert _find(node, lambda n: n.get("kind") == "link") is None
    validate_node(node)


def test_linked_ref_pair_emits_payload_label() -> None:
    schema = {
        "type": "object",
        "properties": {"manager": {"type": "string", "x-morphe": {"strategy": "linked-ref"}}},
    }
    node = emit_node(
        build_surface(
            schema,
            {"manager": {"label": "Grace Hopper", "href": "/workers/w-9"}},
            root=schema,
        )
    )
    link = _find(node, lambda n: n.get("kind") == "link")

    assert link is not None
    assert link["label"] == "Grace Hopper"
    assert link["href"] == "/workers/w-9"
    validate_node(node)


def test_empty_collection_emits_empty_state_caption() -> None:
    node = emit_node(build_surface(BALANCE_REPORT, {"balances": []}, root=BALANCE_REPORT))
    empty = _find(node, lambda n: n.get("as") == "caption" and n.get("value") == "No balances.")

    assert empty is not None
    validate_node(node)


def test_empty_collection_uses_python_whitespace_for_its_fallback_label() -> None:
    schema = {"type": "array", "title": "\u0085", "items": {"type": "string"}}
    node = emit_node(build_surface(schema, [], root=schema))
    empty = _find(node, lambda item: item.get("value") == "No items.")
    assert empty is not None
    validate_node(node)


def test_status_preserves_bom_because_python_strip_does_not_remove_it() -> None:
    schema = {"type": "string", "x-morphe": {"strategy": "status"}}
    node = emit_node(build_surface(schema, "\ufeffready\ufeff", root=schema))
    assert node["signal"]["text"] == "\ufeffready\ufeff"
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

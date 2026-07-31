"""The `key-value` hint-selected strategy (KRA-787): tiered field rows.

Like the other 0.5.0 additions, `key-value` is hint-selected ONLY — structural
inference never picks it, so the hint-free floor stays byte-identical. It tiers an
object's scalar children by HINT (never name): an emphasis-hinted child -> primary
(value strong), a role:provenance child -> provenance, the rest -> secondary. Each
tier renders through the SAME definition-grid idiom the hint-free floor uses. The
SAME expected tree is asserted verbatim by the TypeScript twin
(src/lib/surface-edge/key-value.test.ts).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_grammar.catalog import KEY_VALUE_PANEL, PROMOTED_COMPOUNDS
from morphe_grammar.version import GRAMMAR_VERSION
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node
from morphe_surface.hints import MorpheHint
from morphe_surface.resolve import resolve_strategy

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode

PANEL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "title": "Panel",
    "x-morphe": {"strategy": "key-value", "order": ["name", "dept", "id"]},
    "properties": {
        "name": {"type": "string", "title": "Name", "x-morphe": {"emphasis": "strong"}},
        "dept": {"type": "string", "title": "Dept"},
        "id": {"type": "string", "title": "Id", "x-morphe": {"role": "provenance"}},
    },
}
PANEL_DATA: dict[str, object] = {"name": "Sok", "dept": "Treasury", "id": "emp-1"}


def _grid(*children: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": "grid",
        "role": "field-group",
        "columns": ["content", "flexible"],
        "children": list(children),
    }


def _caption(value: str) -> dict[str, Any]:
    return {"kind": "text", "value": value, "as": "caption", "intent": "neutral"}


EXPECTED_PANEL: dict[str, Any] = {
    "kind": "compound",
    "name": "KeyValuePanel",
    "args": {},
    "slots": {
        "primary": [
            _grid(
                _caption("Name"),
                {"kind": "text", "value": "Sok", "as": "body", "emphasis": "strong"},
            )
        ],
        "secondary": [_grid(_caption("Dept"), {"kind": "text", "value": "Treasury", "as": "body"})],
        "provenance": [
            {
                "kind": "compound",
                "name": "ProvenanceFooter",
                "args": {},
                "slots": {
                    "facts": [
                        {
                            "kind": "stack",
                            "role": "field-group",
                            "children": [
                                _caption("Id"),
                                {
                                    "kind": "text",
                                    "value": "emp-1",
                                    "as": "body",
                                    "intent": "provenance",
                                },
                            ],
                        }
                    ],
                    "seals": [],
                    "links": [],
                },
            }
        ],
    },
}


def _build(schema: dict[str, Any], data: object) -> SurfaceNode:
    return build_surface(schema, data, root=schema)


def _panel_payload(node: dict[str, Any]) -> dict[str, Any]:
    assert node["kind"] == "stack"
    assert node["role"] == "section"
    assert node["children"][0] == {
        "kind": "text",
        "value": "Panel",
        "as": "heading",
        "level": 1,
    }
    return node["children"][1]


# --- resolve: hint-selected only; the structural floor is untouched -------------------


def test_key_value_is_hint_selected_only() -> None:
    obj = {"type": "object", "properties": {"a": {"type": "string"}}}
    assert resolve_strategy(obj, hint=MorpheHint()) == "record-card"
    assert resolve_strategy(obj, hint=MorpheHint(strategy="key-value")) == "key-value"


def test_hint_free_object_still_lowers_to_record_card() -> None:
    floor = {k: v for k, v in PANEL_SCHEMA.items() if k != "x-morphe"}
    assert _build(floor, PANEL_DATA).strategy == "record-card"


# --- emit (gated through validate_node) -----------------------------------------------


def test_key_value_tiers_fields_into_the_promoted_panel() -> None:
    node = emit_node(_build(PANEL_SCHEMA, PANEL_DATA))
    validate_node(node)
    assert _panel_payload(node) == EXPECTED_PANEL


def test_key_value_reuses_the_definition_grid_idiom_verbatim() -> None:
    # The hint-free floor renders the SAME object as a record-card whose fields ride a
    # definition grid; the key-value panel reuses that exact grid shape per tier.
    floor = {k: v for k, v in PANEL_SCHEMA.items() if k != "x-morphe"}
    floor_node = emit_node(_build(floor, PANEL_DATA))
    floor_grid = next(c for c in floor_node["children"][0]["children"] if c.get("kind") == "grid")
    panel = _panel_payload(emit_node(_build(PANEL_SCHEMA, PANEL_DATA)))
    panel_secondary_grid = panel["slots"]["secondary"][0]
    assert floor_grid["role"] == panel_secondary_grid["role"] == "field-group"
    assert floor_grid["columns"] == panel_secondary_grid["columns"] == ["content", "flexible"]


def test_key_value_node_diagnostics_ride_the_primary_head() -> None:
    diagnostics = {"$": [Diagnostic(code="PANEL", severity="info", path="$", message="node level")]}
    spec = build_surface(PANEL_SCHEMA, PANEL_DATA, root=PANEL_SCHEMA, diagnostics=diagnostics)
    node = emit_node(spec)
    validate_node(node)
    head = _panel_payload(node)["slots"]["primary"][0]
    assert head == {
        "kind": "inline-alert",
        "tone": "info",
        "title": "PANEL",
        "detail": "node level",
    }


# --- factory gate ---------------------------------------------------------------------


def test_generated_catalog_registers_key_value_panel() -> None:
    assert "KeyValuePanel" in PROMOTED_COMPOUNDS
    assert KEY_VALUE_PANEL.lifecycle == "promoted"
    assert KEY_VALUE_PANEL.grammar_version == GRAMMAR_VERSION
    assert set(KEY_VALUE_PANEL.params.properties) == set()
    validate_node(KEY_VALUE_PANEL.template)

"""The `trail` hint-selected strategy (KRA-786): event/trace rows.

Like the other 0.5.0 additions, `trail` is hint-selected ONLY — structural inference
never picks it, so the hint-free floor stays byte-identical. Each array item lowers to
one promoted TrailEntry compound; child classification is deterministic and HINT-KEYED
only (never name-based): temporal -> stamp; the primary string scalar -> summary;
linked-ref -> ref slot; role:provenance -> provenance footer. The SAME expected tree is
asserted verbatim by the TypeScript twin (src/lib/surface-edge/trail.test.ts).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_grammar.catalog import PROMOTED_COMPOUNDS, TRAIL_ENTRY
from morphe_grammar.version import GRAMMAR_VERSION
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node
from morphe_surface.hints import MorpheHint
from morphe_surface.resolve import resolve_strategy

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode

TRAIL_SCHEMA: dict[str, Any] = {
    "type": "array",
    "title": "Trail",
    "x-morphe": {"strategy": "trail", "heading": False},
    "items": {
        "type": "object",
        "x-morphe": {"order": ["when", "what", "link", "ref"]},
        "properties": {
            "when": {
                "type": "string",
                "title": "When",
                "x-morphe": {"temporal": "date-time-minute"},
            },
            "what": {"type": "string", "title": "What"},
            "link": {"type": "object", "title": "Link", "x-morphe": {"strategy": "linked-ref"}},
            "ref": {"type": "string", "title": "Ref", "x-morphe": {"role": "provenance"}},
        },
    },
}
TRAIL_DATA: list[dict[str, object]] = [
    {
        "when": "2026-07-17T09:14:00Z",
        "what": "Admitted",
        "link": {"label": "Open", "href": "/a/1"},
        "ref": "evt-001",
    },
]

EXPECTED_TRAIL: dict[str, Any] = {
    "kind": "stack",
    "role": "section",
    "children": [
        {
            "kind": "compound",
            "name": "TrailEntry",
            "args": {
                "summary": {"kind": "text", "value": "Admitted", "as": "body"},
                "stamp": {
                    "kind": "text",
                    "value": "2026-07-17 09:14 UTC",
                    "as": "caption",
                    "intent": "marginalia",
                },
            },
            "slots": {
                "ref": [{"kind": "link", "href": "/a/1", "label": "Open"}],
                "provenance": [
                    {"kind": "text", "value": "evt-001", "as": "body", "intent": "provenance"}
                ],
            },
        }
    ],
}


def _build(schema: dict[str, Any], data: object) -> SurfaceNode:
    return build_surface(schema, data, root=schema)


# --- resolve: hint-selected only; the structural floor is untouched -------------------


def test_trail_is_hint_selected_only() -> None:
    arr = {"type": "array", "items": {"type": "object", "properties": {"a": {"type": "string"}}}}
    # Structural inference for an array of records is a table/card-stack, never a trail.
    assert resolve_strategy(arr, hint=MorpheHint()) in {"table", "card-stack"}
    assert resolve_strategy(arr, hint=MorpheHint(strategy="trail")) == "trail"


def test_hint_free_array_still_lowers_structurally() -> None:
    floor = {k: v for k, v in TRAIL_SCHEMA.items() if k != "x-morphe"}
    assert _build(floor, TRAIL_DATA).strategy in {"table", "card-stack"}


# --- emit (gated through validate_node) -----------------------------------------------


def test_trail_lowers_each_item_to_a_promoted_trail_entry() -> None:
    node = emit_node(_build(TRAIL_SCHEMA, TRAIL_DATA))
    validate_node(node)
    assert node == EXPECTED_TRAIL


def test_trail_keeps_identifiers_out_of_the_summary() -> None:
    node = emit_node(_build(TRAIL_SCHEMA, TRAIL_DATA))
    entry = node["children"][0]
    # The provenance id lives ONLY in the provenance footer, never in the summary text.
    assert entry["args"]["summary"]["value"] == "Admitted"
    assert entry["slots"]["provenance"][0]["value"] == "evt-001"


def test_empty_trail_keeps_the_empty_collection_floor() -> None:
    node = emit_node(_build(TRAIL_SCHEMA, []))
    validate_node(node)
    assert node == {
        "kind": "stack",
        "role": "section",
        "children": [{"kind": "text", "value": "No trail.", "as": "caption", "intent": "neutral"}],
    }


def test_trail_preserves_promoted_arg_and_item_diagnostics() -> None:
    diagnostics = {
        "$[0]": [Diagnostic(code="EVT", severity="warning", path="$[0]", message="event level")],
        "$[0].when": [
            Diagnostic(code="STAMP", severity="info", path="$[0].when", message="stamp src")
        ],
    }
    spec = build_surface(TRAIL_SCHEMA, TRAIL_DATA, root=TRAIL_SCHEMA, diagnostics=diagnostics)
    node = emit_node(spec)
    validate_node(node)
    provenance = node["children"][0]["slots"]["provenance"]
    alerts = [item["title"] for item in provenance if item.get("kind") == "inline-alert"]
    # Event-level AND the stamp child's (a bare arg) diagnostics both surface (D8).
    assert alerts == ["EVT", "STAMP"]


# --- factory gate ---------------------------------------------------------------------


def test_generated_catalog_registers_trail_entry() -> None:
    assert "TrailEntry" in PROMOTED_COMPOUNDS
    assert TRAIL_ENTRY.lifecycle == "promoted"
    assert TRAIL_ENTRY.grammar_version == GRAMMAR_VERSION
    assert set(TRAIL_ENTRY.params.properties) == {"stamp", "summary"}
    assert TRAIL_ENTRY.params.properties["summary"].required is True
    assert TRAIL_ENTRY.params.properties["stamp"].required is False
    validate_node(TRAIL_ENTRY.template)

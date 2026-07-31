"""The `breakdown` hint-selected strategy (KRA-785): labeled proportion rows.

Like the other 0.5.0 additions, `breakdown` is hint-selected ONLY — structural
inference never picks it, so the hint-free floor stays byte-identical. Each numeric
child is one proportion row (fraction = value / sum(positive numeric values)); a
non-numeric child or a zero/empty sum degrades that row's progress to indeterminate,
mirroring the `progress` strategy. The SAME expected tree is asserted verbatim by the
TypeScript twin (src/lib/surface-edge/breakdown.test.ts).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_grammar.catalog import BREAKDOWN, PROMOTED_COMPOUNDS
from morphe_grammar.version import GRAMMAR_VERSION
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node
from morphe_surface.hints import MorpheHint
from morphe_surface.resolve import resolve_strategy

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode

SPLIT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "title": "Split",
    "x-morphe": {"strategy": "breakdown", "order": ["a", "b", "c"]},
    "properties": {
        "a": {"type": "integer", "title": "Alpha"},
        "b": {"type": "integer", "title": "Beta"},
        "c": {"type": "integer", "title": "Gamma"},
    },
}
SPLIT_DATA: dict[str, object] = {"a": 1, "b": 2, "c": 1}


def _row(label: str, value: object, fraction: float | None) -> dict[str, Any]:
    progress: dict[str, Any] = {"kind": "progress", "label": label}
    if fraction is not None:
        progress["value"] = fraction
    return {
        "kind": "cluster",
        "role": "inline",
        "align": "baseline",
        "children": [
            {"kind": "text", "value": label, "as": "caption", "intent": "neutral"},
            progress,
            {"kind": "number", "value": value},
        ],
    }


EXPECTED_BREAKDOWN: dict[str, Any] = {
    "kind": "compound",
    "name": "Breakdown",
    "args": {},
    "slots": {
        "rows": [
            _row("Alpha", 1, 0.25),
            _row("Beta", 2, 0.5),
            _row("Gamma", 1, 0.25),
        ]
    },
}


def _build(schema: dict[str, Any], data: object) -> SurfaceNode:
    return build_surface(schema, data, root=schema)


def _breakdown_payload(node: dict[str, Any]) -> dict[str, Any]:
    assert node["kind"] == "stack"
    assert node["role"] == "section"
    assert node["children"][0]["kind"] == "text"
    assert node["children"][0]["as"] == "heading"
    assert node["children"][0]["level"] == 1
    return node["children"][1]


# --- resolve: hint-selected only; the structural floor is untouched -------------------


def test_breakdown_is_hint_selected_only() -> None:
    obj = {"type": "object", "properties": {"a": {"type": "integer"}}}
    assert resolve_strategy(obj, hint=MorpheHint()) == "record-card"
    assert resolve_strategy(obj, hint=MorpheHint(strategy="breakdown")) == "breakdown"
    arr = {"type": "array", "items": {"type": "integer"}}
    assert resolve_strategy(arr, hint=MorpheHint(strategy="breakdown")) == "breakdown"


def test_hint_free_object_still_lowers_to_record_card() -> None:
    floor = {k: v for k, v in SPLIT_SCHEMA.items() if k != "x-morphe"}
    assert _build(floor, SPLIT_DATA).strategy == "record-card"


# --- emit (gated through validate_node) -----------------------------------------------


def test_breakdown_lowers_to_promoted_compound_with_fractions() -> None:
    node = emit_node(_build(SPLIT_SCHEMA, SPLIT_DATA))
    validate_node(node)
    assert node["children"][0]["value"] == "Split"
    assert _breakdown_payload(node) == EXPECTED_BREAKDOWN


def test_breakdown_pins_a_non_trivial_repeating_fraction() -> None:
    # 100000 / 350000 == 2/7 — a non-terminating IEEE-754 double. Both compilers must
    # produce the exact same token; the krates-budget conformance vector pins it too.
    schema = {
        "type": "object",
        "x-morphe": {"strategy": "breakdown", "heading": False, "order": ["r", "o"]},
        "properties": {
            "r": {"type": "integer", "title": "R"},
            "o": {"type": "integer", "title": "O"},
        },
    }
    node = emit_node(_build(schema, {"r": 100_000, "o": 250_000}))
    validate_node(node)
    breakdown = _breakdown_payload(node)
    fractions = [row["children"][1].get("value") for row in breakdown["slots"]["rows"]]
    assert fractions == [0.2857142857142857, 0.7142857142857143]


def test_breakdown_degrades_non_numeric_and_zero_sum_to_indeterminate() -> None:
    schema = {
        "type": "object",
        "x-morphe": {"strategy": "breakdown", "heading": False, "order": ["a", "b"]},
        "properties": {
            "a": {"type": "string", "title": "Alpha"},
            "b": {"type": "integer", "title": "Beta"},
        },
    }
    node = emit_node(_build(schema, {"a": "hello", "b": 0}))
    validate_node(node)
    rows = _breakdown_payload(node)["slots"]["rows"]
    # Non-numeric row: indeterminate progress, value renders as its natural text leaf.
    assert "value" not in rows[0]["children"][1]
    assert rows[0]["children"][2] == {"kind": "text", "value": "hello", "as": "body"}
    # Zero positive sum: the numeric child's progress is indeterminate too.
    assert "value" not in rows[1]["children"][1]


def test_breakdown_node_diagnostics_ride_the_rows_head() -> None:
    diagnostics = {"$": [Diagnostic(code="SPLIT", severity="info", path="$", message="node level")]}
    spec = build_surface(SPLIT_SCHEMA, SPLIT_DATA, root=SPLIT_SCHEMA, diagnostics=diagnostics)
    node = emit_node(spec)
    validate_node(node)
    head = _breakdown_payload(node)["slots"]["rows"][0]
    assert head == {
        "kind": "inline-alert",
        "tone": "info",
        "title": "SPLIT",
        "detail": "node level",
    }


# --- factory gate ---------------------------------------------------------------------


def test_generated_catalog_registers_breakdown() -> None:
    assert "Breakdown" in PROMOTED_COMPOUNDS
    assert BREAKDOWN.lifecycle == "promoted"
    assert BREAKDOWN.grammar_version == GRAMMAR_VERSION
    assert set(BREAKDOWN.params.properties) == {"title"}
    assert BREAKDOWN.params.properties["title"].required is False
    validate_node(BREAKDOWN.template)

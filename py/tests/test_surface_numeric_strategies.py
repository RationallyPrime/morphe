"""The 0.3.0 hint-selected strategies: number / status / progress / kpi-row.

Every case runs the real two-stage pipeline and gates through validate_node where it
emits — the floor (hint-free structural inference) must stay byte-identical, and every
new lowering must degrade, never raise (D8).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

import pytest

from morphe_grammar import validate_node
from morphe_surface.authoring import KpiCell, morphe_hint
from morphe_surface.build import build_surface
from morphe_surface.compile import compile_surface
from morphe_surface.emit import emit_node
from morphe_surface.hints import MorpheHint
from morphe_surface.resolve import resolve_strategy

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode


ISK_BALANCE = 2_450_000


def _build(schema: dict[str, Any], data: object) -> SurfaceNode:
    return build_surface(schema, data, root=schema)


def _child(spec: SurfaceNode, path: str) -> SurfaceNode:
    return next(c for c in spec.children if c.path == path)


TREASURY = {
    "type": "object",
    "title": "Treasury",
    "properties": {
        "balance": {
            "type": "integer",
            "title": "Balance",
            "x-morphe": {"strategy": "number", "format": "currency", "currency": "ISK"},
        },
        "growth": {
            "type": "number",
            "title": "Growth",
            "x-morphe": {"strategy": "number", "format": "percent", "emphasis": "strong"},
        },
        "finality": {
            "type": "string",
            "title": "Finality",
            "x-morphe": {
                "strategy": "status",
                "intents": {"settled": "success", "pending": "caution"},
            },
        },
        "window": {
            "type": "number",
            "title": "Window coverage",
            "x-morphe": {"strategy": "progress"},
        },
        "kpis": {
            "type": "array",
            "title": "Key figures",
            "items": {"type": "object"},
            "x-morphe": {"strategy": "kpi-row", "heading": False},
        },
    },
}


def _treasury_data(**overrides: object) -> dict[str, object]:
    data: dict[str, object] = {
        "balance": ISK_BALANCE,
        "growth": 0.135,
        "finality": "settled",
        "window": 0.62,
        "kpis": [
            KpiCell(
                label="Net position",
                value=ISK_BALANCE,
                kicker="Treasury",
                format="currency",
                currency="ISK",
            ).model_dump(),
            KpiCell(label="Rail", value="bank_batch", kicker="Route").model_dump(),
        ],
    }
    data.update(overrides)
    return data


# --- resolve: hint-selected only; the structural floor is untouched -------------------


def test_new_strategies_are_hint_selected_only() -> None:
    assert resolve_strategy({"type": "integer"}, hint=MorpheHint()) == "scalar"
    assert resolve_strategy({"type": "integer"}, hint=MorpheHint(strategy="number")) == "number"
    assert resolve_strategy({"type": "string"}, hint=MorpheHint(strategy="status")) == "status"
    assert resolve_strategy({"type": "number"}, hint=MorpheHint(strategy="progress")) == "progress"
    items = {"type": "array", "items": {"type": "object"}}
    assert resolve_strategy(items, hint=MorpheHint(strategy="kpi-row")) == "kpi-row"


# --- build ----------------------------------------------------------------------------


def test_number_leaf_carries_format_currency_and_emphasis() -> None:
    spec = _build(TREASURY, _treasury_data())
    balance = _child(spec, "$.balance")
    assert balance.strategy == "number"
    assert balance.value == ISK_BALANCE
    assert balance.number_format == "currency"
    assert balance.currency == "ISK"
    growth = _child(spec, "$.growth")
    assert growth.emphasis == "strong"
    assert growth.number_format == "percent"


def test_number_hint_over_text_degrades_to_scalar() -> None:
    spec = _build(TREASURY, _treasury_data(balance="not a number"))
    balance = _child(spec, "$.balance")
    assert balance.strategy == "scalar"
    assert balance.value == "not a number"


def test_status_resolves_intent_per_value() -> None:
    settled = _child(_build(TREASURY, _treasury_data()), "$.finality")
    assert settled.strategy == "status"
    assert settled.intent == "success"
    pending = _child(_build(TREASURY, _treasury_data(finality="pending")), "$.finality")
    assert pending.intent == "caution"
    unknown = _child(_build(TREASURY, _treasury_data(finality="weird")), "$.finality")
    assert unknown.intent is None


def test_badge_consults_the_intents_map_per_value() -> None:
    schema = {
        "type": "object",
        "properties": {
            "standing": {
                "enum": ["active", "breached"],
                "x-morphe": {"intents": {"breached": "caution", "active": "success"}},
            }
        },
    }
    breached = _child(_build(schema, {"standing": "breached"}), "$.standing")
    assert breached.strategy == "badge"
    assert breached.intent == "caution"


def test_progress_clamps_and_degrades_to_indeterminate() -> None:
    over = _child(_build(TREASURY, _treasury_data(window=1.4)), "$.window")
    assert over.value == 1.0
    negative = _child(_build(TREASURY, _treasury_data(window=-0.2)), "$.window")
    assert negative.value == 0.0
    absent = _child(_build(TREASURY, _treasury_data(window=None)), "$.window")
    assert absent.strategy == "progress"
    assert absent.value is None


def test_kpi_row_builds_number_and_text_cells() -> None:
    kpis = _child(_build(TREASURY, _treasury_data()), "$.kpis")
    assert kpis.strategy == "kpi-row"
    number_cell, text_cell = kpis.items
    assert number_cell.strategy == "number"
    assert number_cell.kicker == "Treasury"
    assert number_cell.currency == "ISK"
    assert text_cell.strategy == "scalar"
    assert text_cell.value == "bank_batch"


def test_kpi_row_never_wins_primary_collection_promotion() -> None:
    schema = {
        "type": "object",
        "properties": {
            "kpis": {"type": "array", "x-morphe": {"strategy": "kpi-row"}},
            "rows": {
                "type": "array",
                "items": {"type": "object", "properties": {"a": {"type": "string"}}},
            },
        },
    }
    spec = _build(schema, {"kpis": [], "rows": [{"a": "x"}]})
    assert _child(spec, "$.kpis").emphasis is None
    assert _child(spec, "$.rows").emphasis == "strong"


# --- emit (gated through validate_node) ------------------------------------------------


def test_emit_number_node() -> None:
    spec = _build(TREASURY, _treasury_data())
    node = emit_node(_child(spec, "$.balance"))
    assert node == {
        "kind": "number",
        "value": ISK_BALANCE,
        "format": "currency",
        "currency": "ISK",
    }
    validate_node(node)


def test_emit_status_clamps_rich_intents_to_neutral() -> None:
    spec = _build(TREASURY, _treasury_data())
    node = emit_node(_child(spec, "$.finality"))
    assert node == {"kind": "status", "tone": "success", "signal": {"text": "settled"}}
    sealed = {
        "type": "object",
        "properties": {"h": {"type": "string", "x-morphe": {"strategy": "status", "role": "seal"}}},
    }
    clamped = emit_node(_child(_build(sealed, {"h": "sha256:abc"}), "$.h"))
    assert clamped["tone"] == "neutral"


def test_emit_progress_self_labels() -> None:
    spec = _build(TREASURY, _treasury_data())
    node = emit_node(_child(spec, "$.window"))
    assert node == {"kind": "progress", "label": "Window coverage", "value": 0.62}
    validate_node(node)


def test_emit_kpi_row_is_a_card_grid_of_signal_cards() -> None:
    spec = _build(TREASURY, _treasury_data())
    section = emit_node(_child(spec, "$.kpis"))
    grid = next(c for c in section["children"] if c.get("kind") == "grid")
    assert grid["minTrack"] == "narrow"
    assert "columns" not in grid
    cards = grid["children"]
    assert [c["kind"] for c in cards] == ["compound", "compound"]
    assert cards[0]["name"] == "SignalCard"
    assert cards[0]["args"]["measure"]["kind"] == "number"
    assert cards[0]["args"]["measure"]["emphasis"] == "strong"
    assert cards[0]["args"]["kicker"]["intent"] == "folio"
    assert cards[0]["slots"] == {"body": []}
    assert cards[1]["args"]["measure"]["kind"] == "text"


def test_full_pipeline_compiles_and_validates() -> None:
    compiled = compile_surface(TREASURY, _treasury_data(), compiled_at="2026-07-16T00:00:00Z")
    assert compiled.tree.kind == "frame"
    # The compiled artifact already passed validate_node inside compile_surface; the
    # invariant asserted here is that every 0.3.0 kind actually reached the tree.
    kinds: set[str] = set()

    def walk(node: object) -> None:
        if isinstance(node, dict):
            mapping = cast("dict[str, object]", node)
            kind = mapping.get("kind")
            if isinstance(kind, str):
                kinds.add(kind)
            for value in mapping.values():
                walk(value)
        elif isinstance(node, list | tuple):
            for value in node:
                walk(value)

    walk(compiled.tree.model_dump(mode="json", by_alias=True, exclude_none=True))
    assert {"number", "status", "progress", "compound"} <= kinds


# --- totality ---------------------------------------------------------------------------


def test_malformed_hint_block_keeps_the_floor() -> None:
    schema = {
        "type": "object",
        "properties": {
            "n": {"type": "integer", "x-morphe": {"strategy": "number", "format": "bogus"}}
        },
    }
    spec = _build(schema, {"n": 7})
    assert _child(spec, "$.n").strategy == "scalar"


def test_kpi_row_with_garbage_rows_still_compiles() -> None:
    schema = {
        "type": "object",
        "properties": {"kpis": {"type": "array", "x-morphe": {"strategy": "kpi-row"}}},
    }
    compiled = compile_surface(schema, {"kpis": ["not-a-record", {"value": 3, "intent": "bogus"}]})
    assert compiled.tree.kind == "frame"
    assert any(d.code == "UNRENDERABLE" for d in compiled.diagnostics)


# --- authoring helpers -------------------------------------------------------------------


def test_morphe_hint_is_strict_at_authoring_time() -> None:
    block = morphe_hint(strategy="number", format="currency", currency="ISK")
    assert block == {"x-morphe": {"strategy": "number", "format": "currency", "currency": "ISK"}}
    with pytest.raises(ValueError, match="strategy"):
        morphe_hint(strategy="nubmer")


def test_malformed_currency_degrades_to_plain_number() -> None:
    # Intl.NumberFormat RAISES on a non-ISO-4217-shaped code — the compiler must
    # never emit one (renderer totality has a compiler-side twin, D8).
    schema = {
        "type": "object",
        "properties": {
            "n": {
                "type": "integer",
                "x-morphe": {"strategy": "number", "format": "currency", "currency": "USDT"},
            }
        },
    }
    spec = _build(schema, {"n": 1250})
    cell = _child(spec, "$.n")
    assert cell.strategy == "number"
    assert cell.number_format == "plain"
    assert cell.currency is None


def test_kpi_cell_refuses_malformed_currency_at_authoring_time() -> None:
    with pytest.raises(ValueError, match="ISO-4217"):
        KpiCell(label="Net", value=100, format="currency", currency="USDT")
    with pytest.raises(ValueError, match="ISO-4217"):
        morphe_hint(strategy="number", format="currency", currency="USDT")

from __future__ import annotations

import pytest
from pydantic import ValidationError

from morphe_grammar import NODE_ADAPTER, validate_node

from .fixtures import VALID_TREES, NodeFixture


@pytest.mark.parametrize("tree", VALID_TREES)
def test_valid_fixture_tree_validates(tree: NodeFixture) -> None:
    validate_node(tree)


@pytest.mark.parametrize(
    "tree",
    [
        # Bare dicts, not 1-tuples: with a single argname pytest passes each
        # item through unchanged, and a tuple would fail validation for the
        # wrong reason (not-a-node), making the a11y assertion vacuous.
        {"kind": "field", "inputType": "text"},
        {
            "kind": "select",
            "a11y": {"id": "missing-label"},
            "options": [{"value": "one", "label": "One"}],
        },
        {"kind": "toggle", "a11y": {"id": "missing-label"}},
        {"kind": "range", "a11y": {"id": "missing-label"}, "min": 0, "max": 10},
    ],
)
def test_unlabelled_input_fails_validation(tree: NodeFixture) -> None:
    with pytest.raises(ValidationError):
        validate_node(tree)


def test_icon_only_unlabelled_button_fails_validation() -> None:
    with pytest.raises(ValidationError):
        validate_node({"kind": "button", "icon": "close", "variant": "ghost"})


@pytest.mark.parametrize(
    "tree",
    [
        {"kind": "stack", "role": "list", "indent": 2, "children": []},
        {
            "kind": "grid",
            "role": "list",
            "columns": ["flexible", "content"],
            "ruled": True,
            "children": [],
        },
        {"kind": "text", "value": "(1,250)", "numeric": True, "polarity": "negative"},
        {"kind": "button", "id": "ledger-help", "label": "Open ledger help"},
    ],
)
def test_live_typescript_grammar_affordance_fields_validate(tree: NodeFixture) -> None:
    validate_node(tree)


@pytest.mark.parametrize(
    "tree",
    [
        {
            "kind": "status",
            "tone": "caution",
            "signal": {"text": "1 live violation", "icon": "warning"},
            "href": "/workers/w-1/rest-debts",
        },
        {
            "kind": "inline-alert",
            "tone": "info",
            "title": "Evidence is available",
            "detail": "Open the pane for the complete set.",
            "href": "/seals/s-1",
        },
    ],
)
def test_feedback_href_round_trips_through_the_authoritative_grammar(
    tree: NodeFixture,
) -> None:
    admitted = validate_node(tree)
    round_tripped = NODE_ADAPTER.validate_json(
        NODE_ADAPTER.dump_json(admitted, exclude_none=True)
    )

    assert round_tripped == admitted
    assert round_tripped.model_dump()["href"] == tree["href"]


def test_register_intent_validates() -> None:
    validate_node({"kind": "text", "value": "p. 12", "as": "caption", "intent": "folio"})


def test_unknown_intent_fails_validation() -> None:
    with pytest.raises(ValidationError):
        validate_node({"kind": "text", "value": "typo", "intent": "provenence"})


def test_unknown_kind_fails_validation() -> None:
    with pytest.raises(ValidationError):
        validate_node({"kind": "clickable-div", "children": []})


def test_legacy_targetless_within_remains_valid() -> None:
    validate_node(
        {
            "kind": "within",
            "id": "legacy-density",
            "dimension": "density",
            "range": [0, 1],
            "default": 0.5,
        }
    )


@pytest.mark.parametrize("dimension", ["density", "emphasis"])
def test_context_within_accepts_single_target(dimension: str) -> None:
    validate_node(
        {
            "kind": "within",
            "id": f"targeted-{dimension}",
            "dimension": dimension,
            "range": [0, 1],
            "default": 0.5,
            "target": {"kind": "text", "value": "Adapt me"},
        }
    )


def test_collapse_within_accepts_accessibly_named_target() -> None:
    validate_node(
        {
            "kind": "within",
            "id": "targeted-collapse",
            "dimension": "collapse",
            "range": [0, 1],
            "default": 1,
            "summary": "More detail",
            "target": {"kind": "text", "value": "Adapt me"},
        }
    )


@pytest.mark.parametrize("summary", ["\u0085", "\u200b", "\u2800", "\ufe0f", "\ufeff"])
def test_collapse_within_rejects_invisible_only_summary(summary: str) -> None:
    with pytest.raises(ValidationError):
        validate_node(
            {
                "kind": "within",
                "id": "invisible-collapse",
                "dimension": "collapse",
                "range": [0, 1],
                "default": 1,
                "summary": summary,
                "target": {"kind": "text", "value": "Adapt me"},
            }
        )


@pytest.mark.parametrize("summary", ["Ítarlegri upplýsingar", "詳細", "©", "😀", "❤️"])
def test_collapse_within_accepts_visible_unicode_summary(summary: str) -> None:
    validate_node(
        {
            "kind": "within",
            "id": "unicode-collapse",
            "dimension": "collapse",
            "range": [0, 1],
            "default": 1,
            "summary": summary,
            "target": {"kind": "text", "value": "Adapt me"},
        }
    )


@pytest.mark.parametrize(
    "tree",
    [
        {
            "kind": "within",
            "id": "unnamed-collapse",
            "dimension": "collapse",
            "range": [0, 1],
            "default": 1,
            "target": {"kind": "text", "value": "Adapt me"},
        },
        {
            "kind": "within",
            "id": "empty-summary",
            "dimension": "collapse",
            "range": [0, 1],
            "default": 1,
            "summary": "",
            "target": {"kind": "text", "value": "Adapt me"},
        },
        {
            "kind": "within",
            "id": "blank-summary",
            "dimension": "collapse",
            "range": [0, 1],
            "default": 1,
            "summary": "  \t",
            "target": {"kind": "text", "value": "Adapt me"},
        },
        {
            "kind": "within",
            "id": "irrelevant-summary",
            "dimension": "density",
            "range": [0, 1],
            "default": 0.5,
            "summary": "Unused",
            "target": {"kind": "text", "value": "Adapt me"},
        },
    ],
)
def test_within_rejects_inaccessible_or_irrelevant_summary(tree: NodeFixture) -> None:
    with pytest.raises(ValidationError):
        validate_node(tree)


# --- Trend (ADR-0019) ------------------------------------------------------------------

TREND_POINTS = [
    {"period": "2026-05", "value": 4},
    {"period": "2026-06", "value": 7},
    {"period": "2026-07", "value": 6},
]


def test_trend_accepts_a_typed_series_with_a_visible_summary() -> None:
    node = validate_node(
        {
            "kind": "trend",
            "points": TREND_POINTS,
            "summary": "Rose to 7 in June, easing to 6 in July.",
            "baseline": "min",
            "intent": "evidence",
        }
    )
    assert node.kind == "trend"


def test_trend_stays_total_over_degenerate_series() -> None:
    # Zero and single-point series remain representable — the renderer degrades
    # to summary-only / terminal-dot, never a crash and never invented copy.
    for points in ([], TREND_POINTS[:1]):
        validate_node({"kind": "trend", "points": points, "summary": "Flat."})


@pytest.mark.parametrize(
    "tree",
    [
        # The paired words are the primary channel: absent or invisible summaries
        # are unrepresentable (the shape must never be the only signal).
        {"kind": "trend", "points": TREND_POINTS},
        {"kind": "trend", "points": TREND_POINTS, "summary": ""},
        {"kind": "trend", "points": TREND_POINTS, "summary": " \t"},
        # Pre-rendered values are not typed values.
        {
            "kind": "trend",
            "points": [{"period": "2026-05", "value": "4 kr."}],
            "summary": "Typed values only.",
        },
    ],
)
def test_trend_rejects_unlabelled_or_untyped_series(tree: NodeFixture) -> None:
    with pytest.raises(ValidationError):
        validate_node(tree)


# --- Table (ADR-0020) ------------------------------------------------------------------


def _table_fixture(**overrides: object) -> dict[str, object]:
    tree: dict[str, object] = {
        "kind": "table",
        "caption": "Open obligations",
        "columns": [
            {"header": "Obligation"},
            {"header": "Amount", "numeric": True, "priority": "primary"},
            {"header": "Due", "priority": "detail"},
        ],
        "rows": [
            {
                "cells": [
                    {"children": [{"kind": "text", "value": "VSK return"}]},
                    {"children": [{"kind": "number", "value": 125000, "format": "integer"}]},
                    {"children": [{"kind": "text", "value": "2026-08-05", "as": "caption"}]},
                ],
                "diagnostics": [{"kind": "inline-alert", "tone": "caution", "title": "OVERDUE"}],
            }
        ],
        "responsive": "records",
        "rowHeader": True,
    }
    tree.update(overrides)
    return tree


def test_table_accepts_the_full_capability_shape() -> None:
    node = validate_node(_table_fixture())
    assert node.kind == "table"


def test_table_rejects_ragged_rows() -> None:
    # The rectangularity validator: every row carries exactly len(columns) cells.
    ragged = _table_fixture(rows=[{"cells": [{"children": [{"kind": "text", "value": "Lonely"}]}]}])
    with pytest.raises(ValidationError, match="require exactly 3"):
        validate_node(ragged)


@pytest.mark.parametrize(
    "tree",
    [
        # An unnamed table is unrepresentable.
        _table_fixture(caption=""),
        _table_fixture(caption=" \t"),
        # A blank column head is unrepresentable.
        _table_fixture(columns=[{"header": " "}], rows=[]),
        # A table with no columns has no relationships to own.
        _table_fixture(columns=[], rows=[]),
    ],
)
def test_table_rejects_unnamable_shapes(tree: NodeFixture) -> None:
    with pytest.raises(ValidationError):
        validate_node(tree)

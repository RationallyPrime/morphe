from __future__ import annotations

import pytest
from pydantic import ValidationError

from morphe_grammar import validate_node

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

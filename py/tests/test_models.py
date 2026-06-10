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


def test_unknown_kind_fails_validation() -> None:
    with pytest.raises(ValidationError):
        validate_node({"kind": "clickable-div", "children": []})

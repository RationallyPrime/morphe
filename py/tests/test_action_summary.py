from __future__ import annotations

import pytest

from morphe_grammar.catalog import (
    ACTION_SUMMARY,
    GOLD_STANDARD_COMPOUND,
    PROMOTED_COMPOUNDS,
    compound_slot_names,
)
from morphe_grammar.dialects import (
    PromotedCompoundReferenceError,
    validate_promoted_compound_references,
)
from morphe_grammar.models import validate_node
from morphe_grammar.version import GRAMMAR_VERSION


def test_action_summary_is_a_neutral_promoted_composition() -> None:
    assert GOLD_STANDARD_COMPOUND == "ActionSummary"
    assert "ActionSummary" in PROMOTED_COMPOUNDS
    assert ACTION_SUMMARY.lifecycle == "promoted"
    assert ACTION_SUMMARY.grammar_version == GRAMMAR_VERSION
    assert set(ACTION_SUMMARY.params.properties) == {"eyebrow", "title", "summary"}
    assert all(parameter.required for parameter in ACTION_SUMMARY.params.properties.values())
    assert compound_slot_names(ACTION_SUMMARY) == ("action", "context", "detail", "signal")

    validate_node(ACTION_SUMMARY.template)
    payload = ACTION_SUMMARY.template.model_dump(mode="json", by_alias=True, exclude_none=True)
    assert payload["kind"] == "stack"
    assert payload["role"] == "panel"
    assert "surface" not in payload


def test_gold_standard_reference_exercises_every_action_summary_lane() -> None:
    reference = {
        "kind": "compound",
        "name": GOLD_STANDARD_COMPOUND,
        "args": {
            "eyebrow": {"kind": "text", "value": "Gold evidence", "as": "caption"},
            "title": {"kind": "text", "value": "ActionSummary", "as": "heading"},
            "summary": {"kind": "text", "value": "Every lane is populated.", "as": "body"},
        },
        "slots": {
            "signal": [{"kind": "status", "tone": "success", "signal": {"text": "Valid"}}],
            "context": [{"kind": "text", "value": "Context", "as": "body"}],
            "action": [{"kind": "button", "label": "Advance", "action": "gold.advance"}],
            "detail": [
                {
                    "kind": "within",
                    "id": "gold.detail",
                    "dimension": "collapse",
                    "range": [0, 1],
                    "default": 0,
                    "summary": "Inspect evidence",
                    "target": {"kind": "text", "value": "Evidence", "as": "caption"},
                }
            ],
        },
    }

    validated = validate_promoted_compound_references(reference)
    assert validated.kind == "compound"


def test_promoted_reference_gate_covers_every_call_contract_failure() -> None:
    valid_args = {
        "eyebrow": {"kind": "text", "value": "Gold evidence", "as": "caption"},
        "title": {"kind": "text", "value": "ActionSummary", "as": "heading"},
        "summary": {"kind": "text", "value": "Every lane is populated.", "as": "body"},
    }
    cases = (
        (
            {"kind": "compound", "name": "ActionSummary", "args": {**valid_args, "extra": True}},
            "COMPOUND_UNKNOWN_ARG",
            "$.args",
        ),
        (
            {
                "kind": "compound",
                "name": "ActionSummary",
                "args": {**valid_args, "eyebrow": "not-a-node"},
            },
            "COMPOUND_NODE_SHAPE",
            "$.args.eyebrow",
        ),
        (
            {
                "kind": "compound",
                "name": "ActionSummary",
                "args": valid_args,
                "slots": {"invented": []},
            },
            "COMPOUND_UNKNOWN_SLOT",
            "$.slots",
        ),
        (
            {
                "kind": "compound",
                "name": "ActionSummary",
                "args": valid_args,
                "slots": {"context": [{"kind": "compound", "name": "SignalCard", "args": {}}]},
            },
            "COMPOUND_MISSING_ARG",
            "$.slots.context[0].args",
        ),
    )

    for payload, code, path in cases:
        with pytest.raises(PromotedCompoundReferenceError) as caught:
            validate_promoted_compound_references(payload)
        assert caught.value.code == code
        assert caught.value.path == path

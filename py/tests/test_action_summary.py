from __future__ import annotations

from morphe_grammar.catalog import ACTION_SUMMARY, PROMOTED_COMPOUNDS, compound_slot_names
from morphe_grammar.models import validate_node
from morphe_grammar.version import GRAMMAR_VERSION


def test_action_summary_is_a_neutral_promoted_composition() -> None:
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

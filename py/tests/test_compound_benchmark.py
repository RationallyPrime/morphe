from __future__ import annotations

from morphe_grammar.catalog import (
    GOLD_STANDARD_COMPOUND,
    PROMOTED_COMPOUNDS,
    compound_slot_names,
)
from morphe_grammar.dialects import (
    DIALECT_IDS,
    validate_node_for_dialect,
    validate_promoted_compound_references,
)
from morphe_grammar.models import validate_node

from .compound_fixtures import full_compound_reference

MINTED_COMPOUND_NAMES = (
    "ContentSection",
    "SignalBand",
    "DefinitionRow",
    "ProgressRow",
    "Trail",
    "OperationalPane",
    "RecordCard",
    "DiagnosticGroup",
    "EmptyState",
)
PROMOTED_COMPOUND_COUNT = 17


def test_mint_adds_nine_neutral_promoted_definitions_beside_one_gold_marker() -> None:
    assert tuple(PROMOTED_COMPOUNDS)[-len(MINTED_COMPOUND_NAMES) :] == MINTED_COMPOUND_NAMES
    assert len(PROMOTED_COMPOUNDS) == PROMOTED_COMPOUND_COUNT
    assert GOLD_STANDARD_COMPOUND == "ActionSummary"

    for name in MINTED_COMPOUND_NAMES:
        definition = PROMOTED_COMPOUNDS[name]
        assert definition.version == "1.0.0"
        assert definition.lifecycle == "promoted"
        assert definition.template.kind != "frame"
        assert all(parameter.type == "node" for parameter in definition.params.properties.values())
        assert compound_slot_names(definition)
        validate_node(definition.template)


def test_every_promoted_definition_has_a_complete_strict_cms_reference() -> None:
    for definition in PROMOTED_COMPOUNDS.values():
        reference = full_compound_reference(definition)
        assert set(reference["args"]) == set(definition.params.properties)
        assert set(reference["slots"]) == set(compound_slot_names(definition))

        validated = validate_promoted_compound_references(reference)
        assert validated.kind == "compound"
        for dialect_id in DIALECT_IDS:
            assert validate_node_for_dialect(reference, dialect_id).kind == "compound"

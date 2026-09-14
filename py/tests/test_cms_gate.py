from __future__ import annotations

import copy

import pytest

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.validation.diagnostics import validation_error_to_diagnostics
from morphe_cms.validation.gate import compile_and_gate
from morphe_cms.validation.policy import policy_diagnostics
from morphe_grammar.catalog import PROMOTED_COMPOUNDS
from morphe_grammar.errors import (
    DialectNodeValidationError,
    MorpheGrammarError,
    PromotedCompoundReferenceError,
)

from .cms_fixtures import VALID_DRAFT
from .compound_fixtures import full_compound_reference


def test_valid_draft_passes_gate() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    compiled, diagnostics = compile_and_gate(draft)
    assert compiled is not None
    assert compiled.tree.kind == "frame"
    assert compiled.render_hints.dialect == "gallery"
    assert [d for d in diagnostics if d.severity == "error"] == []


@pytest.mark.parametrize("compound_name", tuple(PROMOTED_COMPOUNDS))
def test_clinical_cms_gate_accepts_every_complete_promoted_reference(
    compound_name: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reference = full_compound_reference(PROMOTED_COMPOUNDS[compound_name])
    monkeypatch.setattr(
        "morphe_cms.validation.gate.present_capability_page",
        lambda _draft: reference,
    )
    payload = copy.deepcopy(VALID_DRAFT)
    payload["morphe"]["dialect"] = "clinical"
    draft = CapabilityPageDraft.model_validate(payload)

    compiled, diagnostics = compile_and_gate(draft)

    assert compiled is not None
    assert compiled.tree.kind == "compound"
    assert compiled.render_hints.dialect == "clinical"
    assert [diagnostic for diagnostic in diagnostics if diagnostic.severity == "error"] == []


def test_duplicate_section_ids_rejected_by_policy() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    diags = policy_diagnostics(draft)
    assert any(d.code == "DUPLICATE_SECTION_ID" for d in diags)


def test_policy_failure_blocks_gate() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    compiled, diagnostics = compile_and_gate(draft)
    assert compiled is None
    assert any(d.severity == "error" for d in diagnostics)


def test_validation_error_converts_to_diagnostics() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["cta"] = {"label": "Go", "intent": "primary-action"}
    try:
        CapabilityPageDraft.model_validate(payload)
    except Exception as exc:  # noqa: BLE001 - we assert on the conversion
        diags = validation_error_to_diagnostics(exc)
        assert diags
        assert all(d.severity == "error" for d in diags)
        assert all(d.path for d in diags)
    else:
        msg = "expected ValidationError"
        raise AssertionError(msg)


def test_gate_rejects_a_malformed_promoted_compound(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "morphe_cms.validation.gate.present_capability_page",
        lambda _draft: {"kind": "compound", "name": "ActionSummary", "args": {}},
    )
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)

    compiled, diagnostics = compile_and_gate(draft)

    assert compiled is None
    assert [diagnostic.code for diagnostic in diagnostics] == ["COMPOUND_MISSING_ARG"]
    assert diagnostics[0].path == "$.args"


def test_gate_rejects_a_non_catalog_compound(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "morphe_cms.validation.gate.present_capability_page",
        lambda _draft: {"kind": "compound", "name": "ConsumerOnly", "args": {}},
    )
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)

    compiled, diagnostics = compile_and_gate(draft)

    assert compiled is None
    assert [diagnostic.code for diagnostic in diagnostics] == ["COMPOUND_UNKNOWN_NAME"]
    assert diagnostics[0].path == "$.name"


def test_gate_converts_a_presenter_failure_to_a_fail_closed_diagnostic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_presenter(_draft: CapabilityPageDraft) -> dict[str, object]:
        msg = "presenter failed"
        raise RuntimeError(msg)

    monkeypatch.setattr("morphe_cms.validation.gate.present_capability_page", fail_presenter)
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)

    compiled, diagnostics = compile_and_gate(draft)

    assert compiled is None
    assert [diagnostic.code for diagnostic in diagnostics] == ["UNEXPECTED_ERROR"]
    assert diagnostics[0].message == "presenter failed"


def test_diagnostics_map_typed_grammar_errors_structurally() -> None:
    dialect = DialectNodeValidationError(
        code="COMPOUND_NOT_PERMITTED",
        dialect_id="clinical",
        path="$.children[0]",
        message="not permitted",
    )
    promoted = PromotedCompoundReferenceError(
        code="COMPOUND_UNKNOWN_NAME",
        path="$.name",
        message="unknown",
    )
    dialect_diags = validation_error_to_diagnostics(dialect)
    promoted_diags = validation_error_to_diagnostics(promoted)
    assert dialect_diags[0].code == "COMPOUND_NOT_PERMITTED"
    assert dialect_diags[0].path == "$.children[0]"
    assert promoted_diags[0].code == "COMPOUND_UNKNOWN_NAME"
    assert isinstance(dialect, MorpheGrammarError)
    assert isinstance(promoted, MorpheGrammarError)


def test_diagnostics_do_not_duck_type_foreign_exceptions() -> None:
    class ForeignError(Exception):
        code = "LOOKS_TYPED"
        path = "$.spoof"

    diags = validation_error_to_diagnostics(ForeignError("nope"))
    assert [diagnostic.code for diagnostic in diags] == ["UNEXPECTED_ERROR"]
    assert diags[0].path == ""

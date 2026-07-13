from __future__ import annotations

import copy

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.validation.diagnostics import validation_error_to_diagnostics
from morphe_cms.validation.gate import compile_and_gate
from morphe_cms.validation.policy import policy_diagnostics

from .cms_fixtures import VALID_DRAFT


def test_valid_draft_passes_gate() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    compiled, diagnostics = compile_and_gate(draft)
    assert compiled is not None
    assert compiled.tree.kind == "frame"
    assert compiled.render_hints.dialect == "gallery"
    assert [d for d in diagnostics if d.severity == "error"] == []


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

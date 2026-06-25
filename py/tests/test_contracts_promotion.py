from __future__ import annotations

import pytest
from pydantic import ValidationError

from morphe_cms.contracts.shared import Diagnostic as CmsDiagnostic
from morphe_contracts import CompiledArtifact, ContractModel, Diagnostic


def test_diagnostic_shape_matches_affordance_contract() -> None:
    d = Diagnostic(code="X", severity="error", path="$.a", message="bad")
    assert d.severity == "error"
    assert d.repair_hint is None


def test_contract_model_forbids_extra() -> None:
    class M(ContractModel):
        a: int

    with pytest.raises(ValidationError):
        M.model_validate({"a": 1, "b": 2})


def test_compiled_artifact_base_fields() -> None:
    art = CompiledArtifact(
        tree={"kind": "spacer"},
        grammar_version="0.1.0",
        producer_version="0.1.0",
        diagnostics=[],
        produced_at="",
    )
    assert art.tree["kind"] == "spacer"


def test_cms_reexports_are_the_promoted_types() -> None:
    # Identity, not shape: cms's Diagnostic must BE the promoted base type.
    assert CmsDiagnostic is Diagnostic

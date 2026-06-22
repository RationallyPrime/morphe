from __future__ import annotations

import pytest
from pydantic import ValidationError

from morphe_cms.contracts.shared import Diagnostic, MorpheControls


def test_package_imports() -> None:
    import morphe_cms  # noqa: PLC0415

    assert morphe_cms.__doc__ is not None


def test_morphe_controls_defaults() -> None:
    mc = MorpheControls()
    assert mc.dialect == "gallery"
    assert mc.primary_intent == "evidence"
    assert mc.surface == "base"
    assert mc.emphasis == "normal"


def test_morphe_controls_rejects_unknown_dialect() -> None:
    with pytest.raises(ValidationError):
        MorpheControls(dialect="fantasy-dialect")  # ty: ignore[invalid-argument-type]


def test_morphe_controls_rejects_extra_field() -> None:
    with pytest.raises(ValidationError):
        MorpheControls(color="#0047ff")  # ty: ignore[unknown-argument]


def test_diagnostic_shape() -> None:
    d = Diagnostic(code="X", severity="error", path="a.b", message="m")
    assert d.repair_hint is None

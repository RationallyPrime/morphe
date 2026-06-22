from __future__ import annotations

import copy

import pytest
from pydantic import ValidationError

from morphe_cms.contracts.capability_page import CapabilityPageDraft

from .cms_fixtures import VALID_DRAFT


def test_valid_draft_accepts() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    assert draft.slug == "workflow-automation"
    assert draft.sections[0].kind == "problemFrame"


def test_rejects_unknown_field() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["hero"]["color"] = "#0047ff"
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_cta_requires_action_or_href() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["cta"] = {"label": "Go", "intent": "primary-action"}
    with pytest.raises(ValidationError, match="action_id or href"):
        CapabilityPageDraft.model_validate(payload)


def test_unknown_section_kind_rejected() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["kind"] = "mysterySection"
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_unknown_intent_rejected() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["proof_points"][0]["intent"] = "urgent-blue"
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_overlong_title_rejected() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["hero"]["title"] = "x" * 200
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)


def test_requires_at_least_one_section() -> None:
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"] = []
    with pytest.raises(ValidationError):
        CapabilityPageDraft.model_validate(payload)

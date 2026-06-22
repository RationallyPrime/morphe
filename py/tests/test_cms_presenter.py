from __future__ import annotations

from morphe_cms.contracts.capability_page import CTA, HeroBlock, ProofPoint
from morphe_cms.contracts.shared import MorpheControls
from morphe_cms.presenter.capability_page import (
    present_cta,
    present_hero,
    present_proof_points,
)
from morphe_grammar import validate_node


def test_hero_emits_valid_stack() -> None:
    hero = HeroBlock(title="A clear title", thesis="A thesis long enough to satisfy the bound.")
    node = present_hero(hero, None, MorpheControls())
    assert node["kind"] == "stack"
    assert node["role"] == "section"
    validate_node(node)
    titles = [c for c in node["children"] if c.get("as") == "display"]
    assert titles and titles[0]["value"] == "A clear title"  # noqa: PT018


def test_cta_with_action_is_button() -> None:
    cta = CTA(label="Go now", action_id="open_composer")
    node = present_cta(cta)
    assert node["kind"] == "button"
    assert node["action"] == "open_composer"
    assert node["label"] == "Go now"
    validate_node(node)


def test_cta_with_href_is_link() -> None:
    cta = CTA(label="Visit", href="https://example.com/x")  # ty: ignore[invalid-argument-type]
    node = present_cta(cta)
    assert node["kind"] == "link"
    assert node["href"].startswith("https://example.com")
    validate_node(node)


def test_proof_points_emit_valid_list() -> None:
    pts = [ProofPoint(label="Typed", claim="Validated before render.", intent="evidence")]
    node = present_proof_points(pts)
    assert node is not None
    assert node["role"] == "list"
    validate_node(node)


def test_empty_proof_points_returns_none() -> None:
    assert present_proof_points([]) is None

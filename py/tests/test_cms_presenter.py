from __future__ import annotations

from morphe_cms.contracts.capability_page import CTA, CapabilityPageDraft, HeroBlock, ProofPoint
from morphe_cms.contracts.shared import MorpheControls
from morphe_cms.presenter.capability_page import (
    present_capability_page,
    present_cta,
    present_hero,
    present_proof_points,
    present_section,
)
from morphe_grammar import validate_node
from morphe_grammar import validate_node as _vn

from .cms_fixtures import VALID_DRAFT


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


def test_each_section_kind_compiles() -> None:
    for section in CapabilityPageDraft.model_validate(VALID_DRAFT).sections:
        node = present_section(section)
        assert node["kind"] == "stack"
        _vn(node)


def test_faq_section_uses_disclosure() -> None:
    draft = CapabilityPageDraft.model_validate(
        {
            **VALID_DRAFT,
            "sections": [
                {
                    "kind": "faq",
                    "title": "Questions",
                    "items": [
                        {"question": "Is it typed?", "answer": "Yes, every artifact is validated."},
                        {"question": "Can it re-theme?", "answer": "Yes, by swapping the dialect."},
                    ],
                }
            ],
        }
    )
    node = present_section(draft.sections[0])
    kinds = [c["kind"] for c in node["children"]]
    assert "disclosure" in kinds


def test_full_page_compiles_and_is_valid() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    tree = present_capability_page(draft)
    assert tree["kind"] == "frame"
    assert tree["role"] == "page"
    assert tree["surface"] == "base"
    _vn(tree)


def test_presenter_is_deterministic() -> None:
    draft = CapabilityPageDraft.model_validate(VALID_DRAFT)
    assert present_capability_page(draft) == present_capability_page(draft)


def test_hero_variation_emits_vary() -> None:
    draft = CapabilityPageDraft.model_validate(
        {
            **VALID_DRAFT,
            "hero_variation": {
                "objective": "salience",
                "variants": [
                    {
                        "angle": "governance",
                        "title": "Accountable automation",
                        "thesis": "Stay on the record while moving fast.",
                    },
                    {
                        "angle": "speed",
                        "title": "Faster operational loops",
                        "thesis": "Cut release latency without losing control.",
                    },
                ],
            },
        }
    )
    tree = present_capability_page(draft)
    vary_nodes = [c for c in tree["children"] if c.get("kind") == "vary"]
    assert vary_nodes and vary_nodes[0]["default"] == 0  # noqa: PT018
    _vn(tree)

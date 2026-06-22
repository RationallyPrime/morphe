from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from morphe_cms.contracts.capability_page import (
        CTA,
        HeroBlock,
        HeroVariation,
        ProofPoint,
    )
    from morphe_cms.contracts.shared import MorpheControls

Node = dict[str, Any]


def _text(
    value: str,
    *,
    as_: str,
    emphasis: str | None = None,
    intent: str | None = None,
) -> Node:
    node: Node = {"kind": "text", "value": value, "as": as_}
    if emphasis is not None:
        node["emphasis"] = emphasis
    if intent is not None:
        node["intent"] = intent
    return node


def present_hero(
    hero: HeroBlock,
    variation: HeroVariation | None,
    morphe: MorpheControls,
) -> Node:
    if variation is not None:
        return _present_hero_variation(hero, variation, morphe)
    return _hero_stack(hero.kicker, hero.title, hero.thesis, hero.supporting_claim, morphe)


def _hero_stack(
    kicker: str | None,
    title: str,
    thesis: str,
    supporting: str | None,
    morphe: MorpheControls,
) -> Node:
    children: list[Node] = []
    if kicker:
        children.append(_text(kicker, as_="caption", intent="accession"))
    children.append(_text(title, as_="display", emphasis="strong", intent=morphe.primary_intent))
    children.append(_text(thesis, as_="body"))
    if supporting:
        children.append(_text(supporting, as_="body", emphasis="muted"))
    return {"kind": "stack", "role": "section", "children": children}


def _present_hero_variation(
    hero: HeroBlock,
    variation: HeroVariation,
    morphe: MorpheControls,
) -> Node:
    # Vary renders its default branch only until the mid-loop layer lands (CONTRACT §11);
    # default (index 0) is the authored base hero so the page is stable today.
    options: list[Node] = [
        _hero_stack(hero.kicker, hero.title, hero.thesis, hero.supporting_claim, morphe)
    ]
    options.extend(
        _hero_stack(hero.kicker, v.title, v.thesis, hero.supporting_claim, morphe)
        for v in variation.variants
    )
    return {
        "kind": "vary",
        "id": "hero",
        "objective": variation.objective,
        "default": 0,
        "options": options,
    }


def present_proof_points(points: list[ProofPoint]) -> Node | None:
    if not points:
        return None
    children: list[Node] = []
    for pt in points:
        item: list[Node] = [{"kind": "badge", "label": pt.label}]
        if pt.intent is not None:
            item[0]["intent"] = pt.intent
        item.append(_text(pt.claim, as_="body"))
        if pt.evidence:
            item.append(_text(pt.evidence, as_="caption", emphasis="muted"))
        children.append({"kind": "stack", "role": "inline", "children": item})
    return {"kind": "stack", "role": "list", "children": children}


def present_cta(cta: CTA) -> Node:
    if cta.action_id:
        return {
            "kind": "button",
            "label": cta.label,
            "action": cta.action_id,
            "intent": cta.intent,
        }
    return {
        "kind": "link",
        "href": str(cta.href),
        "label": cta.label,
        "intent": cta.intent,
    }

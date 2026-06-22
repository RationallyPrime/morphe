from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_cms.contracts.capability_page import (
    CapabilityPageDraft,
    CaseProofSection,
    FAQSection,
    ProblemFrameSection,
    WorkflowMapSection,
)

if TYPE_CHECKING:
    from morphe_cms.contracts.capability_page import (
        CTA,
        HeroBlock,
        HeroVariation,
        ProofPoint,
    )
    from morphe_cms.contracts.shared import MorpheControls

Node = dict[str, Any]

PRESENTER_VERSION = "0.1.0"


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


def _section_shell(title: str, children: list[Node]) -> Node:
    head: list[Node] = [_text(title, as_="heading", emphasis="strong")]
    return {"kind": "stack", "role": "section", "children": head + children}


def _present_problem_frame(s: ProblemFrameSection) -> Node:
    body: list[Node] = [_text(s.claim, as_="body", intent=s.intent)]
    body.extend(_text(e, as_="body", emphasis="muted") for e in s.evidence)
    return _section_shell(s.title, body)


def _present_workflow_map(s: WorkflowMapSection) -> Node:
    steps: list[Node] = []
    for i, step in enumerate(s.steps, start=1):
        item: list[Node] = [
            {"kind": "badge", "label": str(i)},
            _text(step.label, as_="subheading", emphasis="strong"),
            _text(step.description, as_="body"),
        ]
        if step.evidence:
            item.append(_text(step.evidence, as_="caption", emphasis="muted"))
        steps.append({"kind": "stack", "role": "inline", "children": item})
    return _section_shell(s.title, [{"kind": "stack", "role": "list", "children": steps}])


def _present_case_proof(s: CaseProofSection) -> Node:
    body: list[Node] = []
    if s.company_shape:
        body.append(_text(s.company_shape, as_="caption", intent="provenance"))
    body.append(_text(s.before, as_="body", emphasis="muted"))
    body.append(_text(s.after, as_="body", intent=s.intent))
    for m in s.metrics:
        metric: list[Node] = [
            _text(m.value, as_="display", emphasis="strong", intent="evidence"),
            _text(m.label, as_="caption"),
        ]
        if m.explanation:
            metric.append(_text(m.explanation, as_="caption", emphasis="muted"))
        body.append({"kind": "stack", "role": "inline", "children": metric})
    return _section_shell(s.title, body)


def _present_faq(s: FAQSection) -> Node:
    items: list[Node] = [
        {
            "kind": "disclosure",
            "summary": item.question,
            "children": [_text(item.answer, as_="body")],
        }
        for item in s.items
    ]
    return _section_shell(s.title, items)


def present_section(section: object) -> Node:
    if isinstance(section, ProblemFrameSection):
        return _present_problem_frame(section)
    if isinstance(section, WorkflowMapSection):
        return _present_workflow_map(section)
    if isinstance(section, CaseProofSection):
        return _present_case_proof(section)
    if isinstance(section, FAQSection):
        return _present_faq(section)
    msg = f"unsupported section type: {type(section).__name__}"
    raise ValueError(msg)


def present_capability_page(draft: CapabilityPageDraft) -> Node:
    children: list[Node] = [present_hero(draft.hero, draft.hero_variation, draft.morphe)]
    proof = present_proof_points(draft.proof_points)
    if proof is not None:
        children.append(proof)
    children.append(
        {
            "kind": "stack",
            "role": "section",
            "children": [present_section(s) for s in draft.sections],
        }
    )
    children.append(present_cta(draft.cta))
    return {
        "kind": "frame",
        "role": "page",
        "surface": draft.morphe.surface,
        "children": children,
    }

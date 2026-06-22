from __future__ import annotations

from typing import Annotated, Literal, Self

from pydantic import Field, HttpUrl, model_validator

from .shared import Audience, CmsModel, IntentRef, MorpheControls, Slug


class HeroBlock(CmsModel):
    kicker: Annotated[str | None, Field(max_length=48)] = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    thesis: Annotated[str, Field(min_length=20, max_length=320)]
    supporting_claim: Annotated[str | None, Field(max_length=220)] = None


class ProofPoint(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=64)]
    claim: Annotated[str, Field(min_length=8, max_length=240)]
    evidence: Annotated[str | None, Field(max_length=240)] = None
    intent: IntentRef | None = None


class CTA(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=48)]
    action_id: Annotated[str | None, Field(pattern=r"^[a-z][a-z0-9_]*$")] = None
    href: HttpUrl | None = None
    intent: IntentRef = "primary-action"

    @model_validator(mode="after")
    def require_action_or_href(self) -> Self:
        if not self.action_id and not self.href:
            msg = "CTA requires either action_id or href"
            raise ValueError(msg)
        return self


class ProblemFrameSection(CmsModel):
    kind: Literal["problemFrame"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    claim: Annotated[str, Field(min_length=12, max_length=280)]
    evidence: Annotated[
        list[Annotated[str, Field(min_length=4, max_length=220)]],
        Field(default_factory=list, max_length=5),
    ]
    intent: IntentRef | None = None


class WorkflowStep(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=64)]
    description: Annotated[str, Field(min_length=8, max_length=220)]
    evidence: Annotated[str | None, Field(max_length=220)] = None


class WorkflowMapSection(CmsModel):
    kind: Literal["workflowMap"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    steps: Annotated[list[WorkflowStep], Field(min_length=2, max_length=7)]
    intent: IntentRef | None = None


class Metric(CmsModel):
    label: Annotated[str, Field(min_length=2, max_length=64)]
    value: Annotated[str, Field(min_length=1, max_length=32)]
    explanation: Annotated[str | None, Field(max_length=160)] = None


class CaseProofSection(CmsModel):
    kind: Literal["caseProof"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    company_shape: Annotated[str | None, Field(max_length=120)] = None
    before: Annotated[str, Field(min_length=8, max_length=240)]
    after: Annotated[str, Field(min_length=8, max_length=240)]
    metrics: Annotated[list[Metric], Field(default_factory=list, max_length=4)]
    intent: IntentRef | None = None


class FAQItem(CmsModel):
    question: Annotated[str, Field(min_length=8, max_length=140)]
    answer: Annotated[str, Field(min_length=12, max_length=420)]


class FAQSection(CmsModel):
    kind: Literal["faq"]
    id: Slug | None = None
    title: Annotated[str, Field(min_length=4, max_length=96)]
    items: Annotated[list[FAQItem], Field(min_length=2, max_length=8)]
    intent: IntentRef | None = None


CapabilitySection = Annotated[
    ProblemFrameSection | WorkflowMapSection | CaseProofSection | FAQSection,
    Field(discriminator="kind"),
]


class HeroVariant(CmsModel):
    angle: Literal["governance", "speed", "cost", "trust", "technical"]
    title: Annotated[str, Field(min_length=4, max_length=96)]
    thesis: Annotated[str, Field(min_length=20, max_length=320)]


class HeroVariation(CmsModel):
    objective: Literal["salience", "density", "compactness"] = "salience"
    variants: Annotated[list[HeroVariant], Field(min_length=2, max_length=5)]


class CapabilityPageDraft(CmsModel):
    slug: Slug
    audience: Audience
    morphe: MorpheControls = Field(default_factory=MorpheControls)
    hero: HeroBlock
    hero_variation: HeroVariation | None = None
    proof_points: Annotated[list[ProofPoint], Field(default_factory=list, max_length=6)]
    sections: Annotated[list[CapabilitySection], Field(min_length=1, max_length=8)]
    cta: CTA
    source_ids: Annotated[list[str], Field(default_factory=list, max_length=12)]

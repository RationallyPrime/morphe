from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .shared import CmsModel, Diagnostic, RenderHints

ArtifactType = Literal[
    "landingPage",
    "capabilityPage",
    "caseStudy",
    "comparisonPage",
    "article",
    "campaignPage",
]


class ArtifactProvenance(CmsModel):
    created_by: Literal["agent", "human", "migration"]
    prompt_id: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    created_at: str


class ArtifactEnvelope(CmsModel):
    id: str
    type: ArtifactType
    schema_version: str
    presenter_version: str
    # Frozen at write time: "draft" (gate failed) or "validated" (gate passed). Never
    # mutated. "published"/"archived" are pointer facts, not file mutations (see store).
    status: Literal["draft", "validated", "published", "archived"]
    data: dict[str, Any]
    provenance: ArtifactProvenance


class CompiledTree(CmsModel):
    artifact_id: str
    revision_id: str
    grammar_version: str
    presenter_version: str
    tree: dict[str, Any]
    render_hints: RenderHints
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    compiled_at: str


class Publication(CmsModel):
    slug: str
    artifact_id: str
    revision_id: str
    channel: Literal["site", "preview", "campaign"]
    published_at: str
    published_by: Literal["agent", "human", "system"]

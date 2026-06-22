from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field

from morphe_cms.contracts.capability_page import CapabilityPageDraft  # noqa: TC001
from morphe_cms.contracts.shared import CmsModel, DialectName, Slug


class CreateCapabilityPageInput(CmsModel):
    draft: CapabilityPageDraft
    rationale: Annotated[str | None, Field(max_length=800)] = None


class ToolResult(CmsModel):
    ok: bool
    artifact_id: str | None = None
    revision_id: str | None = None
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)


class ValidateContentArtifactInput(CmsModel):
    artifact_id: str
    revision_id: str
    # Reserved: not enforced in v0 (no warning-severity rules exist to relax yet). Kept
    # for PRD §9.3 tool-contract parity; wire when a strict/lenient distinction is real.
    strict: bool = True


class RenderPreviewInput(CmsModel):
    artifact_id: str
    revision_id: str
    viewport: Literal["mobile", "desktop"] = "desktop"
    dialect: DialectName | None = None


class RenderPreviewResult(CmsModel):
    ok: bool
    preview_url: str | None = None
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)


class PublishContentArtifactInput(CmsModel):
    artifact_id: str
    revision_id: str
    slug: Slug
    channel: Literal["site", "preview", "campaign"] = "site"

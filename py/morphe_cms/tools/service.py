from __future__ import annotations

from typing import TYPE_CHECKING, Literal

from morphe_cms.contracts.artifact import ArtifactEnvelope, ArtifactProvenance, Publication
from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.presenter.capability_page import PRESENTER_VERSION
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    RenderPreviewInput,
    RenderPreviewResult,
    ToolResult,
    ValidateContentArtifactInput,
)
from morphe_cms.validation.gate import compile_and_gate

if TYPE_CHECKING:
    from morphe_cms.store.files import FileStore

SCHEMA_VERSION = "0.1.0"


def _artifact_id(slug: str) -> str:
    return f"capability-page.{slug}"


def create_capability_page(
    payload: CreateCapabilityPageInput, store: FileStore, *, now: str
) -> ToolResult:
    draft = payload.draft
    slug = draft.slug
    artifact_id = _artifact_id(slug)
    revision_id = store.next_revision_id(slug)

    compiled, diagnostics = compile_and_gate(
        draft, artifact_id=artifact_id, revision_id=revision_id, compiled_at=now
    )
    status: Literal["draft", "validated"] = "validated" if compiled is not None else "draft"

    envelope = ArtifactEnvelope(
        id=artifact_id,
        type="capabilityPage",
        schema_version=SCHEMA_VERSION,
        presenter_version=PRESENTER_VERSION,
        status=status,
        data=draft.model_dump(mode="json"),
        provenance=ArtifactProvenance(
            created_by="agent", source_ids=list(draft.source_ids), created_at=now
        ),
    )
    store.write_artifact(slug, revision_id, envelope)
    store.write_diagnostics(slug, revision_id, diagnostics)
    if compiled is not None:
        store.write_compiled(slug, revision_id, compiled)

    return ToolResult(
        ok=compiled is not None,
        artifact_id=artifact_id,
        revision_id=revision_id,
        diagnostics=[d.model_dump() for d in diagnostics],
    )


def validate_content_artifact(
    payload: ValidateContentArtifactInput, store: FileStore
) -> ToolResult:
    slug = payload.artifact_id.removeprefix("capability-page.")
    envelope = store.read_artifact(slug, payload.revision_id)
    draft = CapabilityPageDraft.model_validate(envelope.data)
    compiled, diagnostics = compile_and_gate(
        draft, artifact_id=payload.artifact_id, revision_id=payload.revision_id
    )
    return ToolResult(
        ok=compiled is not None,
        artifact_id=payload.artifact_id,
        revision_id=payload.revision_id,
        diagnostics=[d.model_dump() for d in diagnostics],
    )


def render_preview(payload: RenderPreviewInput, store: FileStore) -> RenderPreviewResult:
    slug = payload.artifact_id.removeprefix("capability-page.")
    if not store.has_validated_revision(slug, payload.revision_id):
        return RenderPreviewResult(
            ok=False,
            diagnostics=[
                {
                    "code": "NO_COMPILED_TREE",
                    "severity": "error",
                    "path": "revision_id",
                    "message": "No compiled tree exists for this revision; validate it first.",
                }
            ],
        )
    return RenderPreviewResult(
        ok=True, preview_url=f"/preview/{payload.artifact_id}/{payload.revision_id}"
    )


def publish_content_artifact(
    payload: PublishContentArtifactInput, store: FileStore, *, now: str
) -> ToolResult:
    slug = payload.slug
    if not store.has_validated_revision(slug, payload.revision_id):
        return ToolResult(
            ok=False,
            artifact_id=payload.artifact_id,
            revision_id=payload.revision_id,
            diagnostics=[
                {
                    "code": "REVISION_NOT_VALIDATED",
                    "severity": "error",
                    "path": "revision_id",
                    "message": (
                        "Publish requires a revision with a stored, gate-passing compiled tree."
                    ),
                }
            ],
        )
    store.publish(
        slug,
        Publication(
            slug=slug,
            artifact_id=payload.artifact_id,
            revision_id=payload.revision_id,
            channel=payload.channel,
            published_at=now,
            published_by="agent",
        ),
    )
    return ToolResult(ok=True, artifact_id=payload.artifact_id, revision_id=payload.revision_id)

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

from morphe_cms.contracts.capability_page import CapabilityPageDraft

if TYPE_CHECKING:
    from pathlib import Path
from morphe_cms.store.files import FileStore
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    RenderPreviewInput,
    ValidateContentArtifactInput,
)
from morphe_cms.tools.service import (
    create_capability_page,
    publish_content_artifact,
    render_preview,
    validate_content_artifact,
)

from .cms_fixtures import VALID_DRAFT

_NOW = "2026-06-22T00:00:00Z"


def _create(store: FileStore, draft_payload: dict[str, object]) -> tuple[str, str]:
    draft = CapabilityPageDraft.model_validate(draft_payload)
    result = create_capability_page(CreateCapabilityPageInput(draft=draft), store, now=_NOW)
    assert result.ok is True
    assert result.artifact_id is not None
    assert result.revision_id is not None
    return result.artifact_id, result.revision_id


def test_create_validate_publish(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    artifact_id, revision_id = _create(store, VALID_DRAFT)

    env = store.read_artifact("workflow-automation", revision_id)
    assert env.status == "validated"

    preview = render_preview(
        RenderPreviewInput(artifact_id=artifact_id, revision_id=revision_id), store
    )
    assert preview.preview_url == f"/preview/{artifact_id}/{revision_id}"

    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id=artifact_id, revision_id=revision_id, slug="workflow-automation"
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is True
    assert store.read_publications()["workflow-automation"].revision_id == revision_id


def test_policy_invalid_saves_draft_not_published(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    result = create_capability_page(CreateCapabilityPageInput(draft=draft), store, now=_NOW)
    assert result.ok is False
    assert any(d["severity"] == "error" for d in result.diagnostics)
    revision_id = result.revision_id
    assert revision_id is not None
    env = store.read_artifact("workflow-automation", revision_id)
    assert env.status == "draft"
    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id="capability-page.workflow-automation",
            revision_id=revision_id,
            slug="workflow-automation",
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is False


def test_publish_requires_exact_validated_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    artifact_id, _ = _create(store, VALID_DRAFT)
    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id=artifact_id, revision_id="rev-999", slug="workflow-automation"
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is False


def test_validate_content_artifact_passes_for_valid_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    artifact_id, revision_id = _create(store, VALID_DRAFT)
    result = validate_content_artifact(
        ValidateContentArtifactInput(artifact_id=artifact_id, revision_id=revision_id), store
    )
    assert result.ok is True
    assert result.diagnostics == []


def test_validate_content_artifact_fails_for_policy_invalid_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    created = create_capability_page(CreateCapabilityPageInput(draft=draft), store, now=_NOW)
    revision_id = created.revision_id
    assert revision_id is not None
    result = validate_content_artifact(
        ValidateContentArtifactInput(
            artifact_id="capability-page.workflow-automation", revision_id=revision_id
        ),
        store,
    )
    assert result.ok is False
    assert any(d["severity"] == "error" for d in result.diagnostics)


def test_render_preview_fails_without_compiled_tree(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    payload = copy.deepcopy(VALID_DRAFT)
    payload["sections"][0]["id"] = "dupe"
    payload["sections"][1]["id"] = "dupe"
    draft = CapabilityPageDraft.model_validate(payload)
    created = create_capability_page(CreateCapabilityPageInput(draft=draft), store, now=_NOW)
    revision_id = created.revision_id
    assert revision_id is not None
    preview = render_preview(
        RenderPreviewInput(
            artifact_id="capability-page.workflow-automation", revision_id=revision_id
        ),
        store,
    )
    assert preview.ok is False
    assert preview.preview_url is None
    assert any(d["code"] == "NO_COMPILED_TREE" for d in preview.diagnostics)


def test_publish_rejects_slug_mismatch(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    artifact_id, revision_id = _create(store, VALID_DRAFT)
    pub = publish_content_artifact(
        PublishContentArtifactInput(
            artifact_id=artifact_id, revision_id=revision_id, slug="different-slug"
        ),
        store,
        now=_NOW,
    )
    assert pub.ok is False
    assert any(d["code"] == "SLUG_MISMATCH" for d in pub.diagnostics)

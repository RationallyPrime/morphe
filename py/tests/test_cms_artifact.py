from __future__ import annotations

import pytest
from pydantic import ValidationError

from morphe_cms.contracts.artifact import ArtifactEnvelope, CompiledTree, Publication
from morphe_grammar import GRAMMAR_VERSION


def _envelope(**overrides: object) -> ArtifactEnvelope:
    base: dict[str, object] = {
        "id": "capability-page.workflow-automation",
        "type": "capabilityPage",
        "schema_version": "0.1.0",
        "presenter_version": "0.1.0",
        "status": "validated",
        "data": {"slug": "workflow-automation"},
        "provenance": {"created_by": "agent", "created_at": "2026-06-22T00:00:00Z"},
    }
    base.update(overrides)
    return ArtifactEnvelope.model_validate(base)


def test_envelope_accepts_valid() -> None:
    env = _envelope()
    assert env.status == "validated"
    assert env.provenance.created_by == "agent"


def test_envelope_rejects_unknown_status() -> None:
    with pytest.raises(ValidationError):
        _envelope(status="totally-shipped")


def test_compiled_tree_carries_render_hints() -> None:
    ct = CompiledTree.model_validate(
        {
            "artifact_id": "capability-page.x",
            "revision_id": "rev-001",
            "grammar_version": GRAMMAR_VERSION,
            "producer_version": "0.1.0",
            "presenter_version": "0.1.0",
            "tree": {"kind": "frame", "role": "page", "children": []},
            "render_hints": {"dialect": "gallery"},
            "produced_at": "2026-06-22T00:00:00Z",
        }
    )
    assert ct.render_hints.dialect == "gallery"


def test_publication_shape() -> None:
    pub = Publication.model_validate(
        {
            "slug": "workflow-automation",
            "artifact_id": "capability-page.workflow-automation",
            "revision_id": "rev-001",
            "channel": "site",
            "published_at": "2026-06-22T00:00:00Z",
            "published_by": "agent",
        }
    )
    assert pub.channel == "site"

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from pathlib import Path

from morphe_cms.contracts.artifact import (
    ArtifactEnvelope,
    ArtifactProvenance,
    CompiledTree,
    Publication,
)
from morphe_cms.contracts.shared import RenderHints
from morphe_cms.store.files import FileStore
from morphe_grammar import GRAMMAR_VERSION, validate_node


def _envelope() -> ArtifactEnvelope:
    return ArtifactEnvelope(
        id="capability-page.demo",
        type="capabilityPage",
        schema_version="0.1.0",
        presenter_version="0.1.0",
        status="validated",
        data={"slug": "demo"},
        provenance=ArtifactProvenance(created_by="agent", created_at="2026-06-22T00:00:00Z"),
    )


def _compiled(rev: str) -> CompiledTree:
    return CompiledTree(
        artifact_id="capability-page.demo",
        revision_id=rev,
        grammar_version=GRAMMAR_VERSION,
        producer_version="0.1.0",
        presenter_version="0.1.0",
        tree=validate_node({"kind": "frame", "role": "page", "children": []}),
        render_hints=RenderHints(dialect="gallery"),
        produced_at="2026-06-22T00:00:00Z",
    )


def _publication(rev: str) -> Publication:
    return Publication(
        slug="demo",
        artifact_id="capability-page.demo",
        revision_id=rev,
        channel="site",
        published_at="2026-06-22T00:00:00Z",
        published_by="agent",
    )


def test_revision_ids_increment(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    assert store.next_revision_id("demo") == "rev-001"
    store.write_artifact("demo", "rev-001", _envelope())
    assert store.next_revision_id("demo") == "rev-002"


def test_write_and_read_compiled_roundtrip(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    got = store.read_compiled("demo", "rev-001")
    assert got.render_hints.dialect == "gallery"


def test_publish_then_rollback(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    store.write_compiled("demo", "rev-002", _compiled("rev-002"))
    store.publish("demo", _publication("rev-002"))
    assert store.read_publications()["demo"].revision_id == "rev-002"
    store.publish("demo", _publication("rev-001"))  # rollback = repoint
    assert store.read_publications()["demo"].revision_id == "rev-001"


def test_has_validated_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    assert store.has_validated_revision("demo", "rev-001") is False
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    assert store.has_validated_revision("demo", "rev-001") is True


def test_corrupt_compiled_tree_is_not_a_validated_revision(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    path = tmp_path / "compiled" / "capability-pages" / "demo" / "rev-001.tree.json"
    path.parent.mkdir(parents=True)
    path.write_text(
        '{"artifact_id":"capability-page.demo","revision_id":"rev-001",'
        f'"grammar_version":"{GRAMMAR_VERSION}","producer_version":"0.1.0",'
        '"presenter_version":"0.1.0","tree":{"kind":"text"},'
        '"render_hints":{"dialect":"gallery"},"produced_at":""}',
        encoding="utf-8",
    )

    assert store.has_validated_revision("demo", "rev-001") is False


def test_next_revision_id_is_gap_tolerant(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    store.write_compiled("demo", "rev-003", _compiled("rev-003"))
    assert store.next_revision_id("demo") == "rev-004"


def test_revision_writes_are_immutable(tmp_path: Path) -> None:
    store = FileStore(tmp_path)
    store.write_compiled("demo", "rev-001", _compiled("rev-001"))
    with pytest.raises(FileExistsError):
        store.write_compiled("demo", "rev-001", _compiled("rev-001"))

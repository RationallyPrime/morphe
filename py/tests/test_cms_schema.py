from __future__ import annotations

from pathlib import Path

from morphe_cms.schema import artifact_documents


def test_committed_cms_schemas_are_byte_stable() -> None:
    root = Path(__file__).resolve().parents[2]  # repo/worktree root
    for rel_path, content in artifact_documents().items():
        committed = (root / rel_path).read_text(encoding="utf-8")
        msg = f"stale schema artifact: {rel_path} — run `just cms-schema-write`"
        assert committed == content, msg

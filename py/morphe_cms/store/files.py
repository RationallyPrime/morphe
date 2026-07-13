from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from morphe_cms.contracts.artifact import ArtifactEnvelope, CompiledTree, Publication

if TYPE_CHECKING:
    from morphe_cms.contracts.shared import Diagnostic

_TYPE_DIR = "capability-pages"


class FileStore:
    """Flat-file, append-only store. v0 single-writer; writes are atomic (temp + rename)."""

    def __init__(self, root: Path) -> None:
        self._root = Path(root)

    def _content_dir(self, slug: str) -> Path:
        return self._root / "content" / _TYPE_DIR / slug

    def _compiled_dir(self, slug: str) -> Path:
        return self._root / "compiled" / _TYPE_DIR / slug

    def _publications_path(self) -> Path:
        return self._root / "publications.json"

    @staticmethod
    def _atomic_write(path: Path, text: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.parent / (path.name + ".tmp")
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(path)

    @staticmethod
    def _dump(model: ArtifactEnvelope | CompiledTree | Publication) -> str:
        return model.model_dump_json(by_alias=True, exclude_none=True, indent=2) + "\n"

    def _guard(self, path: Path) -> Path:
        resolved = path.resolve()
        root = self._root.resolve()
        if not resolved.is_relative_to(root):
            msg = f"path escapes store root: {path}"
            raise ValueError(msg)
        return resolved

    def next_revision_id(self, slug: str) -> str:
        nums: list[int] = []
        for d in (self._content_dir(slug), self._compiled_dir(slug)):
            if d.exists():
                for p in d.glob("rev-*"):
                    suffix = p.stem.split(".")[0].removeprefix("rev-")
                    if suffix.isdigit():
                        nums.append(int(suffix))
        n = (max(nums) + 1) if nums else 1
        return f"rev-{n:03d}"

    def write_artifact(self, slug: str, revision_id: str, envelope: ArtifactEnvelope) -> None:
        path = self._content_dir(slug) / f"{revision_id}.json"
        if path.exists():
            msg = f"revision already written (immutable): {path}"
            raise FileExistsError(msg)
        self._atomic_write(self._guard(path), self._dump(envelope))

    def read_artifact(self, slug: str, revision_id: str) -> ArtifactEnvelope:
        path = self._guard(self._content_dir(slug) / f"{revision_id}.json")
        return ArtifactEnvelope.model_validate_json(path.read_text(encoding="utf-8"))

    def write_diagnostics(self, slug: str, revision_id: str, diagnostics: list[Diagnostic]) -> None:
        path = self._content_dir(slug) / f"{revision_id}.diagnostics.json"
        if path.exists():
            msg = f"revision already written (immutable): {path}"
            raise FileExistsError(msg)
        payload = json.dumps([d.model_dump() for d in diagnostics], indent=2) + "\n"
        self._atomic_write(self._guard(path), payload)

    def write_compiled(self, slug: str, revision_id: str, compiled: CompiledTree) -> None:
        path = self._compiled_dir(slug) / f"{revision_id}.tree.json"
        if path.exists():
            msg = f"revision already written (immutable): {path}"
            raise FileExistsError(msg)
        self._atomic_write(self._guard(path), self._dump(compiled))

    def read_compiled(self, slug: str, revision_id: str) -> CompiledTree:
        path = self._guard(self._compiled_dir(slug) / f"{revision_id}.tree.json")
        return CompiledTree.model_validate_json(path.read_text(encoding="utf-8"))

    def has_validated_revision(self, slug: str, revision_id: str) -> bool:
        try:
            self.read_compiled(slug, revision_id)
        except (FileNotFoundError, ValueError):
            return False
        return True

    def read_publications(self) -> dict[str, Publication]:
        path = self._publications_path()
        if not path.exists():
            return {}
        raw = json.loads(path.read_text(encoding="utf-8"))
        return {slug: Publication.model_validate(p) for slug, p in raw.items()}

    def publish(self, slug: str, publication: Publication) -> None:
        pubs = self.read_publications()
        pubs[slug] = publication
        payload = json.dumps({s: p.model_dump() for s, p in pubs.items()}, indent=2, sort_keys=True)
        self._atomic_write(self._publications_path(), payload + "\n")

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from morphe_cms.contracts.capability_page import CapabilityPageDraft
from morphe_cms.tools.models import (
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    ValidateContentArtifactInput,
)

if TYPE_CHECKING:
    from pydantic import BaseModel

_SCHEMAS: dict[str, type[BaseModel]] = {
    "schema/cms/capability-page.schema.json": CapabilityPageDraft,
    "schema/cms/create-capability-page.schema.json": CreateCapabilityPageInput,
    "schema/cms/validate-content-artifact.schema.json": ValidateContentArtifactInput,
    "schema/cms/publish-content-artifact.schema.json": PublishContentArtifactInput,
}


def _document(model: type[BaseModel]) -> str:
    schema = model.model_json_schema()
    return json.dumps(schema, ensure_ascii=True, indent=2, sort_keys=True) + "\n"


def artifact_documents() -> dict[str, str]:
    return {path: _document(model) for path, model in _SCHEMAS.items()}


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv

    root = Path(__file__).resolve().parents[2]
    documents = artifact_documents()
    if "--check" in args:
        stale = [p for p, c in documents.items() if (root / p).read_text(encoding="utf-8") != c]
        if stale:
            sys.stderr.write("stale CMS schema artifacts: " + ", ".join(stale) + "\n")
            return 1
        return 0
    if "--write" in args:
        for rel_path, content in documents.items():
            target = root / rel_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        return 0
    sys.stderr.write("usage: python -m morphe_cms.schema [--write|--check]\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

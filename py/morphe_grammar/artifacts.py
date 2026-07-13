from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from pathlib import Path

from .catalog import catalog_typescript_document
from .dialects import DIALECT_IDS, constraints_typescript_document
from .masks import (
    DIALECT_MASK_PATHS,
    PACKAGE_DIALECT_MASK_PATHS,
    PACKAGE_MASK_MANIFEST_PATH,
    ROOT_MASK_MANIFEST_PATH,
    dialect_mask_path,
    dialect_mask_text,
    mask_manifest_document,
    package_dialect_mask_path,
)
from .schema import JsonSchema, schema_document
from .ts_codegen import typescript_document
from .version import version_typescript_document
from .wire import decision_schema_document, delta_schema_document

_BASE_ARTIFACT_PATHS: tuple[str, ...] = (
    "schema/morphe-grammar.schema.json",
    "schema/morphe-delta.schema.json",
    "schema/morphe-decision.schema.json",
    "schema/masks/morphe-node.full.schema.json",
    "schema/masks/morphe-delta.full.schema.json",
    "src/lib/grammar/types.ts",
    "src/lib/grammar/version.ts",
    "src/lib/compounds/catalog.generated.ts",
    "src/lib/dialects/constraints.generated.ts",
)
ARTIFACT_PATHS: tuple[str, ...] = (
    *_BASE_ARTIFACT_PATHS,
    ROOT_MASK_MANIFEST_PATH,
    PACKAGE_MASK_MANIFEST_PATH,
    *DIALECT_MASK_PATHS,
    *PACKAGE_DIALECT_MASK_PATHS,
)


def _json_document(document: JsonSchema) -> str:
    return json.dumps(document, ensure_ascii=True, indent=2, sort_keys=True) + "\n"


def _mask_document(document: JsonSchema, title: str) -> JsonSchema:
    mask = deepcopy(document)
    mask["title"] = title
    return mask


def artifact_documents() -> dict[str, str]:
    node_schema = schema_document()
    delta_schema = delta_schema_document()
    documents = {
        "schema/morphe-grammar.schema.json": _json_document(node_schema),
        "schema/morphe-delta.schema.json": _json_document(delta_schema),
        "schema/morphe-decision.schema.json": _json_document(decision_schema_document()),
        "schema/masks/morphe-node.full.schema.json": _json_document(
            _mask_document(node_schema, "Morphe Node Full Decoder Mask"),
        ),
        "schema/masks/morphe-delta.full.schema.json": _json_document(
            _mask_document(delta_schema, "Morphe Delta Full Decoder Mask"),
        ),
        "src/lib/grammar/types.ts": typescript_document(),
        "src/lib/grammar/version.ts": version_typescript_document(),
        "src/lib/compounds/catalog.generated.ts": catalog_typescript_document(),
        "src/lib/dialects/constraints.generated.ts": constraints_typescript_document(),
    }
    manifest = _json_document(mask_manifest_document())
    documents[ROOT_MASK_MANIFEST_PATH] = manifest
    documents[PACKAGE_MASK_MANIFEST_PATH] = manifest
    for dialect_id in DIALECT_IDS:
        contents = dialect_mask_text(dialect_id)
        documents[dialect_mask_path(dialect_id)] = contents
        documents[package_dialect_mask_path(dialect_id)] = contents
    return documents


def write_artifacts(root: Path = Path()) -> None:
    for relative_path, contents in artifact_documents().items():
        path = root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents, encoding="utf-8")


def changed_artifacts(root: Path = Path()) -> tuple[str, ...]:
    changed: list[str] = []
    for relative_path, contents in artifact_documents().items():
        path = root / relative_path
        if not path.exists() or path.read_text(encoding="utf-8") != contents:
            changed.append(relative_path)
    return tuple(changed)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Generate/check Morphe schema artifacts.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="write generated artifacts")
    mode.add_argument("--check", action="store_true", help="verify committed artifacts")
    args = parser.parse_args(argv)

    if args.write:
        write_artifacts()
        return

    changed = changed_artifacts()
    if changed:
        for relative_path in changed:
            sys.stderr.write(f"stale generated artifact: {relative_path}\n")
        raise SystemExit(1)


if __name__ == "__main__":
    main()

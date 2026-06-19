from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from morphe_grammar.artifacts import artifact_documents
from morphe_grammar.schema import schema_document
from morphe_grammar.ts_codegen import typescript_document
from morphe_grammar.wire import delta_schema_document

SCHEMA_PATH = Path("schema/morphe-grammar.schema.json")
DELTA_SCHEMA_PATH = Path("schema/morphe-delta.schema.json")
TS_TYPES_PATH = Path("src/lib/grammar/types.ts")


def schema_properties(model_name: str) -> set[object]:
    defs = schema_document()["$defs"]
    assert isinstance(defs, dict)
    model_schema = defs[model_name]
    assert isinstance(model_schema, dict)
    properties = model_schema["properties"]
    assert isinstance(properties, dict)
    return set(properties)


def test_schema_document_names_node_root() -> None:
    schema = schema_document()

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["title"] == "Morphe Grammar Node"
    assert "discriminator" in schema


def test_delta_schema_document_names_delta_root() -> None:
    schema = delta_schema_document()
    properties = schema["properties"]
    assert isinstance(properties, dict)

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["title"] == "Morphe Delegation Delta"
    assert {"id", "choice", "epoch"} <= set(properties)


def test_schema_exposes_live_typescript_grammar_affordance_fields() -> None:
    assert {"indent"} <= schema_properties("Stack")
    assert {"columns", "ruled"} <= schema_properties("Grid")
    assert {"numeric", "polarity"} <= schema_properties("Text")
    assert {"id"} <= schema_properties("Button")


def test_committed_schema_artifact_is_byte_stable() -> None:
    expected = json.dumps(schema_document(), ensure_ascii=True, indent=2, sort_keys=True) + "\n"

    assert SCHEMA_PATH.read_text(encoding="utf-8") == expected


def test_committed_delta_schema_artifact_is_byte_stable() -> None:
    expected = (
        json.dumps(delta_schema_document(), ensure_ascii=True, indent=2, sort_keys=True) + "\n"
    )

    assert DELTA_SCHEMA_PATH.read_text(encoding="utf-8") == expected


def test_typescript_grammar_is_generated_from_pydantic_models() -> None:
    assert TS_TYPES_PATH.read_text(encoding="utf-8") == typescript_document()


def test_all_contract_artifacts_are_byte_stable() -> None:
    for relative_path, expected in artifact_documents().items():
        assert Path(relative_path).read_text(encoding="utf-8") == expected


def test_schema_cli_emits_the_same_bytes_as_the_artifact() -> None:
    # Fixed interpreter/module, no user input — the pinned ruff no longer
    # flags S603 here, so no suppression (RUF100 rejects a stale one).
    result = subprocess.run(
        [sys.executable, "-m", "morphe_grammar.schema"],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout == SCHEMA_PATH.read_text(encoding="utf-8")

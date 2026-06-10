from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from morphe_grammar.schema import schema_document

SCHEMA_PATH = Path("schema/morphe-grammar.schema.json")


def test_schema_document_names_node_root() -> None:
    schema = schema_document()

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["title"] == "Morphe Grammar Node"
    assert "discriminator" in schema


def test_committed_schema_artifact_is_byte_stable() -> None:
    expected = json.dumps(schema_document(), ensure_ascii=True, indent=2, sort_keys=True) + "\n"

    assert SCHEMA_PATH.read_text(encoding="utf-8") == expected


def test_schema_cli_emits_the_same_bytes_as_the_artifact() -> None:
    result = subprocess.run(  # noqa: S603 - fixed interpreter/module, no user input.
        [sys.executable, "-m", "morphe_grammar.schema"],
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout == SCHEMA_PATH.read_text(encoding="utf-8")

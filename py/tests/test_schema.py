from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

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


@pytest.mark.parametrize("dimension", ["density", "emphasis", "collapse"])
def test_schema_accepts_every_legacy_targetless_within_dimension(dimension: str) -> None:
    validator = Draft202012Validator(schema_document())
    tree = {
        "kind": "within",
        "id": f"legacy-{dimension}",
        "dimension": dimension,
        "range": [0, 1],
        "default": 0,
    }

    assert validator.is_valid(tree)


@pytest.mark.parametrize(
    ("dimension", "summary"),
    [("density", None), ("emphasis", None), ("collapse", "More detail")],
)
def test_schema_accepts_every_targeted_within_dimension(
    dimension: str,
    summary: str | None,
) -> None:
    validator = Draft202012Validator(schema_document())
    tree: dict[str, object] = {
        "kind": "within",
        "id": f"targeted-{dimension}",
        "dimension": dimension,
        "range": [0, 1],
        "default": 0,
        "target": {"kind": "text", "value": "Adapt me"},
    }
    if summary is not None:
        tree["summary"] = summary

    assert validator.is_valid(tree)


@pytest.mark.parametrize("summary", ["\u0085", "\u200b", "\u2800", "\ufe0f", "\ufeff"])
def test_schema_rejects_invisible_only_collapse_summary(summary: str) -> None:
    validator = Draft202012Validator(schema_document())
    tree = {
        "kind": "within",
        "id": "invisible-collapse",
        "dimension": "collapse",
        "range": [0, 1],
        "default": 1,
        "summary": summary,
        "target": {"kind": "text", "value": "Adapt me"},
    }

    assert not validator.is_valid(tree)


@pytest.mark.parametrize("summary", ["Ítarlegri upplýsingar", "詳細", "©", "😀", "❤️"])
def test_schema_accepts_visible_unicode_collapse_summary(summary: str) -> None:
    validator = Draft202012Validator(schema_document())
    tree = {
        "kind": "within",
        "id": "unicode-collapse",
        "dimension": "collapse",
        "range": [0, 1],
        "default": 1,
        "summary": summary,
        "target": {"kind": "text", "value": "Adapt me"},
    }

    assert validator.is_valid(tree)


@pytest.mark.parametrize(
    "overrides",
    [
        {"target": {"kind": "text", "value": "Adapt me"}},
        {"summary": "", "target": {"kind": "text", "value": "Adapt me"}},
        {"summary": "  \t", "target": {"kind": "text", "value": "Adapt me"}},
        {"summary": None, "target": {"kind": "text", "value": "Adapt me"}},
        {"summary": "More detail"},
        {"summary": "More detail", "target": None},
        {
            "dimension": "density",
            "summary": "Unused",
            "target": {"kind": "text", "value": "Adapt me"},
        },
        {
            "dimension": "emphasis",
            "summary": "Unused",
            "target": {"kind": "text", "value": "Adapt me"},
        },
    ],
)
def test_schema_rejects_inaccessible_or_irrelevant_within_target(
    overrides: dict[str, object],
) -> None:
    validator = Draft202012Validator(schema_document())
    tree = {
        "kind": "within",
        "id": "invalid-within",
        "dimension": "collapse",
        "range": [0, 1],
        "default": 1,
        **overrides,
    }

    assert not validator.is_valid(tree)


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

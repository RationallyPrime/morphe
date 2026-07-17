from __future__ import annotations

from pathlib import Path

from morphe_surface.artifacts import (
    ARTIFACT_PATHS,
    LEGACY_ARTIFACT_PATHS,
    SOURCE_ARTIFACT_PATHS,
    artifact_documents,
    changed_artifacts,
)
from morphe_surface.schema import source_surface_artifact_schema_document
from morphe_surface.source_ts_codegen import source_typescript_document
from morphe_surface.source_vectors import SOURCE_VECTOR_PATHS


def test_source_surface_schema_is_the_strict_serialized_wire() -> None:
    schema = source_surface_artifact_schema_document()
    properties = schema["properties"]
    assert isinstance(properties, dict)

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["title"] == "Morphe Source Surface Artifact V1"
    assert schema["additionalProperties"] is False
    assert "schema" in properties
    assert "schema_" not in properties
    assert {"tree", "grammar_version", "compiler_version", "dialect_id"}.isdisjoint(properties)

    produced_at = properties["produced_at"]
    assert isinstance(produced_at, dict)
    assert produced_at["type"] == "string"

    valid_until = properties["valid_until"]
    assert isinstance(valid_until, dict)
    any_of = valid_until["anyOf"]
    assert isinstance(any_of, list)
    option_types: set[object] = set()
    for option in any_of:
        assert isinstance(option, dict)
        option_types.add(option.get("type"))
    assert option_types == {"string", "null"}


def test_source_types_are_generated_from_wire_names_and_serialized_shapes() -> None:
    document = source_typescript_document()

    assert "export interface SourceSurfaceArtifactV1" in document
    assert 'readonly kind: "morphe.source-surface";' in document
    assert 'readonly wire_version: "1.0";' in document
    assert "readonly produced_at: string;" in document
    assert "readonly valid_until?: string | null;" in document
    assert "readonly schema: JsonObject;" in document
    assert "readonly schema_:" not in document
    assert "readonly diagnostics?: readonly Diagnostic[];" in document
    assert "readonly tree:" not in document


def test_all_surface_artifacts_are_committed_byte_for_byte() -> None:
    assert (
        *LEGACY_ARTIFACT_PATHS,
        *SOURCE_ARTIFACT_PATHS,
        *SOURCE_VECTOR_PATHS,
    ) == ARTIFACT_PATHS
    for relative_path, expected in artifact_documents().items():
        assert Path(relative_path).read_text(encoding="utf-8") == expected
    assert changed_artifacts() == ()

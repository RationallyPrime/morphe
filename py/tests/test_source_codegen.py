from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from morphe_surface.artifacts import (
    ARTIFACT_PATHS,
    LEGACY_ARTIFACT_PATHS,
    SOURCE_ARTIFACT_PATHS,
    artifact_documents,
    changed_artifacts,
)
from morphe_surface.schema import source_surface_artifact_schema_document
from morphe_surface.source import SourceSurfaceArtifactV1, verify_source_surface
from morphe_surface.source_ts_codegen import source_typescript_document
from morphe_surface.source_vectors import (
    SOURCE_CONFORMANCE_MANIFEST_PATH,
    SOURCE_VECTOR_PATHS,
    source_compiler_oracles,
    source_vector_documents,
)

_ED25519_PUBLIC_KEY_BYTES = 32


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


def test_source_conformance_manifest_is_generated_byte_for_byte() -> None:
    generated = source_vector_documents()[SOURCE_CONFORMANCE_MANIFEST_PATH]
    assert Path(SOURCE_CONFORMANCE_MANIFEST_PATH).read_text(encoding="utf-8") == generated


def test_source_conformance_manifest_rebuilds_oracles_and_pins_trust() -> None:
    manifest = cast(
        "dict[str, Any]",
        json.loads(Path(SOURCE_CONFORMANCE_MANIFEST_PATH).read_text(encoding="utf-8")),
    )
    assert manifest["manifest_version"] == "1.0"
    cases = manifest["cases"]
    assert isinstance(cases, list)
    assert [case["id"] for case in cases] == ["taxis-roster", "obolos-evidence", "krates-vendor"]

    for case in cases:
        paths = case["paths"]
        expected = case["expected"]
        hidden = case["hidden"]
        assert case["allowed_differences"] == []

        source_path = Path(paths["source"])
        artifact = SourceSurfaceArtifactV1.model_validate_json(
            source_path.read_text(encoding="utf-8")
        )
        assert artifact.issuer == expected["issuer"]
        assert artifact.surface_id == expected["surface_id"]
        assert artifact.attestation.key_id == expected["key_id"]

        public_key_bytes = bytes.fromhex(expected["public_key_raw_hex"])
        assert len(public_key_bytes) == _ED25519_PUBLIC_KEY_BYTES
        verify_source_surface(
            artifact,
            public_keys={
                (expected["issuer"], expected["key_id"]): Ed25519PublicKey.from_public_bytes(
                    public_key_bytes
                )
            },
            expected_issuer=expected["issuer"],
            expected_surface_id=expected["surface_id"],
        )

        surface_spec, node = source_compiler_oracles(artifact)
        assert surface_spec == json.loads(Path(paths["surface_spec"]).read_text(encoding="utf-8"))
        assert node == json.loads(Path(paths["node"]).read_text(encoding="utf-8"))

        minimized_pair = json.dumps(
            {"schema": artifact.schema_, "data": artifact.data},
            ensure_ascii=True,
            sort_keys=True,
        )
        assert hidden["field"] not in minimized_pair
        assert hidden["sentinel"] not in minimized_pair

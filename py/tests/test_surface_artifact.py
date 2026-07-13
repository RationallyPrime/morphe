from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from morphe_grammar import GRAMMAR_VERSION
from morphe_surface import (
    SURFACE_ARTIFACT_VERSION,
    CompiledSurface,
    canonical_surface_artifact_bytes,
    surface_artifact_digest,
)
from morphe_surface.schema import surface_artifact_schema_document


def _artifact(**overrides: object) -> CompiledSurface:
    document: dict[str, object] = {
        "artifact_version": SURFACE_ARTIFACT_VERSION,
        "tree": {
            "kind": "frame",
            "role": "page",
            "children": [{"kind": "text", "value": "Trusted", "as": "heading"}],
        },
        "grammar_version": GRAMMAR_VERSION,
        "producer_version": "0.2.0",
        "compiler_version": "0.2.0",
        "diagnostics": [],
        "produced_at": "2026-07-13T00:00:00Z",
    }
    document.update(overrides)
    return CompiledSurface.model_validate(document)


def test_surface_artifact_recursively_validates_its_tree() -> None:
    with pytest.raises(ValidationError, match="children"):
        _artifact(
            tree={
                "kind": "frame",
                "role": "page",
                "children": [{"kind": "text", "as": "heading"}],
            }
        )


def test_surface_artifact_requires_its_wire_version() -> None:
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=True)
    del document["artifact_version"]
    with pytest.raises(ValidationError, match="artifact_version"):
        CompiledSurface.model_validate(document)


def test_surface_artifact_rejects_divergent_producer_and_compiler_versions() -> None:
    with pytest.raises(ValidationError, match="producer_version"):
        _artifact(producer_version="0.1.0")


def test_canonical_surface_artifact_bytes_are_stable_and_null_free() -> None:
    first = _artifact()
    reordered = CompiledSurface.model_validate(
        json.loads(
            json.dumps(
                first.model_dump(mode="json", by_alias=True, exclude_none=True), sort_keys=True
            )
        )
    )

    encoded = canonical_surface_artifact_bytes(first)
    assert encoded == canonical_surface_artifact_bytes(reordered)
    assert b" " not in encoded
    assert b'"surface":null' not in encoded


def test_surface_artifact_digest_is_content_addressed() -> None:
    first = _artifact()
    second = _artifact(tree={"kind": "frame", "role": "page", "children": [{"kind": "spacer"}]})

    assert surface_artifact_digest(first).startswith("sha256:")
    assert len(surface_artifact_digest(first)) == len("sha256:") + 64
    assert surface_artifact_digest(first) != surface_artifact_digest(second)


def test_surface_artifact_schema_embeds_the_full_node_contract() -> None:
    schema = surface_artifact_schema_document()
    properties = schema["properties"]
    definitions = schema["$defs"]
    assert isinstance(properties, dict)
    assert isinstance(definitions, dict)
    tree = properties["tree"]
    frame = definitions["Frame"]
    button = definitions["Button"]
    assert isinstance(frame, dict)
    assert isinstance(button, dict)
    any_of = button["anyOf"]
    assert isinstance(any_of, list)

    assert tree == {"$ref": "#/$defs/Node"}
    assert frame["additionalProperties"] is False
    assert {"required": ["label"]} in any_of
    assert {"required": ["a11y"]} in any_of

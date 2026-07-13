from __future__ import annotations

from typing import cast

from morphe_grammar.schema import JsonSchema, normalize_schema

from .artifact import CompiledSurface


def surface_artifact_schema_document() -> JsonSchema:
    """Return the canonical JSON Schema for the trusted surface artifact wire."""
    raw_schema = cast(
        "JsonSchema",
        CompiledSurface.model_json_schema(
            ref_template="#/$defs/{model}",
            union_format="any_of",
        ),
    )
    normalized = cast("JsonSchema", normalize_schema(raw_schema))
    normalized["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    normalized["title"] = "Morphe Compiled Surface Artifact"
    return normalized

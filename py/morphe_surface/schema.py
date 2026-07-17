from __future__ import annotations

from typing import cast

from morphe_grammar.schema import JsonSchema, normalize_schema

from .artifact import CompiledSurface
from .source import SourceSurfaceArtifactV1


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


def source_surface_artifact_schema_document() -> JsonSchema:
    """Return the canonical source-surface ingress schema.

    This contract intentionally uses Pydantic's serialization schema directly. In
    particular, ``valid_until`` is a nullable wire value, so the legacy compiled-
    artifact normalization (which removes null from default-``None`` optionals) must
    not be applied here.
    """
    document = cast(
        "JsonSchema",
        SourceSurfaceArtifactV1.model_json_schema(
            mode="serialization",
            by_alias=True,
            ref_template="#/$defs/{model}",
            union_format="any_of",
        ),
    )
    document["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    document["title"] = "Morphe Source Surface Artifact V1"
    return document

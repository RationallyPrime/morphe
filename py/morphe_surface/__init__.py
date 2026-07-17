"""morphe_surface — read-only Model Surface Compiler (ADR-0014).

Renders an arbitrary JSON Schema (+ optional data instance) into a validated Morphe
`Node` tree via a two-stage pure pipeline `schema -> SurfaceSpec -> Node`, parallel to
the editorial `morphe_cms`. Both emit the same `Node` union and pass the same
`validate_node` gate. The public surface widens task-by-task; see ADR-0014 / KRA-484.
"""

from __future__ import annotations

from .adapters import from_envelope, from_pydantic, surface_from_model
from .artifact import (
    SURFACE_ARTIFACT_VERSION,
    CompiledSurface,
    canonical_surface_artifact_bytes,
    surface_artifact_digest,
)
from .authoring import KpiCell, morphe_hint
from .compile import GRAMMAR_VERSION, compile_surface
from .hints import MorpheHint, NumberFormat, parse_hint
from .source import (
    JSON_SCHEMA_2020_12,
    SOURCE_SIGNATURE_CONTEXT,
    SOURCE_SURFACE_KIND,
    SOURCE_SURFACE_WIRE_VERSION,
    Ed25519Attestation,
    HiddenDiagnosticError,
    JsonObject,
    JsonValue,
    Sha256,
    SourceSeals,
    SourceSurfaceArtifactV1,
    SourceSurfaceError,
    SourceVerificationError,
    ViewModelContract,
    WireModel,
    canonical_json_bytes,
    minimize_source_surface,
    prepare_source_surface,
    source_content_document,
    source_signature_message,
    source_testimony_document,
    verify_source_surface,
)
from .spec import SurfaceNode
from .strategies import Strategy

__all__ = [
    "GRAMMAR_VERSION",
    "JSON_SCHEMA_2020_12",
    "SOURCE_SIGNATURE_CONTEXT",
    "SOURCE_SURFACE_KIND",
    "SOURCE_SURFACE_WIRE_VERSION",
    "SURFACE_ARTIFACT_VERSION",
    "CompiledSurface",
    "Ed25519Attestation",
    "HiddenDiagnosticError",
    "JsonObject",
    "JsonValue",
    "KpiCell",
    "MorpheHint",
    "NumberFormat",
    "Sha256",
    "SourceSeals",
    "SourceSurfaceArtifactV1",
    "SourceSurfaceError",
    "SourceVerificationError",
    "Strategy",
    "SurfaceNode",
    "ViewModelContract",
    "WireModel",
    "canonical_json_bytes",
    "canonical_surface_artifact_bytes",
    "compile_surface",
    "from_envelope",
    "from_pydantic",
    "minimize_source_surface",
    "morphe_hint",
    "parse_hint",
    "prepare_source_surface",
    "source_content_document",
    "source_signature_message",
    "source_testimony_document",
    "surface_artifact_digest",
    "surface_from_model",
    "verify_source_surface",
]

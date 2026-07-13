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
from .compile import GRAMMAR_VERSION, compile_surface
from .hints import MorpheHint, parse_hint
from .spec import SurfaceNode
from .strategies import Strategy

__all__ = [
    "GRAMMAR_VERSION",
    "SURFACE_ARTIFACT_VERSION",
    "CompiledSurface",
    "MorpheHint",
    "Strategy",
    "SurfaceNode",
    "canonical_surface_artifact_bytes",
    "compile_surface",
    "from_envelope",
    "from_pydantic",
    "parse_hint",
    "surface_artifact_digest",
    "surface_from_model",
]

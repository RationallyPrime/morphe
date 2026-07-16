from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_grammar import GRAMMAR_VERSION, validate_node

from .artifact import SURFACE_ARTIFACT_VERSION, CompiledSurface
from .build import build_surface
from .emit import emit_node

if TYPE_CHECKING:
    from morphe_contracts import Diagnostic

    from .spec import SurfaceNode

COMPILER_VERSION = "0.3.1"


def compile_surface(
    schema: dict[str, Any],
    data: object | None = None,
    *,
    diagnostics: dict[str, list[Diagnostic]] | None = None,
    compiled_at: str = "",
) -> CompiledSurface:
    """Compile a JSON Schema (+ data + path-keyed diagnostics) into a CompiledSurface.

    Versioned, deterministic, and gated: the emitted tree passes validate_node (ADR-0014 D10).
    """
    spec = build_surface(schema, data, root=schema, diagnostics=diagnostics)
    tree = emit_node(spec)
    validated_tree = validate_node(tree)  # gate and retain the typed trust-bearing value
    collected: list[Diagnostic] = []
    _collect(spec, collected)
    return CompiledSurface(
        artifact_version=SURFACE_ARTIFACT_VERSION,
        tree=validated_tree,
        grammar_version=GRAMMAR_VERSION,
        producer_version=COMPILER_VERSION,
        compiler_version=COMPILER_VERSION,
        diagnostics=collected,
        produced_at=compiled_at,
    )


def _collect(spec: SurfaceNode, out: list[Diagnostic]) -> None:
    out.extend(spec.diagnostics)
    for child in (*spec.children, *spec.items):
        _collect(child, out)

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_grammar import validate_node

from .artifact import CompiledSurface
from .build import build_surface
from .emit import emit_node

if TYPE_CHECKING:
    from morphe_contracts import Diagnostic

    from .spec import SurfaceNode

# Pinned like the cms gate's GRAMMAR_VERSION/PRESENTER_VERSION; bump on a breaking change.
GRAMMAR_VERSION = "0.1.0"
COMPILER_VERSION = "0.1.0"


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
    validate_node(tree)  # gate: the emitted tree MUST be grammar-valid (raises if not)
    collected: list[Diagnostic] = []
    _collect(spec, collected)
    return CompiledSurface(
        tree=tree,
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

from __future__ import annotations

from morphe_contracts import CompiledArtifact


class CompiledSurface(CompiledArtifact):
    """Operational specialization of the shared CompiledArtifact envelope (ADR-0014 D10).

    The sibling of cms's CompiledTree over the same base; deterministic and byte-stable.
    Inherits tree, grammar_version, producer_version, diagnostics, produced_at.
    """

    compiler_version: str

from __future__ import annotations

from morphe_contracts import ContractModel, Diagnostic, IntentRef

from .strategies import Strategy


class SurfaceNode(ContractModel):
    """Stage-1 typed IR (ADR-0014 D2): resolved render decisions, mechanical to emit."""

    path: str
    label: str
    strategy: Strategy
    value: str | int | float | bool | None = None
    intent: IntentRef | None = None
    href: str | None = None
    collapse: bool | None = None
    # Containers self-head by default; ``x-morphe: {heading: false}`` suppresses it (KRA-677).
    heading: bool = True
    # Record fields — or, on a "table" node, the column heads (label + optional intent).
    children: tuple[SurfaceNode, ...] = ()
    items: tuple[SurfaceNode, ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()


SurfaceNode.model_rebuild()

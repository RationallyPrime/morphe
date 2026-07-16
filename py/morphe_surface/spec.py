from __future__ import annotations

from typing import Literal

from morphe_contracts import ContractModel, Diagnostic, EmphasisClaim, IntentRef

from .hints import NumberFormat
from .strategies import Strategy

type TextAs = Literal["display", "heading", "subheading", "body", "caption"]
type Polarity = Literal["positive", "negative"]


class SurfaceNode(ContractModel):
    """Stage-1 typed IR (ADR-0014 D2): resolved render decisions, mechanical to emit."""

    path: str
    label: str
    strategy: Strategy
    value: str | int | float | bool | None = None
    intent: IntentRef | None = None
    text_as: TextAs | None = None
    emphasis: EmphasisClaim | None = None
    numeric: bool | None = None
    polarity: Polarity | None = None
    href: str | None = None
    collapse: bool | None = None
    # "number" / "kpi-row" presentation (0.3.0): Intl format + ISO currency; ``kicker``
    # is the small register line above a KPI card's title.
    number_format: NumberFormat | None = None
    currency: str | None = None
    kicker: str | None = None
    # Containers self-head by default; ``x-morphe: {heading: false}`` suppresses it (KRA-677).
    heading: bool = True
    # Record fields — or, on a "table" node, the column heads (label + optional intent).
    children: tuple[SurfaceNode, ...] = ()
    items: tuple[SurfaceNode, ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()


SurfaceNode.model_rebuild()

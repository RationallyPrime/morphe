from __future__ import annotations

from typing import Literal

import rfc8785
from pydantic import Field

from morphe_contracts import ContractModel, Diagnostic, EmphasisClaim, IntentRef

from .hints import NumberFormat
from .strategies import Strategy

type TextAs = Literal["display", "heading", "subheading", "body", "caption"]
type Polarity = Literal["positive", "negative"]
type ScalarNumberKind = Literal["integer", "number"]
NON_JCS_SCALAR = "unrenderable: scalarized value is outside the RFC 8785 domain"


def scalar_text(value: object, number_kind: ScalarNumberKind | None = None) -> str:
    """Deterministic Python-compatible scalar spelling for the migration oracle."""
    if value is None:
        rendered = ""
    elif isinstance(value, bool):
        rendered = "True" if value else "False"
    elif isinstance(value, str):
        rendered = value
    elif isinstance(value, int | float) and number_kind == "number":
        rendered = str(float(value))
    elif isinstance(value, int | float) and number_kind == "integer":
        try:
            rendered = rfc8785.dumps(value).decode("utf-8")
        except rfc8785.CanonicalizationError:
            rendered = NON_JCS_SCALAR
    else:
        rendered = str(value)
    return rendered


class SurfaceNode(ContractModel):
    """Stage-1 typed IR (ADR-0014 D2): resolved render decisions, mechanical to emit."""

    path: str
    label: str
    strategy: Strategy
    value: str | int | float | bool | None = None
    # Mirrors the TypeScript IR's non-enumerable symbol. JCS-equivalent numeric
    # tokens use one text spelling without changing the serialized oracle shape.
    scalar_number_kind: ScalarNumberKind | None = Field(default=None, exclude=True)
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

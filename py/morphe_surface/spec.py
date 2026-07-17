from __future__ import annotations

import re
from typing import Literal

import rfc8785
from pydantic import Field

from morphe_contracts import ContractModel, Diagnostic, EmphasisClaim, IntentRef

from .hints import NumberFormat, TemporalFormat
from .strategies import Strategy

type TextAs = Literal["display", "heading", "subheading", "body", "caption"]
type Polarity = Literal["positive", "negative"]
type ScalarNumberKind = Literal["integer", "number"]
NON_JCS_SCALAR = "unrenderable: scalarized value is outside the RFC 8785 domain"
_RFC3339_TIMESTAMP = re.compile(
    r"^(?P<year>[0-9]{4})-(?P<month>[0-9]{2})-(?P<day>[0-9]{2})"
    r"[Tt](?P<hour>[0-9]{2}):(?P<minute>[0-9]{2}):(?P<second>[0-9]{2})"
    r"(?:\.[0-9]+)?(?P<zone>[Zz]|[+-][0-9]{2}:[0-9]{2})$"
)
_MAX_MONTH = 12
_MAX_HOUR = 23
_MAX_MINUTE = 59
_MAX_SECOND = 59


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


def display_scalar_text(
    value: object,
    temporal: TemporalFormat | None,
    number_kind: ScalarNumberKind | None = None,
) -> str:
    """Apply an explicit temporal policy to compiler-generated scalar text.

    The SurfaceNode and signed source keep the exact value. Only emitted scalar text uses
    this locale-free presentation floor, so Python and TypeScript produce identical trees.
    """
    rendered = scalar_text(value, number_kind)
    if temporal != "date-time-minute" or not isinstance(value, str):
        return rendered
    match = _RFC3339_TIMESTAMP.fullmatch(value)
    if match is None:
        return rendered

    year = int(match["year"])
    month = int(match["month"])
    day = int(match["day"])
    hour = int(match["hour"])
    minute = int(match["minute"])
    second = int(match["second"])
    zone = match["zone"]
    if not _valid_timestamp_parts((year, month, day, hour, minute, second), zone):
        return rendered

    zone_text = "UTC" if zone.casefold() == "z" or zone == "+00:00" else zone
    date_text = f"{match['year']}-{match['month']}-{match['day']}"
    minute_text = f"{match['hour']}:{match['minute']}"
    return f"{date_text} {minute_text} {zone_text}"


def _valid_timestamp_parts(
    parts: tuple[int, int, int, int, int, int],
    zone: str,
) -> bool:
    year, month, day, hour, minute, second = parts
    if not 1 <= month <= _MAX_MONTH or not 0 <= hour <= _MAX_HOUR:
        return False
    if not 0 <= minute <= _MAX_MINUTE or not 0 <= second <= _MAX_SECOND:
        return False
    days = (31, 29 if _leap_year(year) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    if not 1 <= day <= days[month - 1]:
        return False
    if zone.casefold() == "z":
        return True
    return 0 <= int(zone[1:3]) <= _MAX_HOUR and 0 <= int(zone[4:6]) <= _MAX_MINUTE


def _leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


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
    temporal: TemporalFormat | None = None
    currency: str | None = None
    kicker: str | None = None
    # Containers self-head by default; ``x-morphe: {heading: false}`` suppresses it (KRA-677).
    heading: bool = True
    # Record fields — or, on a "table" node, the column heads (label + optional intent).
    children: tuple[SurfaceNode, ...] = ()
    items: tuple[SurfaceNode, ...] = ()
    diagnostics: tuple[Diagnostic, ...] = ()


SurfaceNode.model_rebuild()

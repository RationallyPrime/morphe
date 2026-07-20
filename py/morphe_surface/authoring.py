"""Authoring-side helpers for surface producers (kernels, services).

The asymmetry is deliberate: ``parse_hint`` (consumption) is total and degrades a
malformed block to the hint-free floor, while ``morphe_hint`` (production) is STRICT —
a typo'd strategy or intent raises at import time in the producer's test suite instead
of silently rendering the floor in a customer deployment.
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import ConfigDict, model_validator

from morphe_contracts import ContractModel, IntentRef

from .hints import MorpheHint, NumberFormat, TemporalFormat

_WELL_FORMED_CURRENCY = re.compile(r"^[A-Za-z]{3}$")


def morphe_hint(**hint: Any) -> dict[str, Any]:  # noqa: ANN401 - kwargs mirror MorpheHint's fields
    """Build a validated ``json_schema_extra`` block: ``Field(json_schema_extra=morphe_hint(...))``.

    Raises on any key or value ``MorpheHint`` does not know — authoring-time strictness.
    """
    validated = MorpheHint.model_validate(hint)
    _require_well_formed_currency(validated.currency)
    supplied = validated.model_dump(mode="json", exclude_none=True, exclude_defaults=True)
    return {"x-morphe": supplied}


def _require_well_formed_currency(currency: str | None) -> None:
    # The renderer's Intl call RAISES on a non-ISO-4217-shaped code; the compiler
    # degrades such a pair to a plain number at build time (D8). Authoring-side we
    # refuse it outright — a producer typo should fail its test suite, not ship a
    # silently-unformatted column.
    if currency is not None and _WELL_FORMED_CURRENCY.fullmatch(currency) is None:
        msg = f"currency must be a 3-letter ISO-4217 code, got {currency!r}"
        raise ValueError(msg)


class KpiCell(ContractModel):
    """One card in a ``strategy="kpi-row"`` collection — the typed row contract.

    Embed ``list[KpiCell]`` (or any model with these field names) in a surface view
    model; the compiler lowers each cell to a promoted ``SignalCard``. ``value`` may be
    textual — a non-numeric measure renders as text instead of a formatted number.
    ``temporal="date-time-minute"`` opts a textual timestamp into the deterministic
    minute-precision display floor without changing its source value.
    """

    model_config = ConfigDict(frozen=True)

    label: str
    value: str | int | float
    kicker: str | None = None
    format: NumberFormat | None = None
    temporal: TemporalFormat | None = None
    currency: str | None = None
    intent: IntentRef | None = None
    # The corner signal (KRA-757 §3.2): short state text (e.g. "Breached") the
    # card renders as a Status chip in its corner slot; `signal_intent` clamps to
    # the status tone subset at emit — a KPI card never certifies state it was
    # not told. Omitted -> the corner stays empty.
    signal: str | None = None
    signal_intent: IntentRef | None = None

    @model_validator(mode="after")
    def well_formed_currency(self) -> KpiCell:
        _require_well_formed_currency(self.currency)
        return self

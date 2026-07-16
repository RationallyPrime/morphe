"""Authoring-side helpers for surface producers (kernels, services).

The asymmetry is deliberate: ``parse_hint`` (consumption) is total and degrades a
malformed block to the hint-free floor, while ``morphe_hint`` (production) is STRICT —
a typo'd strategy or intent raises at import time in the producer's test suite instead
of silently rendering the floor in a customer deployment.
"""

from __future__ import annotations

from typing import Any

from pydantic import ConfigDict

from morphe_contracts import ContractModel, IntentRef

from .hints import MorpheHint, NumberFormat


def morphe_hint(**hint: Any) -> dict[str, Any]:  # noqa: ANN401 - kwargs mirror MorpheHint's fields
    """Build a validated ``json_schema_extra`` block: ``Field(json_schema_extra=morphe_hint(...))``.

    Raises on any key or value ``MorpheHint`` does not know — authoring-time strictness.
    """
    validated = MorpheHint.model_validate(hint)
    supplied = validated.model_dump(mode="json", exclude_none=True, exclude_defaults=True)
    return {"x-morphe": supplied}


class KpiCell(ContractModel):
    """One card in a ``strategy="kpi-row"`` collection — the typed row contract.

    Embed ``list[KpiCell]`` (or any model with these field names) in a surface view
    model; the compiler lowers each cell to a promoted ``SignalCard``. ``value`` may be
    textual — a non-numeric measure renders as text instead of a formatted number.
    """

    model_config = ConfigDict(frozen=True)

    label: str
    value: str | int | float
    kicker: str | None = None
    format: NumberFormat | None = None
    currency: str | None = None
    intent: IntentRef | None = None

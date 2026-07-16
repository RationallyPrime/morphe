from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, ValidationError

from morphe_contracts import ContractModel, EmphasisClaim, IntentRef

from .strategies import Strategy

type NumberFormat = Literal["plain", "integer", "currency", "percent", "compact"]


class MorpheHint(ContractModel):
    """Parsed ``x-morphe`` co-authoring block (ADR-0014 D1'): hints select; structure is floor."""

    # Hints cross pinned repo revs, so the vocabulary is forward-open: a producer annotated
    # for a newer (or older) compiler must degrade to the hint-free floor, never crash (D8).
    model_config = ConfigDict(extra="ignore")

    strategy: Strategy | None = None
    label: str | None = None
    role: IntentRef | None = None
    collapse: bool | None = None
    hidden: bool = False
    heading: bool = True
    # 0.3.0 vocabulary. ``format``/``currency`` shape a ``number`` leaf (percent takes a
    # 0..1 fraction — Intl multiplies). ``intents`` maps data VALUES to intents so one
    # enum column can carry per-state color (badge: intent as-is; status: clamped to its
    # tone subset). ``emphasis`` is a claim on scalar/number leaves — the renderer's
    # budget renormalizes it, so an over-claiming producer degrades, never shouts.
    format: NumberFormat | None = None
    currency: str | None = None
    intents: dict[str, IntentRef] | None = None
    emphasis: EmphasisClaim | None = None


def parse_hint(schema: dict[str, object]) -> MorpheHint:
    raw = schema.get("x-morphe")
    if not isinstance(raw, dict):
        raw = {}
    try:
        return MorpheHint.model_validate(raw)
    except ValidationError:
        # Totality (D8): a malformed hint block selects nothing.
        return MorpheHint()

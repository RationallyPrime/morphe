from __future__ import annotations

from typing import Literal, cast

from pydantic import ConfigDict, Field, ValidationError

from morphe_contracts import ContractModel, EmphasisClaim, IntentRef
from morphe_grammar.labels import VISIBLE_LABEL_PATTERN

from .strategies import Strategy

type NumberFormat = Literal["plain", "integer", "currency", "percent", "compact"]
type TemporalFormat = Literal["date-time-minute"]
HINT_VOCABULARY_VERSION = "0.6.0"


class MorpheHint(ContractModel):
    """Parsed ``x-morphe`` co-authoring block (ADR-0014 D1'): hints select; structure is floor."""

    # Hints cross pinned repo revs, so the vocabulary is forward-open: a producer annotated
    # for a newer (or older) compiler must degrade to the hint-free floor, never crash (D8).
    model_config = ConfigDict(extra="ignore", strict=True)

    strategy: Strategy | None = None
    label: str | None = None
    role: IntentRef | None = None
    collapse: bool | None = None
    hidden: bool = False
    heading: bool = True
    # 0.3.0 additions. ``format``/``currency`` shape a ``number`` leaf (percent takes a
    # 0..1 fraction — Intl multiplies). ``intents`` maps data VALUES to intents so one
    # enum column can carry per-state color (badge: intent as-is; status: clamped to its
    # tone subset). ``emphasis`` is a claim on scalar/number leaves — the renderer's
    # budget renormalizes it, so an over-claiming producer degrades, never shouts.
    format: NumberFormat | None = None
    # 0.4.0 addition. Explicit timestamp display policy is deliberately separate from the
    # numeric ``format`` vocabulary and never inferred from a field name/value.
    temporal: TemporalFormat | None = None
    currency: str | None = None
    intents: dict[str, IntentRef] | None = None
    emphasis: EmphasisClaim | None = None
    # Plain producer text compiled directly into a label-bearing grammar leaf.
    # There is deliberately no glossary id or viewer-side lookup seam.
    gloss: str | None = Field(default=None, min_length=1, pattern=VISIBLE_LABEL_PATTERN)
    # JSON object member order is not part of RFC 8785's authenticated value.
    # Source-v1 authoring therefore stamps the producer's visible property order
    # into this signed array.  Legacy schemas omit it and retain their in-memory
    # insertion order during the bounded migration window.
    order: tuple[str, ...] | None = None


def parse_hint(schema: dict[str, object]) -> MorpheHint:
    raw = schema.get("x-morphe")
    if not isinstance(raw, dict):
        hint: dict[str, object] = {}
    else:
        hint = cast("dict[str, object]", raw)
    order = hint.get("order")
    if "order" in hint and not (
        isinstance(order, (list, tuple)) and all(isinstance(entry, str) for entry in order)
    ):
        # A present-but-malformed signed order selects the deterministic sorted
        # floor (empty prefix + known-key remainder), without discarding valid
        # sibling hints. Missing order remains None for the bounded legacy path.
        hint = {**hint, "order": ()}
    elif isinstance(order, (list, tuple)):
        # Strict validation still accepts the JSON array at the wire boundary.
        hint = {**hint, "order": tuple(order)}
    try:
        return MorpheHint.model_validate(hint)
    except ValidationError:
        # Totality (D8): malformed presentation selects nothing, but signed
        # property order remains authenticated compiler input.
        signed_order = hint.get("order")
        return MorpheHint(
            order=cast("tuple[str, ...]", signed_order) if isinstance(signed_order, tuple) else None
        )

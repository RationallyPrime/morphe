from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .refs import schema_type

if TYPE_CHECKING:
    from .hints import MorpheHint
    from .strategies import Strategy

_SCALAR_TYPES = {"string", "integer", "number", "boolean"}


def resolve_strategy(schema: dict[str, Any], hint: MorpheHint) -> Strategy:
    """Single chokepoint (ADR-0014 D3): (schema shape, hint) -> closed Strategy.

    Hints win over structural inference; structure is the hint-free floor. An
    unrecognized construct degrades to ``diagnostic-node`` (totality, D8) — never raises.
    """
    if hint.strategy is not None:
        return hint.strategy
    if "enum" in schema:
        return "badge"
    t = schema_type(schema)
    if t == "object":
        return "record-card"
    if t == "array":
        items = schema.get("items")
        item_t = schema_type(items) if isinstance(items, dict) else None
        return "table" if item_t == "object" else "card-stack"
    if t in _SCALAR_TYPES:
        return "scalar"
    return "diagnostic-node"

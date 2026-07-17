from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from .refs import resolve_ref, schema_type, unwrap_nullable

if TYPE_CHECKING:
    from .hints import MorpheHint
    from .strategies import Strategy

_SCALAR_TYPES = {"string", "integer", "number", "boolean"}


def resolve_strategy(
    schema: dict[str, Any], hint: MorpheHint, *, root: dict[str, Any] | None = None
) -> Strategy:
    """Single chokepoint (ADR-0014 D3): (schema shape, hint) -> closed Strategy.

    Hints win over structural inference; structure is the hint-free floor. An
    unrecognized construct degrades to ``diagnostic-node`` (totality, D8) — never raises.
    ``root`` lets array items behind a local ``$ref`` participate in inference.
    """
    if hint.strategy is not None:
        return hint.strategy
    schema = unwrap_nullable(schema, root or {})
    if "enum" in schema:
        return "badge"
    t = schema_type(schema)
    if t == "object":
        return "record-card"
    if t == "array":
        items = _resolved(schema.get("items"), root)
        # Only a FLAT record row lowers to a grid (KRA-640); nested or shapeless rows
        # keep the per-row disclosure path.
        return "table" if items is not None and _flat_record(items, root) else "card-stack"
    if t in _SCALAR_TYPES:
        return "scalar"
    return "diagnostic-node"


def _flat_record(items: dict[str, Any], root: dict[str, Any] | None) -> bool:
    if schema_type(items) != "object":
        return False
    props = items.get("properties")
    if not isinstance(props, dict) or not props:
        return False
    return all(
        (sub := _resolved(raw, root)) is not None and schema_type(sub) not in {"object", "array"}
        for raw in props.values()
    )


def _resolved(schema: object, root: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(schema, dict):
        return None
    return resolve_ref(cast("dict[str, Any]", schema), root or {})

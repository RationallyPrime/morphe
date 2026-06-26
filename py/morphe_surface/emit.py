from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from morphe_contracts import Diagnostic

    from .spec import SurfaceNode

Node = dict[str, Any]

_LEAF = {"scalar", "badge", "linked-ref", "diagnostic-node"}
_CONTAINER = {"record-card", "collapsed-section", "table", "card-stack"}


def emit_node(spec: SurfaceNode) -> Node:
    """Stage 2 (ADR-0014 D2): mechanically render a SurfaceNode into a grammar Node dict.

    Read-only only (D4): never emits Field/Select/Toggle/Range/Button. Every output is a
    `validate_node`-valid tree; `Within(collapse)` is emitted as an adaptation socket (D5).
    """
    if spec.strategy in _LEAF:
        return _leaf(spec)
    if spec.strategy == "collapsed-section":
        return _collapsible(spec)
    if spec.strategy in {"table", "card-stack"}:
        return _section(spec, [_field(item) for item in spec.items])
    return _frame(spec)  # record-card


def _leaf(spec: SurfaceNode) -> Node:
    if spec.strategy == "scalar":
        return {"kind": "text", "value": _str(spec.value), "as": "body"}
    if spec.strategy == "badge":
        return {"kind": "badge", "label": _str(spec.value), "intent": spec.intent or "neutral"}
    if spec.strategy == "linked-ref":
        return {"kind": "link", "href": spec.href or "#", "label": spec.label}
    # diagnostic-node — an unrenderable region renders AS its diagnostic (totality, D8).
    return {
        "kind": "inline-alert",
        "tone": "caution",
        "title": spec.label,
        "detail": _str(spec.value),
    }


def _frame(spec: SurfaceNode) -> Node:
    body = _section(spec, [_field(child) for child in spec.children])
    return {"kind": "frame", "role": "page", "surface": "base", "children": [body]}


def _collapsible(spec: SurfaceNode) -> Node:
    # The Within socket carries no children (it is a context-free adaptation marker); the
    # section content rides beside it so the region still renders at the socket's default.
    socket = {
        "kind": "within",
        "id": spec.path,
        "dimension": "collapse",
        "range": [0, 1],
        "default": 1 if spec.collapse else 0,
    }
    inner = _section(spec, [_field(child) for child in spec.children])
    return {"kind": "stack", "role": "section", "children": [socket, inner]}


def _section(spec: SurfaceNode, children: list[Node]) -> Node:
    head = {"kind": "text", "value": spec.label, "as": "heading"}
    alerts = [_alert(d) for d in spec.diagnostics]
    return {"kind": "stack", "role": "section", "children": [head, *alerts, *children]}


def _field(spec: SurfaceNode) -> Node:
    inner = emit_node(spec)
    if spec.strategy in _CONTAINER:
        return inner  # containers self-head and render their own diagnostics
    # A diagnostic-node already renders its issue; other leaves carry a caption + any alerts.
    alerts = [] if spec.strategy == "diagnostic-node" else [_alert(d) for d in spec.diagnostics]
    return {
        "kind": "stack",
        "role": "field-group",
        "children": [_caption(spec.label), inner, *alerts],
    }


def _caption(label: str) -> Node:
    return {"kind": "text", "value": label, "as": "caption", "intent": "neutral"}


def _alert(diag: Diagnostic) -> Node:
    return {
        "kind": "inline-alert",
        "tone": _tone(diag.severity),
        "title": diag.code,
        "detail": diag.message,
    }


def _tone(severity: str) -> str:
    return {"error": "caution", "warning": "caution", "info": "info"}.get(severity, "info")


def _str(value: object) -> str:
    return "" if value is None else str(value)

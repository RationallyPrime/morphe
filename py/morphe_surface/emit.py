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
    if spec.strategy == "table":
        return _table(spec)
    if spec.strategy == "card-stack":
        return _section(spec, [_field(item) for item in spec.items] or [_empty_collection(spec)])
    return _frame(spec)  # record-card


def _leaf(spec: SurfaceNode) -> Node:
    if spec.strategy == "scalar":
        node: Node = {"kind": "text", "value": _str(spec.value), "as": spec.text_as or "body"}
        if spec.emphasis is not None:
            node["emphasis"] = spec.emphasis
        if spec.intent is not None:
            node["intent"] = spec.intent
        if spec.numeric:
            node["numeric"] = True
        if spec.polarity is not None:
            node["polarity"] = spec.polarity
        return node
    if spec.strategy == "badge":
        return {"kind": "badge", "label": _str(spec.value), "intent": spec.intent or "neutral"}
    if spec.strategy == "linked-ref":
        if not spec.href:
            # An absent/empty relation is not a link — render an empty region, never a
            # dead ``href="#"`` (KRA-677 R3). Backstop degrades keep their caption via _field.
            return {"kind": "text", "value": "", "as": "body"}
        return {"kind": "link", "href": spec.href, "label": spec.label}
    # diagnostic-node — an unrenderable region renders AS its diagnostic (totality, D8).
    return {
        "kind": "inline-alert",
        "tone": "caution",
        "title": spec.label,
        "detail": _str(spec.value),
    }


def _frame(spec: SurfaceNode) -> Node:
    body = _section(spec, _fields(spec.children))
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
    inner = _section(spec, _fields(spec.children))
    return {"kind": "stack", "role": "section", "children": [socket, inner]}


def _table(spec: SurfaceNode) -> Node:
    if not spec.items:
        return _section(spec, [_empty_collection(spec)])
    columns = spec.children or _columns_from_rows(spec.items)
    body = [_table_row(item, len(columns)) for item in spec.items]
    rows = [_table_header(columns), *body] if columns else body
    grid: Node = {"kind": "grid", "role": "list", "children": rows}
    if columns:
        grid["columns"] = ["flexible" for _ in columns]
        grid["ruled"] = True
    return _section(spec, [grid])


def _columns_from_rows(rows: tuple[SurfaceNode, ...]) -> tuple[SurfaceNode, ...]:
    return rows[0].children if rows else ()


def _table_header(columns: tuple[SurfaceNode, ...]) -> Node:
    return {"kind": "grid", "role": "inline", "children": [_header_cell(c) for c in columns]}


def _header_cell(column: SurfaceNode) -> Node:
    cell = _caption(column.label)
    if column.intent is not None:
        cell["intent"] = column.intent
    return cell


def _table_row(row: SurfaceNode, column_count: int) -> Node:
    # A row without fields (D9 linked-ref backstop, scalar items under a table hint)
    # renders itself as the leading cell instead of vanishing into blank padding.
    cells = [_table_cell(cell) for cell in row.children] if row.children else [_table_cell(row)]
    cells.extend(_empty_cell() for _ in range(column_count - len(cells)))
    grid: Node = {"kind": "grid", "role": "inline", "children": cells}
    # Row-level diagnostics stay visible (D8); a diagnostic-node row already IS its alert.
    alerts = [] if row.strategy == "diagnostic-node" else [_alert(d) for d in row.diagnostics]
    if not alerts:
        return grid
    return {"kind": "stack", "role": "section", "children": [grid, *alerts]}


def _table_cell(spec: SurfaceNode) -> Node:
    if spec.strategy in _CONTAINER:
        return emit_node(spec)
    inner = _leaf(spec)
    # Cell-level diagnostics stay visible (D8); a diagnostic-node cell already IS its alert.
    alerts = [] if spec.strategy == "diagnostic-node" else [_alert(d) for d in spec.diagnostics]
    if not alerts:
        return inner
    return {"kind": "stack", "role": "field-group", "children": [inner, *alerts]}


def _empty_cell() -> Node:
    return {"kind": "text", "value": "", "as": "body"}


def _section(spec: SurfaceNode, children: list[Node]) -> Node:
    head: list[Node] = [_heading(spec.label, spec.emphasis)] if spec.heading else []
    alerts = [_alert(d) for d in spec.diagnostics]
    return {"kind": "stack", "role": "section", "children": [*head, *alerts, *children]}


def _heading(label: str, emphasis: str | None) -> Node:
    node: Node = {"kind": "text", "value": label, "as": "heading"}
    if emphasis is not None:
        node["emphasis"] = emphasis
    return node


def _fields(specs: tuple[SurfaceNode, ...]) -> list[Node]:
    nodes: list[Node] = []
    pending: list[SurfaceNode] = []
    for spec in specs:
        if _definition_candidate(spec):
            pending.append(spec)
            continue
        _flush_definitions(nodes, pending)
        nodes.append(_field(spec))
    _flush_definitions(nodes, pending)
    return nodes


def _flush_definitions(nodes: list[Node], pending: list[SurfaceNode]) -> None:
    if pending:
        nodes.append(_definition_grid(pending))
        pending.clear()


def _definition_candidate(spec: SurfaceNode) -> bool:
    return spec.strategy in _LEAF and spec.strategy != "diagnostic-node" and spec.text_as is None


def _definition_grid(specs: list[SurfaceNode]) -> Node:
    children: list[Node] = []
    for spec in specs:
        children.extend((_caption(spec.label), _definition_value(spec)))
    return {
        "kind": "grid",
        "role": "field-group",
        "columns": ["content", "flexible"],
        "children": children,
    }


def _definition_value(spec: SurfaceNode) -> Node:
    inner = _leaf(spec)
    alerts = [] if spec.strategy == "diagnostic-node" else [_alert(d) for d in spec.diagnostics]
    if not alerts:
        return inner
    return {"kind": "stack", "role": "field-group", "children": [inner, *alerts]}


def _field(spec: SurfaceNode) -> Node:
    inner = emit_node(spec)
    if spec.strategy in _CONTAINER:
        return inner  # containers self-head and render their own diagnostics
    # A diagnostic-node already renders its issue; other leaves carry a caption + any alerts.
    alerts = [] if spec.strategy == "diagnostic-node" else [_alert(d) for d in spec.diagnostics]
    if spec.text_as is not None:
        if not alerts:
            return inner
        return {"kind": "stack", "role": "field-group", "children": [inner, *alerts]}
    return {
        "kind": "stack",
        "role": "field-group",
        "children": [_caption(spec.label), inner, *alerts],
    }


def _empty_collection(spec: SurfaceNode) -> Node:
    label = spec.label.strip().lower()
    return {
        "kind": "text",
        "value": f"No {label or 'items'}.",
        "as": "caption",
        "intent": "neutral",
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

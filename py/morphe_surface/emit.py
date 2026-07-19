from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_grammar import normalize_visible_label_text

from .spec import display_scalar_text, scalar_text

if TYPE_CHECKING:
    from collections.abc import Callable

    from morphe_contracts import Diagnostic

    from .spec import SurfaceNode

Node = dict[str, Any]

_LEAF = {"scalar", "badge", "linked-ref", "diagnostic-node", "number", "status", "progress"}
_CONTAINER = {
    "record-card",
    "collapsed-section",
    "table",
    "card-stack",
    "kpi-row",
    "entity-header",
}
_STATUS_TONES = {"success", "caution", "info", "neutral"}


def emit_node(spec: SurfaceNode) -> Node:
    """Stage 2 (ADR-0014 D2): mechanically render a SurfaceNode into a grammar Node dict.

    Read-only only (D4): never emits Field/Select/Toggle/Range/Button. Every output is a
    `validate_node`-valid tree; `Within(collapse)` owns the region it adapts (D5).
    """
    if spec.strategy in _LEAF:
        return _leaf(spec)
    # A container dispatch TABLE, mirroring _LEAF_EMITTERS: the strategy vocabulary is
    # closed, so container emitters are enumerable data. record-card is the default.
    emitter = _CONTAINER_EMITTERS.get(spec.strategy)
    return emitter(spec) if emitter is not None else _frame(spec)


def _card_stack(spec: SurfaceNode) -> Node:
    return _section(spec, [_field(item) for item in spec.items] or [_empty_collection(spec)])


def _leaf(spec: SurfaceNode) -> Node:
    # A lowering TABLE, not a branch ladder: the strategy vocabulary is closed, so the
    # leaf emitters are enumerable data. Unknown strategies fall to the diagnostic
    # emitter (totality, D8).
    return _LEAF_EMITTERS.get(spec.strategy, _diagnostic)(spec)


def _scalar(spec: SurfaceNode) -> Node:
    node: Node = {
        "kind": "text",
        "value": display_scalar_text(spec.value, spec.temporal, spec.scalar_number_kind),
        "as": spec.text_as or "body",
    }
    if spec.emphasis is not None:
        node["emphasis"] = spec.emphasis
    if spec.intent is not None:
        node["intent"] = spec.intent
    if spec.numeric:
        node["numeric"] = True
    if spec.polarity is not None:
        node["polarity"] = spec.polarity
    return node


def _badge(spec: SurfaceNode) -> Node:
    return {
        "kind": "badge",
        "label": scalar_text(spec.value, spec.scalar_number_kind),
        "intent": spec.intent or "neutral",
    }


def _link(spec: SurfaceNode) -> Node:
    if not spec.href:
        # An absent/empty relation is not a link — never a dead ``href="#"``
        # (KRA-677 R3). It renders the producer's OWN display label when one was
        # carried in the data (``SurfaceRef(label="—")`` paints its em-dash);
        # backstop degrades (no data label) keep rendering an empty region.
        return {"kind": "text", "value": _str(spec.value), "as": "body"}
    node: Node = {"kind": "link", "href": spec.href, "label": spec.label}
    if spec.intent is not None:
        # The one drill-in per pane keeps its declared register — a
        # ``primary-action`` linked-ref must not demote to a body link.
        node["intent"] = spec.intent
    return node


def _status(spec: SurfaceNode) -> Node:
    text = normalize_visible_label_text(_str(spec.value), fallback="—")
    return {"kind": "status", "tone": _status_tone(spec.intent), "signal": {"text": text}}


def _progress(spec: SurfaceNode) -> Node:
    node: Node = {
        "kind": "progress",
        "label": normalize_visible_label_text(spec.label, fallback="Progress"),
    }
    if spec.value is not None:
        node["value"] = spec.value
    if spec.intent is not None:
        node["intent"] = spec.intent
    return node


def _diagnostic(spec: SurfaceNode) -> Node:
    # diagnostic-node — an unrenderable region renders AS its diagnostic (totality, D8).
    return {
        "kind": "inline-alert",
        "tone": "caution",
        "title": spec.label,
        "detail": _str(spec.value),
    }


def _number(spec: SurfaceNode) -> Node:
    node: Node = {"kind": "number", "value": spec.value}
    if spec.number_format is not None:
        node["format"] = spec.number_format
    if spec.currency is not None:
        node["currency"] = spec.currency
    if spec.intent is not None:
        node["intent"] = spec.intent
    if spec.emphasis is not None:
        node["emphasis"] = spec.emphasis
    return node


def _status_tone(intent: str | None) -> str:
    # Status tones are the subset of intents a chip can carry; any richer intent
    # (provenance, seal, primary-action, …) clamps to neutral rather than lying.
    return intent if intent in _STATUS_TONES else "neutral"


_LEAF_EMITTERS: dict[str, Callable[[SurfaceNode], Node]] = {
    "scalar": _scalar,
    "badge": _badge,
    "linked-ref": _link,
    "number": _number,
    "status": _status,
    "progress": _progress,
    "diagnostic-node": _diagnostic,
}


def _kpi_row(spec: SurfaceNode) -> Node:
    if not spec.items:
        return _section(spec, [_empty_collection(spec)])
    cards = [_signal_card(item) for item in spec.items]
    # No ``columns`` means the auto-fit card grid; narrow tracks pack the KPI band.
    grid: Node = {"kind": "grid", "role": "list", "minTrack": "narrow", "children": cards}
    return _section(spec, [grid])


def _signal_card(item: SurfaceNode) -> Node:
    if item.strategy == "diagnostic-node":
        return _leaf(item)
    kicker: Node = {
        "kind": "text",
        "value": item.kicker or "",
        "as": "caption",
        "intent": "folio",
    }
    title: Node = {"kind": "text", "value": item.label, "as": "subheading"}
    if item.strategy == "number":
        measure: Node = _number(item)
        measure["emphasis"] = "strong"
    else:
        measure = {
            "kind": "text",
            "value": display_scalar_text(item.value, item.temporal, item.scalar_number_kind),
            "as": "body",
            "emphasis": "strong",
        }
        if item.intent is not None:
            measure["intent"] = item.intent
    body = [_alert(diagnostic) for diagnostic in item.diagnostics]
    return {
        "kind": "compound",
        "name": "SignalCard",
        "args": {"kicker": kicker, "title": title, "measure": measure},
        # An explicit body fill beats the template's "No body supplied." fallback
        # while keeping signed KPI diagnostics visible.
        "slots": {"body": body},
    }


def _is_title_candidate(child: SurfaceNode) -> bool:
    # The title is the first heading-register text OR the record's primary string
    # value. Built children never carry a heading/display register (entity-header
    # runs no identity promotion), so in practice this selects the first string
    # scalar; the register clause stays for a caller who authored one explicitly.
    if child.strategy != "scalar":
        return False
    return child.text_as in {"display", "heading"} or isinstance(child.value, str)


def _slot_leaf(spec: SurfaceNode) -> Node:
    # A slot fill mirrors _definition_value: the lowered leaf, plus any signed
    # diagnostics as sibling alerts so nothing a child carried is dropped (D8).
    inner = _leaf(spec)
    alerts = [] if spec.strategy == "diagnostic-node" else [_alert(d) for d in spec.diagnostics]
    if not alerts:
        return inner
    return {"kind": "stack", "role": "field-group", "children": [inner, *alerts]}


def _entity_header(spec: SurfaceNode) -> Node:
    # One deterministic classification pass over the hinted object's children, in
    # document order. Precedence (identical in both compilers): an explicit
    # `role: provenance` child wins outright; then the first number is the key
    # figure; then status/badge feed the signal slot; then the first title
    # candidate; everything else is a meta fact.
    kicker: Node = {"kind": "text", "value": spec.label, "as": "caption", "intent": "folio"}
    provenance: list[Node] = []
    signal: list[Node] = []
    meta_children: list[SurfaceNode] = []
    key_figure: SurfaceNode | None = None
    title_child: SurfaceNode | None = None
    for child in spec.children:
        if child.intent == "provenance":
            provenance.append(_slot_leaf(child))
        elif child.strategy == "number" and key_figure is None:
            key_figure = child
        elif child.strategy in {"status", "badge"}:
            signal.append(_slot_leaf(child))
        elif title_child is None and _is_title_candidate(child):
            title_child = child
        else:
            meta_children.append(child)
    if title_child is not None:
        title_value = display_scalar_text(
            title_child.value, title_child.temporal, title_child.scalar_number_kind
        )
    else:
        title_value = spec.label
    title: Node = {"kind": "text", "value": title_value, "as": "heading"}
    args: Node = {"kicker": kicker, "title": title}
    if key_figure is not None:
        measure = _number(key_figure)
        measure["emphasis"] = "strong"
        args["keyFigure"] = measure
    # Diagnostics on the node itself and on the two children promoted to BARE args
    # (title, keyFigure) would otherwise lose their alert path. Surface them all at
    # the head of the meta row, in document order, so nothing signed is dropped (D8).
    promoted = [
        spec,
        *([title_child] if title_child is not None else []),
        *([key_figure] if key_figure is not None else []),
    ]
    head_alerts = [_alert(d) for node in promoted for d in node.diagnostics]
    meta = [*head_alerts, *_fields(tuple(meta_children))]
    return {
        "kind": "compound",
        "name": "EntityHeader",
        "args": args,
        "slots": {"signal": signal, "meta": meta, "provenance": provenance},
    }


def _frame(spec: SurfaceNode) -> Node:
    body = _section(spec, _fields(spec.children))
    return {"kind": "frame", "role": "page", "surface": "base", "children": [body]}


def _collapsible(spec: SurfaceNode) -> Node:
    target = _section(spec, _fields(spec.children), include_heading=False)
    if spec.emphasis is not None:
        target["emphasis"] = spec.emphasis
    return {
        "kind": "within",
        "id": spec.path,
        "dimension": "collapse",
        "range": [0, 1],
        "default": 1 if spec.collapse else 0,
        "summary": _disclosure_summary(spec.label),
        # The native disclosure summary already names the region. Repeating the section
        # heading inside its target would announce and paint the same label twice when open.
        "target": target,
    }


def _table(spec: SurfaceNode) -> Node:
    if not spec.items:
        return _section(spec, [_empty_collection(spec)])
    columns = spec.children or _columns_from_rows(spec.items)
    body = [node for item in spec.items for node in _table_row(item, len(columns))]
    rows = [_table_header(columns), *body] if columns else body
    grid: Node = {"kind": "grid", "role": "list", "children": rows}
    if columns:
        grid["columns"] = ["flexible" for _ in columns]
        grid["ruled"] = True
    return _section(spec, [grid])


def _disclosure_summary(label: str) -> str:
    """Return a visible native-control label even for hostile/blank schema titles."""
    return normalize_visible_label_text(label, fallback="Details")


def _columns_from_rows(rows: tuple[SurfaceNode, ...]) -> tuple[SurfaceNode, ...]:
    return rows[0].children if rows else ()


def _table_header(columns: tuple[SurfaceNode, ...]) -> Node:
    return {"kind": "grid", "role": "inline", "children": [_header_cell(c) for c in columns]}


def _header_cell(column: SurfaceNode) -> Node:
    cell = _caption(column.label)
    if column.intent is not None:
        cell["intent"] = column.intent
    return cell


def _table_row(row: SurfaceNode, column_count: int) -> list[Node]:
    # A row without fields (D9 linked-ref backstop, scalar items under a table hint)
    # renders itself as the leading cell instead of vanishing into blank padding.
    cells = [_table_cell(cell) for cell in row.children] if row.children else [_table_cell(row)]
    cells.extend(_empty_cell() for _ in range(column_count - len(cells)))
    grid: Node = {"kind": "grid", "role": "inline", "children": cells}
    # Row-level diagnostics stay visible (D8) as SIBLINGS of the row grid, never a
    # wrapper: only a direct-child grid adopts the table's subgrid tracks, so a
    # wrapped row lands in the first track and stacks its cells vertically. The
    # renderer spans a direct-child alert across the full row instead.
    alerts = [] if row.strategy == "diagnostic-node" else [_alert(d) for d in row.diagnostics]
    return [grid, *alerts]


def _table_cell(spec: SurfaceNode) -> Node:
    if spec.strategy in _CONTAINER:
        return emit_node(spec)
    lowered = _leaf(spec)
    # Empty Text is deliberately display:none in the renderer. Inside a grid
    # that removes the item box and shifts every following cell one track left.
    # Spacer is the grammar's data-free, aria-hidden structural placeholder.
    inner = (
        _empty_cell() if lowered.get("kind") == "text" and lowered.get("value") == "" else lowered
    )
    # Cell-level diagnostics stay visible (D8); a diagnostic-node cell already IS its alert.
    alerts = [] if spec.strategy == "diagnostic-node" else [_alert(d) for d in spec.diagnostics]
    if not alerts:
        return inner
    return {"kind": "stack", "role": "field-group", "children": [inner, *alerts]}


def _empty_cell() -> Node:
    return {"kind": "spacer", "size": "xs"}


def _section(spec: SurfaceNode, children: list[Node], *, include_heading: bool = True) -> Node:
    head: list[Node] = (
        [_heading(spec.label, spec.emphasis)] if include_heading and spec.heading else []
    )
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
    # Progress self-labels (a11y-required label), so it never sits in a caption+value
    # pair — it renders as its own full-width field.
    if spec.strategy in {"diagnostic-node", "progress"}:
        return False
    return spec.strategy in _LEAF and spec.text_as is None


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
    if spec.text_as is not None or spec.strategy == "progress":
        # Self-labelled regions (identity text, progress) never double-caption.
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


_CONTAINER_EMITTERS: dict[str, Callable[[SurfaceNode], Node]] = {
    "collapsed-section": _collapsible,
    "table": _table,
    "kpi-row": _kpi_row,
    "entity-header": _entity_header,
    "card-stack": _card_stack,
}

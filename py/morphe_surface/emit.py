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
    "breakdown",
    "trail",
    "key-value",
}
_STATUS_TONES = {"success", "caution", "info", "neutral"}
_PROVENANCE_INTENTS = {"provenance", "accession", "seal"}
_ATTENTION_STRATEGIES = {"status", "badge", "kpi-row"}
_ATTENTION_INTENTS = {"caution", "success", "info"}
_PRIMARY_WORKLIST_STRATEGIES = {"table", "card-stack"}


def _with_gloss(node: Node, gloss: str | None) -> Node:
    if gloss is not None:
        node["gloss"] = gloss
    return node


def emit_node(spec: SurfaceNode) -> Node:
    """Stage 2 (ADR-0014 D2): mechanically render a SurfaceNode into a grammar Node dict.

    Read-only only (D4): never emits Field/Select/Toggle/Range/Button. Every output is a
    `validate_node`-valid tree; `Within(collapse)` owns the region it adapts (D5).
    """
    if spec.strategy in _LEAF:
        node = _leaf(spec)
    else:
        # A container dispatch TABLE, mirroring _LEAF_EMITTERS: the strategy vocabulary is
        # closed, so container emitters are enumerable data. record-card is the default.
        emitter = _CONTAINER_EMITTERS.get(spec.strategy)
        node = emitter(spec) if emitter is not None else _frame(spec)
    return _ensure_root_task(spec, node)


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
    if spec.gloss is not None and (spec.text_as or "body") in {
        "display",
        "heading",
        "subheading",
        "caption",
    }:
        node["gloss"] = spec.gloss
    return node


def _badge(spec: SurfaceNode) -> Node:
    return _with_gloss(
        {
            "kind": "badge",
            "label": scalar_text(spec.value, spec.scalar_number_kind),
            "intent": spec.intent or "neutral",
        },
        spec.gloss,
    )


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
    return _with_gloss(node, spec.gloss)


def _status(spec: SurfaceNode) -> Node:
    text = normalize_visible_label_text(_str(spec.value), fallback="—")
    return _with_gloss(
        {"kind": "status", "tone": _status_tone(spec.intent), "signal": {"text": text}},
        spec.gloss,
    )


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
    # The SignalCard tiles ride the promoted StatBand compound: the band owns the
    # auto-fit narrow-track grid (no ``columns`` means it wraps) that packs the KPI
    # band. The factory splices the ``tiles`` slot inline as the grid's children.
    band: Node = {"kind": "compound", "name": "StatBand", "args": {}, "slots": {"tiles": cards}}
    return _section(spec, [band])


def _signal_card(item: SurfaceNode) -> Node:
    if item.strategy == "diagnostic-node":
        return _leaf(item)
    kicker = _with_gloss(
        {
            "kind": "text",
            "value": item.kicker or "",
            "as": "caption",
            "intent": "folio",
        },
        item.kicker_gloss,
    )
    title = _with_gloss({"kind": "text", "value": item.label, "as": "subheading"}, item.gloss)
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
    # The corner signal (KRA-757 §3.2): a status/badge child authored on the cell
    # rides the card's `signal` slot — the band carries state, not just numbers.
    signal = [_slot_leaf(child) for child in item.children if child.strategy in {"status", "badge"}]
    return {
        "kind": "compound",
        "name": "SignalCard",
        "args": {"kicker": kicker, "title": title, "measure": measure},
        # Signed KPI diagnostics stay visible through the body slot.
        "slots": {"signal": signal, "body": body},
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
    provenance_facts: list[Node] = []
    provenance_seals: list[Node] = []
    provenance_links: list[Node] = []
    provenance_specs: list[SurfaceNode] = []
    signal: list[Node] = []
    meta_children: list[SurfaceNode] = []
    key_figure: SurfaceNode | None = None
    title_child: SurfaceNode | None = None
    for child in spec.children:
        if child.intent in _PROVENANCE_INTENTS:
            provenance_specs.append(child)
            quiet_child = _without_diagnostics(child)
            if quiet_child is not None:
                _route_provenance_node(
                    child,
                    _slot_leaf(quiet_child)
                    if child.strategy == "linked-ref"
                    else _field(quiet_child),
                    facts=provenance_facts,
                    seals=provenance_seals,
                    links=provenance_links,
                )
        elif child.strategy == "number" and key_figure is None:
            key_figure = child
        elif child.strategy in {"status", "badge"}:
            signal.append(_slot_leaf(child))
        elif title_child is None and _is_title_candidate(child):
            title_child = child
        else:
            meta_children.append(child)
    if title_child is not None:
        context_value = display_scalar_text(
            title_child.value, title_child.temporal, title_child.scalar_number_kind
        )
    else:
        context_value = ""
    # Entity identity is context beneath the task, never an inferred display/H1.
    kicker: Node = {
        "kind": "text",
        "value": context_value,
        "as": "caption",
        "intent": "folio",
    }
    title = _with_gloss({"kind": "text", "value": spec.label, "as": "heading"}, spec.gloss)
    if spec.path == "$":
        title["level"] = 1
    args: Node = {"kicker": kicker, "title": title}
    if key_figure is not None:
        measure = _number(key_figure)
        measure["emphasis"] = "strong"
        _label_number(measure, key_figure)
        args["keyFigure"] = measure
    # Diagnostics on the node itself and on the two children promoted to BARE args
    # (title, keyFigure) would otherwise lose their alert path. Surface them all at
    # the head of the meta row, in document order, so nothing signed is dropped (D8).
    promoted = [
        spec,
        *([title_child] if title_child is not None else []),
        *([key_figure] if key_figure is not None else []),
    ]
    head_alerts = [
        *[_alert(d) for node in promoted for d in node.diagnostics],
        *_provenance_diagnostic_alerts(provenance_specs),
    ]
    meta = [*head_alerts, *_fields(tuple(meta_children))]
    return {
        "kind": "compound",
        "name": "EntityHeader",
        "args": args,
        "slots": {
            "signal": signal,
            "meta": meta,
            "provenance": [_provenance_footer(provenance_facts, provenance_seals, provenance_links)]
            if provenance_facts or provenance_seals or provenance_links
            else [],
        },
    }


def _breakdown_numeric(child: SurfaceNode) -> float | None:
    # A row is numeric iff its built value is a real number (never a bool). A
    # non-numeric child keeps its value but degrades its progress to indeterminate.
    value = child.value
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return float(value)


def _label_number(node: Node, spec: SurfaceNode) -> None:
    if spec.gloss is not None:
        node["label"] = spec.label
        node["gloss"] = spec.gloss


def _breakdown_row(child: SurfaceNode, number: float | None, positive_sum: float) -> list[Node]:
    # One proportion row: label + progress + value cluster (D8 keeps child alerts).
    label = _with_gloss(
        {"kind": "text", "value": child.label, "as": "caption", "intent": "neutral"},
        child.gloss,
    )
    progress: Node = {
        "kind": "progress",
        "label": normalize_visible_label_text(child.label, fallback="Proportion"),
    }
    if number is not None and positive_sum > 0:
        # IEEE-754 double division — identical in both compilers; clamped like the
        # `progress` strategy so a negative share degrades to an empty bar, not a lie.
        progress["value"] = min(1.0, max(0.0, number / positive_sum))
    # A numeric child leads with a number node; a non-numeric one shows its natural
    # leaf (a NumberNode cannot hold a non-numeric value), with progress indeterminate.
    value_node = _number(child) if number is not None else _leaf(child)
    cluster: Node = {
        "kind": "cluster",
        "role": "inline",
        "align": "baseline",
        "children": [label, progress, value_node],
    }
    alerts = [] if child.strategy == "diagnostic-node" else [_alert(d) for d in child.diagnostics]
    return [cluster, *alerts]


def _breakdown(spec: SurfaceNode) -> Node:
    numbers = [_breakdown_numeric(child) for child in spec.children]
    positive_sum = sum(n for n in numbers if n is not None and n > 0)
    rows: list[Node] = []
    for child, number in zip(spec.children, numbers, strict=True):
        rows.extend(_breakdown_row(child, number, positive_sum))
    args: Node = {}
    if spec.path != "$" and spec.heading:
        args["title"] = _heading(spec.label, spec.emphasis, gloss=spec.gloss)
    # Node-level diagnostics ride the head of the rows slot so nothing signed is dropped.
    head_alerts = [_alert(d) for d in spec.diagnostics]
    return {
        "kind": "compound",
        "name": "Breakdown",
        "args": args,
        "slots": {"rows": [*head_alerts, *rows]},
    }


def _trail_entry(item: SurfaceNode) -> Node:
    # One event row -> one TrailEntry compound. Classification is deterministic and
    # HINT-KEYED only (never name-based): role:provenance -> provenance slot; a
    # linked-ref child -> ref slot; a status/badge child -> signals (the event's
    # state chips); the first temporal-hinted child -> stamp; the first string
    # scalar among the rest -> summary; EVERYTHING ELSE -> detail. Every valid
    # event field has exactly one home — nothing authored disappears (KRA-788 D3;
    # zygos rejected `trail` precisely because leftovers were dropped).
    stamp: SurfaceNode | None = None
    summary_child: SurfaceNode | None = None
    signals: list[Node] = []
    detail: list[Node] = []
    ref: list[Node] = []
    provenance_specs: list[SurfaceNode] = []
    for child in item.children:
        if child.intent in _PROVENANCE_INTENTS:
            provenance_specs.append(child)
        elif child.strategy == "linked-ref":
            ref.append(_slot_leaf(child))
        elif child.strategy in {"status", "badge"}:
            signals.append(_slot_leaf(child))
        elif stamp is None and child.temporal is not None:
            stamp = child
        elif summary_child is None and _is_title_candidate(child):
            summary_child = child
        else:
            # A detail field keeps its caption (the label IS the subject — an
            # unlabelled amount means nothing) and its own diagnostics; containers
            # self-head through the ordinary field path.
            detail.append(_field(child))
    if summary_child is not None:
        summary_value = display_scalar_text(
            summary_child.value, summary_child.temporal, summary_child.scalar_number_kind
        )
    elif not item.children and isinstance(item.value, str):
        summary_value = display_scalar_text(item.value, item.temporal, item.scalar_number_kind)
    else:
        summary_value = item.label
    args: Node = {"summary": {"kind": "text", "value": summary_value, "as": "body"}}
    if stamp is not None:
        args["stamp"] = {
            "kind": "text",
            "value": display_scalar_text(stamp.value, stamp.temporal, stamp.scalar_number_kind),
            "as": "caption",
            "intent": "marginalia",
        }
    # The event object itself and the children promoted to BARE args (stamp, summary)
    # would otherwise lose their alert path. Surface them at the provenance-footer
    # head, in document order, so nothing signed is dropped (D8).
    promoted = [
        item,
        *([stamp] if stamp is not None else []),
        *([summary_child] if summary_child is not None else []),
    ]
    head_alerts = [
        _alert(d)
        for node in promoted
        if node.strategy != "diagnostic-node"
        for d in node.diagnostics
    ]
    head_alerts.extend(_provenance_diagnostic_alerts(provenance_specs))
    provenance_footer = _surface_provenance_footer(provenance_specs)
    return {
        "kind": "compound",
        "name": "TrailEntry",
        "args": args,
        "slots": {
            "signals": signals,
            "detail": detail,
            "ref": ref,
            "provenance": [
                *head_alerts,
                *([provenance_footer] if provenance_footer is not None else []),
            ],
        },
    }


def _trail(spec: SurfaceNode) -> Node:
    entries = [_trail_entry(item) for item in spec.items]
    return _section(spec, entries or [_empty_collection(spec)])


def _key_value(spec: SurfaceNode) -> Node:
    # Tier the object's children by HINT only (never name): a child carrying an
    # emphasis hint is a primary field; a role:provenance child is a provenance
    # field; everything else is secondary. Each tier renders through the SAME
    # definition-grid idiom the hint-free floor uses, so a primary value stays
    # strong (it carries its own emphasis) and identifiers keep one home.
    primary: list[SurfaceNode] = []
    secondary: list[SurfaceNode] = []
    provenance: list[SurfaceNode] = []
    for child in spec.children:
        if child.intent in _PROVENANCE_INTENTS:
            provenance.append(child)
        elif child.emphasis is not None:
            primary.append(child)
        else:
            secondary.append(child)
    node_alerts = [
        *[_alert(d) for d in spec.diagnostics],
        *_provenance_diagnostic_alerts(provenance),
    ]
    primary_fill = [*node_alerts, *([_definition_grid(primary)] if primary else [])]
    provenance_fill = _surface_provenance_footer(provenance)
    return {
        "kind": "compound",
        "name": "KeyValuePanel",
        "args": {},
        "slots": {
            "primary": primary_fill,
            "secondary": [_definition_grid(secondary)] if secondary else [],
            "provenance": [provenance_fill] if provenance_fill is not None else [],
        },
    }


def _frame(spec: SurfaceNode) -> Node:
    body = _operational_page(spec) if spec.path == "$" else _section(spec, _fields(spec.children))
    return {"kind": "frame", "role": "page", "surface": "base", "children": [body]}


def _ensure_root_task(spec: SurfaceNode, node: Node) -> Node:
    """Give every valid root strategy one compiler-owned operational task H1.

    Record-card and EntityHeader already place that heading inside their canonical
    composition. Every other closed strategy is wrapped once at the root; nested
    ``heading: false`` semantics remain unchanged.
    """
    if spec.path != "$" or spec.strategy in {"record-card", "entity-header"}:
        return node
    return {
        "kind": "stack",
        "role": "section",
        "children": [_heading(spec.label, spec.emphasis, level=1, gloss=spec.gloss), node],
    }


def _operational_page(spec: SurfaceNode) -> Node:
    """Compose the root pane in decision order without dropping signed fields.

    The compiler has only signed hints, never kernel vocabulary. It therefore
    uses the existing generic claims: inferred identity is context; status-like
    or emphasized children are attention/work; unclaimed content keeps source
    order; provenance intents move to one trailing native disclosure.
    """
    context: list[SurfaceNode] = []
    attention: list[SurfaceNode] = []
    primary_worklist: list[SurfaceNode] = []
    content: list[SurfaceNode] = []
    provenance: list[SurfaceNode] = []
    for child in spec.children:
        # Explicit signed provenance wins over inferred identity/context.
        if child.intent in _PROVENANCE_INTENTS:
            provenance.append(child)
        elif _is_context_identity(child):
            context.append(child)
        elif _is_primary_worklist(child):
            primary_worklist.append(child)
        elif _is_attention(child):
            attention.append(child)
        else:
            content.append(child)

    # A root operational task is the document title even when a legacy producer
    # carried ``heading: false`` to let the old route chrome own that title. The
    # hint still suppresses nested section headings; it cannot erase the pane H1.
    head = [_heading(spec.label, spec.emphasis, level=1, gloss=spec.gloss)]
    alerts = [_alert(d) for d in spec.diagnostics]
    provenance_alerts = _provenance_diagnostic_alerts(provenance)
    footer = _surface_provenance_footer(provenance)
    return {
        "kind": "stack",
        "role": "section",
        "children": [
            *head,
            *_fields(tuple(context)),
            *alerts,
            *provenance_alerts,
            *_fields(tuple(attention)),
            *_fields(tuple(primary_worklist)),
            *_fields(tuple(content)),
            *([footer] if footer is not None else []),
        ],
    }


def _is_context_identity(spec: SurfaceNode) -> bool:
    return spec.text_as == "caption" and spec.emphasis == "muted"


def _is_attention(spec: SurfaceNode) -> bool:
    return (
        bool(spec.diagnostics)
        or spec.emphasis in {"strong", "critical"}
        or spec.strategy in _ATTENTION_STRATEGIES
        or spec.intent in _ATTENTION_INTENTS
    )


def _is_primary_worklist(spec: SurfaceNode) -> bool:
    return spec.strategy in _PRIMARY_WORKLIST_STRATEGIES and spec.emphasis == "strong"


def _surface_provenance_footer(specs: list[SurfaceNode]) -> Node | None:
    facts: list[Node] = []
    seals: list[Node] = []
    links: list[Node] = []
    for spec in specs:
        quiet_spec = _without_diagnostics(spec)
        if quiet_spec is None:
            continue
        # A Link already carries its visible label. Sending it through ``_field``
        # would repeat that signed label as both a caption and link in the audit
        # disclosure; use the same bare-plus-diagnostics slot path as compounds.
        lowered = _slot_leaf(quiet_spec) if spec.strategy == "linked-ref" else _field(quiet_spec)
        _route_provenance_node(spec, lowered, facts=facts, seals=seals, links=links)
    if not facts and not seals and not links:
        return None
    return _provenance_footer(facts, seals, links)


def _without_diagnostics(spec: SurfaceNode) -> SurfaceNode | None:
    """Clone a provenance subtree without diagnostics for its quiet audit lane.

    Diagnostics are decision material, not provenance furniture. Their signed code,
    detail, and repair are hoisted by ``_provenance_diagnostic_alerts`` while this
    clone keeps every provenance value in the default-closed footer exactly once.
    """
    # A diagnostic-node's rendered value *is* its diagnostic. Once that alert is
    # hoisted, retaining the intrinsic node would repeat the same detail inside
    # the closed footer. Direct-IR diagnostic nodes without a Diagnostic remain.
    if spec.strategy == "diagnostic-node" and spec.diagnostics:
        return None

    quiet_children = tuple(
        quiet for child in spec.children if (quiet := _without_diagnostics(child)) is not None
    )
    quiet_items = tuple(
        quiet for item in spec.items if (quiet := _without_diagnostics(item)) is not None
    )
    return spec.model_copy(
        update={
            "diagnostics": (),
            "children": quiet_children,
            "items": quiet_items,
        }
    )


def _provenance_diagnostic_alerts(specs: list[SurfaceNode]) -> list[Node]:
    alerts: list[Node] = []
    for spec in specs:
        alerts.extend(_labeled_alert(spec.label, diagnostic) for diagnostic in spec.diagnostics)
        alerts.extend(_provenance_diagnostic_alerts(list(spec.children)))
        alerts.extend(_provenance_diagnostic_alerts(list(spec.items)))
    return alerts


def _route_provenance_node(
    spec: SurfaceNode,
    node: Node,
    *,
    facts: list[Node],
    seals: list[Node],
    links: list[Node],
) -> None:
    if spec.strategy == "linked-ref":
        links.append(node)
    elif spec.intent == "seal":
        seals.append(node)
    else:
        facts.append(node)


def _provenance_footer(facts: list[Node], seals: list[Node], links: list[Node]) -> Node:
    return {
        "kind": "compound",
        "name": "ProvenanceFooter",
        "args": {},
        "slots": {"facts": facts, "seals": seals, "links": links},
    }


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
    cell = _caption(column.label, column.gloss)
    if column.intent is not None:
        cell["intent"] = column.intent
    return cell


def _table_row(row: SurfaceNode, column_count: int) -> list[Node]:
    # A row without fields (D9 linked-ref backstop, scalar items under a table hint)
    # renders itself as the leading cell instead of vanishing into blank padding.
    cells = [_table_cell(cell) for cell in row.children] if row.children else [_table_cell(row)]
    cells.extend(_empty_cell() for _ in range(column_count - len(cells)))
    grid: Node = {"kind": "grid", "role": "inline", "children": cells}
    # Both row- and cell-level diagnostics stay visible (D8) as SIBLINGS of the row
    # grid, never wrappers: only a direct-child grid adopts the table's subgrid
    # tracks, so a wrapped row/cell lands in the first track and stacks vertically.
    # A cell diagnostic wrapped INSIDE its cell also inherits InlineAlert's inline
    # min-size floor and paints over dense neighbours (KRA-796). Lifting it to the
    # row lane lets the Grid rule span it 1/-1 across the full row instead. Row
    # diagnostics come first, then leaf cell diagnostics in cell order.
    if row.strategy == "diagnostic-node":
        return [grid]
    row_alerts = [_alert(d) for d in row.diagnostics]
    cell_alerts = _lifted_cell_alerts(row.children) if row.children else []
    return [grid, *row_alerts, *cell_alerts]


def _lifted_cell_alerts(cells: tuple[SurfaceNode, ...]) -> list[Node]:
    # Container cells self-head and render their own diagnostics; a diagnostic-node
    # cell already IS its alert. Only leaf cells' diagnostics lift to the row lane,
    # each carrying its field label so the copy stays anchored once it leaves the cell.
    alerts: list[Node] = []
    for cell in cells:
        if cell.strategy in _CONTAINER or cell.strategy == "diagnostic-node":
            continue
        alerts.extend(_labeled_alert(cell.label, d) for d in cell.diagnostics)
    return alerts


def _table_cell(spec: SurfaceNode) -> Node:
    if spec.strategy in _CONTAINER:
        return emit_node(spec)
    lowered = _leaf(spec)
    # Empty Text is deliberately display:none in the renderer. Inside a grid
    # that removes the item box and shifts every following cell one track left.
    # Spacer is the grammar's data-free, aria-hidden structural placeholder.
    #
    # Leaf cells render just their inner content — cell diagnostics are lifted to
    # the row diagnostics lane by ``_table_row`` (KRA-796), never wrapped here.
    return (
        _empty_cell() if lowered.get("kind") == "text" and lowered.get("value") == "" else lowered
    )


def _empty_cell() -> Node:
    return {"kind": "spacer", "size": "xs"}


def _section(spec: SurfaceNode, children: list[Node], *, include_heading: bool = True) -> Node:
    head: list[Node] = (
        [_heading(spec.label, spec.emphasis, gloss=spec.gloss)]
        if include_heading and spec.heading and spec.path != "$"
        else []
    )
    alerts = [_alert(d) for d in spec.diagnostics]
    return {"kind": "stack", "role": "section", "children": [*head, *alerts, *children]}


def _heading(
    label: str,
    emphasis: str | None,
    *,
    level: int | None = None,
    gloss: str | None = None,
) -> Node:
    node: Node = {"kind": "text", "value": label, "as": "heading"}
    if level is not None:
        node["level"] = level
    if emphasis is not None:
        node["emphasis"] = emphasis
    return _with_gloss(node, gloss)


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
        caption_gloss = spec.gloss if spec.strategy in {"scalar", "number"} else None
        children.extend((_caption(spec.label, caption_gloss), _definition_value(spec)))
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
        "children": [
            _caption(spec.label, spec.gloss if spec.strategy in {"scalar", "number"} else None),
            inner,
            *alerts,
        ],
    }


def _empty_collection(spec: SurfaceNode) -> Node:
    label = spec.label.strip().lower()
    return {
        "kind": "text",
        "value": f"No {label or 'items'}.",
        "as": "caption",
        "intent": "neutral",
    }


def _caption(label: str, gloss: str | None = None) -> Node:
    return _with_gloss(
        {"kind": "text", "value": label, "as": "caption", "intent": "neutral"}, gloss
    )


def _alert(diag: Diagnostic) -> Node:
    node: Node = {
        "kind": "inline-alert",
        "tone": _tone(diag.severity),
        "title": diag.code,
        "detail": diag.message,
    }
    # The producer-authored next action renders as honest structure (KRA-757 §3.8):
    # authored vocabulary is never dead vocabulary, and the human action never
    # blurs into the machine detail.
    if diag.repair_hint is not None:
        node["repair"] = diag.repair_hint
    return node


def _labeled_alert(label: str, diag: Diagnostic) -> Node:
    # A cell diagnostic lifted out of its cell loses its spatial tie to the field,
    # so the title names the field it refers to: "<Field label>: <code>" (KRA-796).
    # The lifted alert keeps everything _alert renders — including the authored
    # repair hint (KRA-788) — only the title gains the field name.
    node = _alert(diag)
    if label:
        node["title"] = f"{label}: {diag.code}"
    return node


def _tone(severity: str) -> str:
    return {"error": "caution", "warning": "caution", "info": "info"}.get(severity, "info")


def _str(value: object) -> str:
    return "" if value is None else str(value)


_CONTAINER_EMITTERS: dict[str, Callable[[SurfaceNode], Node]] = {
    "collapsed-section": _collapsible,
    "table": _table,
    "kpi-row": _kpi_row,
    "entity-header": _entity_header,
    "breakdown": _breakdown,
    "trail": _trail,
    "key-value": _key_value,
    "card-stack": _card_stack,
}

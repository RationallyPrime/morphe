from __future__ import annotations

import re
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Any, Literal, cast

from pydantic import ValidationError

from morphe_contracts import Diagnostic

from .hints import MorpheHint, parse_hint
from .refs import resolve_ref, schema_type
from .resolve import resolve_strategy
from .spec import SurfaceNode

if TYPE_CHECKING:
    from morphe_contracts import IntentRef

    from .spec import Polarity
    from .strategies import Strategy

# D9 backstop: a re-entered schema id OR this depth bound degrades a record to a link, so
# graph-shaped/cyclic data always terminates. Mirrors the compound depth bound.
MAX_DEPTH = 6

_RECORD = {"record-card", "collapsed-section"}
_COLLECTION = {"table", "card-stack", "kpi-row"}
# Only row-shaped collections compete for the depth-0 "primary collection" promotion —
# a leading KPI row is a header, not the record's main body.
_PROMOTABLE = {"table", "card-stack"}
_IDENTITY_KEYS = ("name", "title")
_NUMERIC_TEXT = re.compile(r"^\(?[+-]?\d(?:[\d _.,]*\d)?\)?$")

type _Presentation = Literal["identity", "primary-collection"] | None


@dataclass(frozen=True)
class _Ctx:
    """Immutable recursion state threaded through build (keeps every fn under the arg cap)."""

    root: dict[str, Any]
    diagnostics: dict[str, list[Diagnostic]]
    path: str
    label: str
    depth: int
    seen: frozenset[str]
    presentation: _Presentation = None

    def child(self, key: str, *, schema_id: str | None, presentation: _Presentation = None) -> _Ctx:
        seen = self.seen | ({schema_id} if schema_id else frozenset())
        return replace(
            self,
            path=f"{self.path}.{key}",
            label=str(key),
            depth=self.depth + 1,
            seen=seen,
            presentation=presentation,
        )

    def item(self, index: int, base_label: str) -> _Ctx:
        return replace(
            self,
            path=f"{self.path}[{index}]",
            label=f"{base_label} {index}",
            depth=self.depth + 1,
            presentation=None,
        )


@dataclass(frozen=True)
class _Plan:
    """The resolved render decision for one node — stage-1's verdict before recursion."""

    resolved: dict[str, Any]
    strategy: Strategy
    label: str
    hint: MorpheHint
    diags: tuple[Diagnostic, ...]
    sid: str | None


def build_surface(
    schema: dict[str, Any],
    data: object,
    *,
    root: dict[str, Any],
    diagnostics: dict[str, list[Diagnostic]] | None = None,
) -> SurfaceNode:
    """Stage 1 (ADR-0014 D2): JSON Schema + data -> typed SurfaceNode IR.

    Total (D8) and terminating (D9): unrenderable -> diagnostic-node;
    cycles/over-depth -> linked-ref.
    """
    ctx = _Ctx(
        root=root, diagnostics=diagnostics or {}, path="$", label="", depth=0, seen=frozenset()
    )
    return _build(schema, data, ctx)


def _build(schema: dict[str, Any], data: object, ctx: _Ctx) -> SurfaceNode:
    plan = _plan(schema, ctx)
    if plan.strategy in _RECORD:
        if ctx.depth >= MAX_DEPTH or (plan.sid is not None and plan.sid in ctx.seen):
            return SurfaceNode(
                path=ctx.path, label=plan.label, strategy="linked-ref", diagnostics=plan.diags
            )
        return _record(plan, data, ctx)
    if plan.strategy in _COLLECTION:
        return _collection(plan, data, ctx)
    return _leaf(plan, data, ctx)


def _plan(schema: dict[str, Any], ctx: _Ctx) -> _Plan:
    resolved = resolve_ref(schema, ctx.root)
    hint = _hint_for(schema, resolved)
    # Labels read the RAW schema's title only (authored/Pydantic-prettified); a $ref
    # target's title is a class name, never a label — fall back to the field key (KRA-677).
    label = _label(schema, hint.label, ctx.label or _segment(ctx.path))
    return _Plan(
        resolved=resolved,
        strategy=resolve_strategy(resolved, hint, root=ctx.root),
        label=label,
        hint=hint,
        diags=tuple(ctx.diagnostics.get(ctx.path, ())),
        sid=_ref_id(resolved) or _ref_id(schema),
    )


def _record(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    # Top object is a record-card; nested objects collapse by default (D5).
    eff: Strategy = (
        "record-card"
        if (ctx.depth == 0 and plan.strategy == "record-card")
        else "collapsed-section"
    )
    props = plan.resolved.get("properties", {})
    prop_items = props.items() if isinstance(props, dict) else ()
    pairs = tuple(
        (str(key), sub if isinstance(sub, dict) else {})
        for key, sub in prop_items
        if not _hidden(sub, ctx.root)
    )
    identity_key = _identity_key(pairs, plan.resolved, ctx) if ctx.depth == 0 else None
    primary_collection_key = _primary_collection_key(pairs, ctx) if ctx.depth == 0 else None
    children = tuple(
        _build(
            sub,
            _get(data, key),
            ctx.child(
                key,
                schema_id=plan.sid,
                presentation=_child_presentation(key, identity_key, primary_collection_key),
            ),
        )
        for key, sub in pairs
    )
    collapse = (plan.hint.collapse is not False) if eff == "collapsed-section" else None
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy=eff,
        heading=plan.hint.heading,
        collapse=collapse,
        children=children,
        diagnostics=plan.diags,
    )


def _collection(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    if plan.strategy == "kpi-row":
        return _kpi_row(plan, data, ctx)
    items_schema = plan.resolved.get("items")
    items_schema = items_schema if isinstance(items_schema, dict) else {}
    rows = data if isinstance(data, list) else []
    columns = _table_columns(items_schema, ctx) if plan.strategy == "table" else ()
    items = tuple(_build(items_schema, row, ctx.item(i, plan.label)) for i, row in enumerate(rows))
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy=plan.strategy,
        heading=plan.hint.heading,
        emphasis="strong" if ctx.presentation == "primary-collection" else None,
        children=columns,
        items=items,
        diagnostics=plan.diags,
    )


def _kpi_row(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    rows = data if isinstance(data, list) else []
    items = tuple(_kpi_cell(row, ctx.item(i, plan.label)) for i, row in enumerate(rows))
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy="kpi-row",
        heading=plan.hint.heading,
        items=items,
        diagnostics=plan.diags,
    )


def _kpi_cell(row: object, ctx: _Ctx) -> SurfaceNode:
    """Lower one KpiCell-shaped record; anything else degrades in place (D8)."""
    if not isinstance(row, dict):
        why = "unrenderable: kpi-row item is not a record"
        diag = Diagnostic(code="UNRENDERABLE", severity="warning", path=ctx.path, message=why)
        return SurfaceNode(
            path=ctx.path,
            label=ctx.label,
            strategy="diagnostic-node",
            value=why,
            diagnostics=(diag,),
        )
    cell = cast("dict[str, Any]", row)
    presentation = _cell_presentation(cell)
    number = _coerce_number(cell.get("value"))
    return SurfaceNode(
        path=ctx.path,
        label=_string_or_none(cell.get("label")) or ctx.label,
        strategy="number" if number is not None else "scalar",
        value=number if number is not None else _as_scalar(cell.get("value")),
        intent=presentation.role,
        number_format=presentation.format,
        currency=presentation.currency,
        kicker=_string_or_none(cell.get("kicker")),
    )


def _cell_presentation(cell: dict[str, Any]) -> MorpheHint:
    # Reuse the hint model as the validation gate for a cell's presentation keys — a
    # malformed cell keeps its value and loses only the presentation (totality, D8).
    try:
        return MorpheHint.model_validate(
            {
                "role": cell.get("intent"),
                "format": cell.get("format"),
                "currency": cell.get("currency"),
            }
        )
    except ValidationError:
        return MorpheHint()


def _table_columns(items_schema: dict[str, Any], ctx: _Ctx) -> tuple[SurfaceNode, ...]:
    resolved = resolve_ref(items_schema, ctx.root)
    props = resolved.get("properties")
    pairs = props.items() if isinstance(props, dict) else ()
    # The hidden filter matches _record's, so column heads stay aligned with row cells.
    return tuple(
        _table_column(str(key), sub if isinstance(sub, dict) else {}, ctx)
        for key, sub in pairs
        if not _hidden(sub, ctx.root)
    )


def _table_column(key: str, schema: dict[str, Any], ctx: _Ctx) -> SurfaceNode:
    resolved = resolve_ref(schema, ctx.root)
    hint = _hint_for(schema, resolved)
    label = _label(schema, hint.label, key)
    return SurfaceNode(
        path=f"{ctx.path}.{key}", label=label, strategy="scalar", value=label, intent=hint.role
    )


def _hint_for(schema: dict[str, Any], resolved: dict[str, Any]) -> MorpheHint:
    # A field's own x-morphe overrides the referenced target's (call site owns the register).
    return parse_hint(schema) if "x-morphe" in schema else parse_hint(resolved)


def _hidden(schema: object, root: dict[str, Any]) -> bool:
    # ``hidden: true`` keeps a field in REST/OpenAPI but out of the surface (KRA-677).
    if not isinstance(schema, dict):
        return False
    sub = cast("dict[str, Any]", schema)
    return _hint_for(sub, resolve_ref(sub, root)).hidden


def _leaf(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    if plan.strategy == "linked-ref":
        label, href = _linked_ref(plan.label, data)
        return SurfaceNode(
            path=ctx.path,
            label=label,
            strategy="linked-ref",
            href=href,
            diagnostics=plan.diags,
        )
    if plan.strategy == "diagnostic-node":
        why = f"unrenderable: {schema_type(plan.resolved) or 'unknown construct'}"
        diag = Diagnostic(code="UNRENDERABLE", severity="warning", path=ctx.path, message=why)
        return SurfaceNode(
            path=ctx.path,
            label=plan.label,
            strategy="diagnostic-node",
            value=why,
            diagnostics=(*plan.diags, diag),
        )
    if plan.strategy == "number":
        return _number_leaf(plan, data, ctx)
    if plan.strategy == "progress":
        return _progress_leaf(plan, data, ctx)
    if plan.strategy == "status":
        return _status_leaf(plan, data, ctx)
    value = _as_scalar(data)
    numeric, polarity = _numeric_presentation(value)
    identity = ctx.presentation == "identity" and plan.strategy == "scalar"
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy=plan.strategy,
        value=value,
        intent=_value_intent(plan.hint, value) if plan.strategy == "badge" else plan.hint.role,
        text_as="display" if identity else None,
        emphasis="critical"
        if identity
        else (plan.hint.emphasis if plan.strategy == "scalar" else None),
        numeric=numeric if plan.strategy == "scalar" else None,
        polarity=polarity if plan.strategy == "scalar" else None,
        diagnostics=plan.diags,
    )


def _number_leaf(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    number = _coerce_number(data)
    if number is None:
        # Totality (D8): a non-numeric value under a number hint keeps the scalar floor.
        value = _as_scalar(data)
        numeric, polarity = _numeric_presentation(value)
        return SurfaceNode(
            path=ctx.path,
            label=plan.label,
            strategy="scalar",
            value=value,
            intent=plan.hint.role,
            emphasis=plan.hint.emphasis,
            numeric=numeric,
            polarity=polarity,
            diagnostics=plan.diags,
        )
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy="number",
        value=number,
        intent=plan.hint.role,
        emphasis=plan.hint.emphasis,
        number_format=plan.hint.format,
        currency=plan.hint.currency,
        diagnostics=plan.diags,
    )


def _progress_leaf(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    number = _coerce_number(data)
    # A non-numeric value renders an INDETERMINATE bar, not a lie about completion.
    fraction = min(1.0, max(0.0, float(number))) if number is not None else None
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy="progress",
        value=fraction,
        intent=plan.hint.role,
        diagnostics=plan.diags,
    )


def _status_leaf(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    value = _as_scalar(data)
    text = "" if value is None else str(value)
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy="status",
        value=text,
        intent=_value_intent(plan.hint, text),
        diagnostics=plan.diags,
    )


def _value_intent(hint: MorpheHint, value: object) -> IntentRef | None:
    # Per-VALUE intent (the ``intents`` map) wins over the field-level role: one enum
    # column carries state-dependent color without a bespoke presenter per state.
    mapped = (hint.intents or {}).get("" if value is None else str(value))
    return mapped or hint.role


def _coerce_number(data: object) -> int | float | None:
    if isinstance(data, bool):
        return None
    if isinstance(data, int | float):
        return data
    if isinstance(data, str):
        text = data.strip()
        try:
            return int(text)
        except ValueError:
            try:
                return float(text)
            except ValueError:
                return None
    return None


def _label(schema: dict[str, Any], hint_label: str | None, fallback: str) -> str:
    if hint_label:
        return hint_label
    title = schema.get("title")
    return title if isinstance(title, str) else fallback


def _ref_id(schema: dict[str, Any]) -> str | None:
    rid = schema.get("$id") or schema.get("$ref")
    return rid if isinstance(rid, str) else None


def _segment(path: str) -> str:
    return path.rsplit(".", 1)[-1]


def _get(data: object, key: str) -> object:
    if isinstance(data, dict):
        return cast("dict[str, Any]", data).get(key)
    return None


def _child_presentation(
    key: str,
    identity_key: str | None,
    primary_collection_key: str | None,
) -> _Presentation:
    if key == identity_key:
        return "identity"
    if key == primary_collection_key:
        return "primary-collection"
    return None


def _identity_key(
    pairs: tuple[tuple[str, dict[str, Any]], ...],
    schema: dict[str, Any],
    ctx: _Ctx,
) -> str | None:
    for key in _IDENTITY_KEYS:
        match = next((schema for candidate, schema in pairs if candidate == key), None)
        if match is not None and _scalarish(match, ctx):
            return key

    required = schema.get("required")
    required_keys = required if isinstance(required, list) else []
    for key in required_keys:
        if not isinstance(key, str):
            continue
        match = next((schema for candidate, schema in pairs if candidate == key), None)
        if match is not None and _scalarish(match, ctx):
            return key
    return None


def _primary_collection_key(
    pairs: tuple[tuple[str, dict[str, Any]], ...],
    ctx: _Ctx,
) -> str | None:
    return next((key for key, schema in pairs if _strategy_for(schema, ctx) in _PROMOTABLE), None)


def _scalarish(schema: dict[str, Any], ctx: _Ctx) -> bool:
    return _strategy_for(schema, ctx) == "scalar"


def _strategy_for(schema: dict[str, Any], ctx: _Ctx) -> Strategy:
    resolved = resolve_ref(schema, ctx.root)
    return resolve_strategy(resolved, _hint_for(schema, resolved), root=ctx.root)


def _linked_ref(fallback_label: str, data: object) -> tuple[str, str | None]:
    if isinstance(data, dict):
        payload = cast("dict[str, Any]", data)
        label = _string_or_none(payload.get("label")) or fallback_label
        return label, _string_or_none(payload.get("href"))
    if isinstance(data, str):
        return fallback_label, data
    return fallback_label, None


def _string_or_none(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _numeric_presentation(value: object) -> tuple[bool | None, Polarity | None]:
    if isinstance(value, bool) or value is None:
        return None, None
    if isinstance(value, int | float):
        return True, "negative" if value < 0 else "positive"
    if not isinstance(value, str):
        return None, None
    text = value.strip()
    if not text or _NUMERIC_TEXT.fullmatch(text) is None:
        return None, None
    return True, "negative" if text.startswith(("-", "(")) else "positive"


def _as_scalar(data: object) -> str | int | float | bool | None:
    if isinstance(data, str | int | float | bool) or data is None:
        return data
    return str(data)

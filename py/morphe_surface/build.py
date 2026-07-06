from __future__ import annotations

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Any, cast

from morphe_contracts import Diagnostic

from .hints import parse_hint
from .refs import resolve_ref, schema_type
from .resolve import resolve_strategy
from .spec import SurfaceNode

if TYPE_CHECKING:
    from .hints import MorpheHint
    from .strategies import Strategy

# D9 backstop: a re-entered schema id OR this depth bound degrades a record to a link, so
# graph-shaped/cyclic data always terminates. Mirrors the compound depth bound.
MAX_DEPTH = 6

_RECORD = {"record-card", "collapsed-section"}
_COLLECTION = {"table", "card-stack"}


@dataclass(frozen=True)
class _Ctx:
    """Immutable recursion state threaded through build (keeps every fn under the arg cap)."""

    root: dict[str, Any]
    diagnostics: dict[str, list[Diagnostic]]
    path: str
    label: str
    depth: int
    seen: frozenset[str]

    def child(self, key: str, *, schema_id: str | None) -> _Ctx:
        seen = self.seen | ({schema_id} if schema_id else frozenset())
        return replace(
            self, path=f"{self.path}.{key}", label=str(key), depth=self.depth + 1, seen=seen
        )

    def item(self, index: int, base_label: str) -> _Ctx:
        return replace(
            self, path=f"{self.path}[{index}]", label=f"{base_label} {index}", depth=self.depth + 1
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
    label = _label(resolved, hint.label, ctx.label or _segment(ctx.path))
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
    pairs = props.items() if isinstance(props, dict) else ()
    children = tuple(
        _build(
            sub if isinstance(sub, dict) else {},
            _get(data, key),
            ctx.child(key, schema_id=plan.sid),
        )
        for key, sub in pairs
    )
    collapse = (plan.hint.collapse is not False) if eff == "collapsed-section" else None
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy=eff,
        collapse=collapse,
        children=children,
        diagnostics=plan.diags,
    )


def _collection(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    items_schema = plan.resolved.get("items")
    items_schema = items_schema if isinstance(items_schema, dict) else {}
    rows = data if isinstance(data, list) else []
    columns = _table_columns(items_schema, ctx) if plan.strategy == "table" else ()
    items = tuple(_build(items_schema, row, ctx.item(i, plan.label)) for i, row in enumerate(rows))
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy=plan.strategy,
        children=columns,
        items=items,
        diagnostics=plan.diags,
    )


def _table_columns(items_schema: dict[str, Any], ctx: _Ctx) -> tuple[SurfaceNode, ...]:
    resolved = resolve_ref(items_schema, ctx.root)
    props = resolved.get("properties")
    pairs = props.items() if isinstance(props, dict) else ()
    return tuple(
        _table_column(str(key), sub if isinstance(sub, dict) else {}, ctx) for key, sub in pairs
    )


def _table_column(key: str, schema: dict[str, Any], ctx: _Ctx) -> SurfaceNode:
    resolved = resolve_ref(schema, ctx.root)
    hint = _hint_for(schema, resolved)
    label = _label(resolved, hint.label, key)
    return SurfaceNode(
        path=f"{ctx.path}.{key}", label=label, strategy="scalar", value=label, intent=hint.role
    )


def _hint_for(schema: dict[str, Any], resolved: dict[str, Any]) -> MorpheHint:
    # A field's own x-morphe overrides the referenced target's (call site owns the register).
    return parse_hint(schema) if "x-morphe" in schema else parse_hint(resolved)


def _leaf(plan: _Plan, data: object, ctx: _Ctx) -> SurfaceNode:
    if plan.strategy == "linked-ref":
        href = data if isinstance(data, str) else None
        return SurfaceNode(
            path=ctx.path,
            label=plan.label,
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
    return SurfaceNode(
        path=ctx.path,
        label=plan.label,
        strategy=plan.strategy,
        value=_as_scalar(data),
        intent=plan.hint.role,
        diagnostics=plan.diags,
    )


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


def _as_scalar(data: object) -> str | int | float | bool | None:
    if isinstance(data, str | int | float | bool) or data is None:
        return data
    return str(data)

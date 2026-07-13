from __future__ import annotations

import json
import operator
import types
from functools import reduce
from typing import TYPE_CHECKING, Annotated, Literal, Protocol, Union, get_args, get_origin

from pydantic import BaseModel

from . import models
from .models import MODEL_TYPES

_NONE_TYPE = type(None)
_ALIAS_NAMES = {
    "ContainerRole",
    "Density",
    "EmphasisClaim",
    "GridColumn",
    "CoreIntent",
    "RegisterIntent",
    "IntentRef",
    "JsonValue",
    "LabelRelation",
    "IconA11y",
    "ControlLabel",
    "Node",
    "NumberValue",
    "ParamValue",
}

_LAYOUT_NODES = ("Stack", "Grid", "Cluster", "Frame", "Spacer")
_CONTENT_NODES = ("Text", "NumberNode", "Badge", "Icon", "Media")
_INPUT_NODES = ("Field", "Select", "Toggle", "Range")
_FEEDBACK_NODES = ("Progress", "Status", "InlineAlert")
_ACTION_NODES = ("Button", "Link")
_OVERLAY_NODES = ("Dialog", "Popover", "Disclosure")
_META_NODES = ("Slot", "ParamRef", "Vary", "Within")
INLINE_TYPE_WIDTH = 90
INLINE_DECLARATION_WIDTH = 100
VARIADIC_TUPLE_ARITY = 2

if TYPE_CHECKING:
    from collections.abc import Iterable


class TypeAliasLike(Protocol):
    __value__: object


def _alias_name(annotation: object) -> str | None:
    name = getattr(annotation, "__name__", None)
    if isinstance(name, str) and name in _ALIAS_NAMES:
        return name
    return None


def _unwrap_annotated(annotation: object) -> object:
    if get_origin(annotation) is Annotated:
        return get_args(annotation)[0]
    return annotation


def _split_optional(annotation: object) -> tuple[object, bool]:
    unwrapped = _unwrap_annotated(annotation)
    origin = get_origin(unwrapped)
    if origin not in {Union, types.UnionType}:
        return unwrapped, False
    args = get_args(unwrapped)
    if _NONE_TYPE not in args:
        return unwrapped, False
    remaining = tuple(arg for arg in args if arg is not _NONE_TYPE)
    if len(remaining) == 1:
        return _unwrap_annotated(remaining[0]), True
    return reduce(operator.or_, remaining), True


def _literal_values(annotation: object) -> tuple[object, ...] | None:
    if get_origin(annotation) is Literal:
        return get_args(annotation)
    return None


def _literal_union(values: Iterable[object], indent: str = "") -> str:
    rendered = [json.dumps(value, ensure_ascii=True) for value in values]
    if not rendered:
        return "never"
    joined = " | ".join(rendered)
    if len(joined) <= INLINE_TYPE_WIDTH:
        return joined
    return "\n".join(f"{indent}| {value}" for value in rendered)


def _ts_union(parts: Iterable[str], indent: str = "") -> str:
    rendered = tuple(parts)
    if not rendered:
        return "never"
    joined = " | ".join(rendered)
    if len(joined) <= INLINE_TYPE_WIDTH:
        return joined
    return "\n".join(f"{indent}| {value}" for value in rendered)


def _ts_type(annotation: object, *, indent: str = "\t\t") -> str:  # noqa: C901, PLR0911
    annotation = _unwrap_annotated(annotation)
    alias = _alias_name(annotation)
    if alias is not None:
        return alias
    if annotation is str:
        return "string"
    if annotation is int or annotation is float:
        return "number"
    if annotation is bool:
        return "boolean"
    if annotation is object:
        return "unknown"

    literal_values = _literal_values(annotation)
    if literal_values is not None:
        return _literal_union(literal_values, indent)

    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin in {Union, types.UnionType}:
        return _ts_union((_ts_type(arg, indent=indent) for arg in args), indent)
    if origin is tuple:
        if len(args) == VARIADIC_TUPLE_ARITY and args[1] is Ellipsis:
            return f"readonly {_ts_type(args[0], indent=indent)}[]"
        return f"readonly [{', '.join(_ts_type(arg, indent=indent) for arg in args)}]"
    if origin is list:
        return f"readonly {_ts_type(args[0], indent=indent)}[]"
    if origin is dict:
        return f"Readonly<Record<string, {_ts_type(args[1], indent=indent)}>>"
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation.__name__

    msg = f"unsupported annotation for TypeScript codegen: {annotation!r}"
    raise TypeError(msg)


def _interface_field(name: str, annotation: object, *, required: bool) -> str:
    field_type, is_optional = _split_optional(annotation)
    optional = "?" if is_optional or not required else ""
    ts_type = _ts_type(field_type)
    if "\n" in ts_type:
        return f"\treadonly {name}{optional}:\n{ts_type};"
    return f"\treadonly {name}{optional}: {ts_type};"


def _field_name(model_field_name: str, alias: str | None) -> str:
    return alias or model_field_name


def _interface_for_model(model_type: type[BaseModel]) -> str:
    lines = [f"export interface {model_type.__name__} {{"]
    for name, field in model_type.model_fields.items():
        lines.append(
            _interface_field(
                _field_name(name, field.alias),
                field.annotation,
                required=field.is_required(),
            ),
        )
    lines.append("}")
    return "\n".join(lines)


def _button_type() -> str:
    base_lines = ["interface ButtonBase {"]
    for name, field in models.Button.model_fields.items():
        if name in {"label", "a11y"}:
            continue
        base_lines.append(
            _interface_field(
                _field_name(name, field.alias),
                field.annotation,
                required=field.is_required(),
            ),
        )
    base_lines.append("}")
    return "\n".join(
        [
            *base_lines,
            "",
            "export type Button =",
            "\t| (ButtonBase & { readonly label: string; readonly a11y?: ControlLabel })",
            "\t| (ButtonBase & { readonly label?: undefined; readonly a11y: ControlLabel });",
        ],
    )


def _within_type() -> str:
    base_lines = ["interface WithinBase {"]
    for name, field in models.Within.model_fields.items():
        if name in {"dimension", "target", "summary"}:
            continue
        base_lines.append(
            _interface_field(
                _field_name(name, field.alias),
                field.annotation,
                required=field.is_required(),
            )
        )
    base_lines.append("}")
    return "\n".join(
        [
            *base_lines,
            "",
            "interface TargetlessWithin extends WithinBase {",
            '\treadonly dimension: "density" | "emphasis" | "collapse";',
            "\treadonly target?: undefined;",
            "\treadonly summary?: undefined;",
            "}",
            "",
            "interface TargetedContextWithin extends WithinBase {",
            '\treadonly dimension: "density" | "emphasis";',
            "\treadonly target: Node;",
            "\treadonly summary?: undefined;",
            "}",
            "",
            "interface TargetedCollapseWithin extends WithinBase {",
            '\treadonly dimension: "collapse";',
            "\treadonly target: Node;",
            "\treadonly summary: string;",
            "}",
            "",
            (
                "export type Within = TargetlessWithin | TargetedContextWithin | "
                "TargetedCollapseWithin;"
            ),
        ],
    )


def _node_names() -> tuple[str, ...]:
    annotated = models.Node.__value__
    union_type = get_args(annotated)[0]
    return tuple(arg.__name__ for arg in get_args(union_type))


def _model_blocks() -> list[str]:
    blocks: list[str] = []
    for model_type in MODEL_TYPES:
        if model_type is models.Button:
            blocks.append(_button_type())
        elif model_type is models.Within:
            blocks.append(_within_type())
        else:
            blocks.append(_interface_for_model(model_type))
    return blocks


def _type_union(name: str, members: tuple[str, ...]) -> str:
    inline = " | ".join(members)
    if len(f"export type {name} = {inline};") <= INLINE_DECLARATION_WIDTH:
        return f"export type {name} = {inline};"
    lines = [f"export type {name} ="]
    for index, member in enumerate(members):
        suffix = ";" if index == len(members) - 1 else ""
        lines.append(f"\t| {member}{suffix}")
    return "\n".join(lines)


def _literal_alias(name: str, alias: TypeAliasLike) -> str:
    values = get_args(alias.__value__)
    inline = " | ".join(json.dumps(value) for value in values)
    if len(f"export type {name} = {inline};") <= INLINE_DECLARATION_WIDTH:
        return f"export type {name} = {inline};"
    lines = [f"export type {name} ="]
    for index, value in enumerate(values):
        suffix = ";" if index == len(values) - 1 else ""
        lines.append(f"\t| {json.dumps(value)}{suffix}")
    return "\n".join(lines)


def typescript_document() -> str:
    blocks = [
        (
            "/**\n"
            " * @generated by `python -m morphe_grammar.artifacts --write`.\n"
            " * Source of truth: `py/morphe_grammar/models.py`.\n"
            " */"
        ),
        "export type NumberValue = number;",
        (
            "export type JsonValue =\n"
            "\t| null\n"
            "\t| boolean\n"
            "\t| NumberValue\n"
            "\t| string\n"
            "\t| readonly JsonValue[]\n"
            "\t| { readonly [key: string]: JsonValue };"
        ),
        _literal_alias("ContainerRole", models.ContainerRole),
        _literal_alias("Density", models.Density),
        _literal_alias("EmphasisClaim", models.EmphasisClaim),
        _literal_alias("GridColumn", models.GridColumn),
        _literal_alias("CoreIntent", models.CoreIntent),
        _literal_alias("RegisterIntent", models.RegisterIntent),
        "export type IntentRef = CoreIntent | RegisterIntent;",
        "export type VaryId = string & { readonly __morpheVaryId?: never };",
        "export type ParamValue = JsonValue | Node;",
        *_model_blocks(),
        _type_union(
            "LabelRelation", ("VisibleLabelRelation", "AriaLabelRelation", "LabelledByRelation")
        ),
        _type_union("IconA11y", ("DecorativeIconA11y", "ImageIconA11y")),
        _type_union("ControlLabel", ("AriaControlLabel", "LabelledByControlLabel")),
        _type_union("LayoutNode", _LAYOUT_NODES),
        _type_union("ContentNode", _CONTENT_NODES),
        _type_union("InputNode", _INPUT_NODES),
        _type_union("FeedbackNode", _FEEDBACK_NODES),
        _type_union("ActionNode", _ACTION_NODES),
        _type_union("OverlayNode", _OVERLAY_NODES),
        _type_union("MetaNode", _META_NODES),
        _type_union("Node", _node_names()),
        'export type NodeKind = Node["kind"];',
        (
            "export function assertNever(value: never): never {\n"
            "\tthrow new Error(`Unhandled Node kind: ${JSON.stringify(value)}`);\n"
            "}"
        ),
    ]
    return "\n\n".join(blocks) + "\n"

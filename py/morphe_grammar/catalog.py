from __future__ import annotations

import json
import re
from types import MappingProxyType
from typing import Literal, cast

from pydantic import StrictBool, StrictStr  # noqa: TC002 - evaluated by Pydantic at runtime

from .models import GrammarModel, Node, ParamValue, validate_node
from .version import GRAMMAR_VERSION

type CompoundParamType = Literal["string", "number", "boolean", "node", "node-list"]
type CompoundLifecycle = Literal["candidate", "promoted"]
type TypeScriptValue = (
    None | bool | int | float | str | list[TypeScriptValue] | dict[str, TypeScriptValue]
)

_TYPESCRIPT_IDENTIFIER = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")
_TYPESCRIPT_LINE_WIDTH = 100


class CompoundParam(GrammarModel):
    type: CompoundParamType
    required: StrictBool = False
    default: ParamValue | None = None
    description: StrictStr | None = None


class CompoundParams(GrammarModel):
    type: Literal["object"] = "object"
    properties: dict[str, CompoundParam]


class CompoundDefinition(GrammarModel):
    name: StrictStr
    version: StrictStr
    grammar_version: StrictStr
    lifecycle: CompoundLifecycle = "promoted"
    params: CompoundParams
    template: Node


SIGNAL_CARD = CompoundDefinition.model_validate(
    {
        "name": "SignalCard",
        "version": "1.0.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            "properties": {
                "kicker": {
                    "type": "node",
                    "required": True,
                    "description": "Small register heading for the card.",
                },
                "title": {
                    "type": "node",
                    "required": True,
                    "description": "Card title as an authored node.",
                },
                "measure": {
                    "type": "node",
                    "default": {
                        "kind": "number",
                        "value": 0,
                        "format": "integer",
                        "intent": "neutral",
                    },
                    "description": "A numeric or textual measure node.",
                },
            },
        },
        "template": {
            "kind": "frame",
            "role": "panel",
            "surface": "raised",
            "children": [
                {
                    "kind": "stack",
                    "role": "panel",
                    "children": [
                        {
                            "kind": "cluster",
                            "role": "toolbar",
                            "justify": "between",
                            "align": "center",
                            "children": [
                                {"kind": "param-ref", "param": "kicker"},
                                {
                                    "kind": "status",
                                    "tone": "success",
                                    "signal": {"text": "Ready", "icon": "check_circle"},
                                },
                            ],
                        },
                        {"kind": "param-ref", "param": "title"},
                        {"kind": "param-ref", "param": "measure"},
                        {
                            "kind": "slot",
                            "name": "body",
                            "fallback": [
                                {
                                    "kind": "text",
                                    "value": "No body supplied.",
                                    "as": "caption",
                                }
                            ],
                        },
                    ],
                }
            ],
        },
    }
)

PROMOTED_COMPOUNDS = MappingProxyType({SIGNAL_CARD.name: SIGNAL_CARD})


def promoted_compound(name: str) -> CompoundDefinition:
    try:
        return PROMOTED_COMPOUNDS[name]
    except KeyError as exc:
        msg = f"unknown promoted compound: {name}"
        raise ValueError(msg) from exc


def compound_slot_names(definition: CompoundDefinition) -> tuple[str, ...]:
    names: set[str] = set()
    payload = definition.template.model_dump(mode="json", by_alias=True, exclude_none=True)

    def walk(value: object) -> None:
        if isinstance(value, dict):
            mapping = cast("dict[str, object]", value)
            name = mapping.get("name")
            if mapping.get("kind") == "slot" and isinstance(name, str):
                names.add(name)
            for child in mapping.values():
                walk(child)
        elif isinstance(value, list | tuple):
            for child in value:
                walk(child)

    walk(payload)
    return tuple(sorted(names))


def validate_catalog() -> None:
    for name, definition in PROMOTED_COMPOUNDS.items():
        if name != definition.name:
            msg = f"compound catalog key {name!r} does not match {definition.name!r}"
            raise ValueError(msg)
        if definition.lifecycle != "promoted":
            msg = f"built-in compound {name!r} must be promoted"
            raise ValueError(msg)
        validate_node(definition.template)


def _typescript_definition(definition: CompoundDefinition) -> dict[str, object]:
    document = definition.model_dump(
        mode="json",
        by_alias=True,
        exclude_none=True,
        exclude={"lifecycle", "grammar_version"},
    )
    document["grammarVersion"] = definition.grammar_version
    return document


def _typescript_key(key: str) -> str:
    return key if _TYPESCRIPT_IDENTIFIER.fullmatch(key) else json.dumps(key, ensure_ascii=True)


def typescript_data_literal(value: TypeScriptValue, *, depth: int = 0) -> str:
    indent = "\t" * depth
    child_indent = "\t" * (depth + 1)
    if value is None:
        rendered = "null"
    elif isinstance(value, bool):
        rendered = "true" if value else "false"
    elif isinstance(value, int | float | str):
        rendered = json.dumps(value, ensure_ascii=True)
    elif isinstance(value, list):
        if not value:
            return "[]"
        if all(not isinstance(item, dict | list) for item in value):
            inline = f"[{', '.join(typescript_data_literal(item) for item in value)}]"
            if len(child_indent) + len(inline) <= _TYPESCRIPT_LINE_WIDTH:
                return inline
        lines = ["["]
        lines.extend(
            f"{child_indent}{typescript_data_literal(item, depth=depth + 1)}," for item in value
        )
        lines.append(f"{indent}]")
        return "\n".join(lines)
    else:
        if not value:
            return "{}"
        lines = ["{"]
        lines.extend(
            (
                f"{child_indent}{_typescript_key(key)}: "
                f"{typescript_data_literal(item, depth=depth + 1)},"
            )
            for key, item in value.items()
        )
        lines.append(f"{indent}}}")
        return "\n".join(lines)
    return rendered


def catalog_typescript_document() -> str:
    validate_catalog()
    definitions = [_typescript_definition(definition) for definition in PROMOTED_COMPOUNDS.values()]
    encoded = typescript_data_literal(cast("TypeScriptValue", definitions))
    return (
        "/**\n"
        " * @generated by `python -m morphe_grammar.artifacts --write`.\n"
        " * Source of truth: `py/morphe_grammar/catalog.py`.\n"
        " */\n"
        'import type { CompoundDef } from "./factory.js";\n\n'
        f"export const PROMOTED_COMPOUNDS = {encoded} as const satisfies readonly CompoundDef[];\n"
    )


validate_catalog()


__all__ = [
    "PROMOTED_COMPOUNDS",
    "SIGNAL_CARD",
    "CompoundDefinition",
    "CompoundLifecycle",
    "CompoundParam",
    "CompoundParamType",
    "CompoundParams",
    "catalog_typescript_document",
    "compound_slot_names",
    "promoted_compound",
    "typescript_data_literal",
    "validate_catalog",
]

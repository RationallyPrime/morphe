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
# Biome counts a tab as its indent width (2) toward lineWidth; mirror that here.
_TYPESCRIPT_TAB_WIDTH = 2


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
        "version": "2.0.0",
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
                # 2.0.0: no default. An omitted measure falls to the factory's
                # empty-text node, which renders display:none — a card without a
                # measure asserts NOTHING, never a factual zero (KRA-788 repair a).
                "measure": {
                    "type": "node",
                    "description": "A numeric or textual measure node.",
                },
            },
        },
        # 2.0.0: the raised Frame is gone — framing is COMPOSITION, not signal
        # identity (KRA-788 repair c). A call site that genuinely needs a card
        # wraps the compound in a Frame at the authored-tree level; a metric band
        # composes cards into one calm region instead of a wall of raised boxes.
        "template": {
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
                        # The corner signal is a SLOT (a Status/Badge the call
                        # site owns), not a hardcoded "Ready" — a KPI card must
                        # not certify readiness it knows nothing about. The
                        # factory can't parameterise Status.signal.text (string
                        # fields never interpolate), so a slot is the only
                        # grammar-lawful variability here.
                        {"kind": "slot", "name": "signal", "fallback": []},
                    ],
                },
                {"kind": "param-ref", "param": "title"},
                {"kind": "param-ref", "param": "measure"},
                # 2.0.0: an unfilled body renders nothing. The old visible
                # "No body supplied." fallback was compiler copy leaking into
                # the product (KRA-788 repair b).
                {"kind": "slot", "name": "body", "fallback": []},
            ],
        },
    }
)

ENTITY_HEADER = CompoundDefinition.model_validate(
    {
        "name": "EntityHeader",
        "version": "2.0.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            "properties": {
                "kicker": {
                    "type": "node",
                    "required": True,
                    "description": (
                        "Contextual entity or organization identity beneath the task heading."
                    ),
                },
                "title": {
                    "type": "node",
                    "required": True,
                    "description": "The operational task heading for this entity surface.",
                },
                # 1.1.0: no default. An omitted keyFigure falls to the factory's
                # empty-text node (display:none) — a header without a figure
                # asserts nothing, never a factual zero (KRA-788 repair a).
                "keyFigure": {
                    "type": "node",
                    "description": "The one number this entity leads with.",
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
                        # 2.0.0: the task title comes first in document order. The
                        # contextual entity identity rides ``kicker`` below it, so
                        # neither a metric label nor organization name can precede
                        # the pane's logical h1 (KRA-798).
                        {"kind": "param-ref", "param": "title"},
                        {
                            "kind": "cluster",
                            "role": "toolbar",
                            "justify": "between",
                            "align": "center",
                            "children": [
                                {"kind": "param-ref", "param": "kicker"},
                                # The lede's corner is a SLOT (a Status/Badge the call site
                                # owns): the factory can't parameterise Status.signal.text or
                                # Badge.label (string fields never interpolate), so the one
                                # grammar-lawful way to carry a caller-owned signal is a slot.
                                {"kind": "slot", "name": "signal", "fallback": []},
                            ],
                        },
                        {
                            "kind": "cluster",
                            "role": "inline",
                            "align": "baseline",
                            "children": [
                                {"kind": "param-ref", "param": "keyFigure"},
                                {"kind": "slot", "name": "meta", "fallback": []},
                            ],
                        },
                        # Identifiers / footer: provenance-register nodes the call site owns.
                        {"kind": "slot", "name": "provenance", "fallback": []},
                    ],
                }
            ],
        },
    }
)


PROVENANCE_FOOTER = CompoundDefinition.model_validate(
    {
        "name": "ProvenanceFooter",
        "version": "1.0.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            "properties": {
                "heading": {
                    "type": "node",
                    # Optional and silent by default. Callers that need a visible
                    # provenance-region heading author the node; the native
                    # disclosure summary remains its accessible control label.
                    "default": {"kind": "text", "value": "", "as": "caption"},
                    "description": "Optional authored heading inside the audit disclosure.",
                }
            },
        },
        # Audit proof is structurally present but leaves the primary scan path:
        # one native disclosure, no Frame reset, and three caller-owned lanes.
        # The fixed summary is intentional — Disclosure.summary is a raw string
        # field and therefore cannot lawfully be parameterized by the compound
        # factory. Signed values stay in node-valued slots (D8).
        "template": {
            "kind": "disclosure",
            "summary": "Audit proof",
            "children": [
                {"kind": "param-ref", "param": "heading"},
                {
                    "kind": "stack",
                    "role": "field-group",
                    "children": [
                        {"kind": "slot", "name": "facts", "fallback": []},
                        {"kind": "slot", "name": "seals", "fallback": []},
                        {"kind": "slot", "name": "links", "fallback": []},
                    ],
                },
            ],
        },
    }
)


STAT_BAND = CompoundDefinition.model_validate(
    {
        "name": "StatBand",
        "version": "1.0.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            # The band owns the layout — the auto-fit narrow-track grid that wraps its
            # tiles — so it carries no params. Everything variable is the SignalCard
            # tiles that ride the single `tiles` slot.
            "properties": {},
        },
        "template": {
            # The KPI band's grid, lifted from the kpi-row emitter into the catalog: an
            # auto-fit narrow-track grid (no `columns`, so it wraps) whose children ARE
            # the slot fill. The factory splices slot nodes inline, so the tiles become
            # the grid's direct children.
            "kind": "grid",
            "role": "list",
            "minTrack": "narrow",
            "children": [{"kind": "slot", "name": "tiles", "fallback": []}],
        },
    }
)

BREAKDOWN = CompoundDefinition.model_validate(
    {
        "name": "Breakdown",
        "version": "1.0.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "node",
                    # Optional lede. The empty-text default renders display:none, so a
                    # call site that omits the title leaves no stray node behind.
                    "default": {"kind": "text", "value": "", "as": "caption"},
                    "description": "Optional heading for the proportion breakdown.",
                },
            },
        },
        "template": {
            "kind": "stack",
            "role": "panel",
            "children": [
                {"kind": "param-ref", "param": "title"},
                # The proportion rows the call site builds — each a label + progress +
                # value cluster — ride this slot; the factory splices them inline.
                {
                    "kind": "stack",
                    "role": "list",
                    "children": [{"kind": "slot", "name": "rows", "fallback": []}],
                },
            ],
        },
    }
)

TRAIL_ENTRY = CompoundDefinition.model_validate(
    {
        "name": "TrailEntry",
        "version": "1.1.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            "properties": {
                "stamp": {
                    "type": "node",
                    # Optional temporal marker. The empty-text default renders
                    # display:none, so an entry with no temporal child leaves no gap.
                    "default": {"kind": "text", "value": "", "as": "caption"},
                    "description": "Optional temporal stamp for the event.",
                },
                "summary": {
                    "type": "node",
                    "required": True,
                    "description": "The event's primary line at body register.",
                },
            },
        },
        "template": {
            "kind": "stack",
            "role": "panel",
            "children": [
                {
                    "kind": "cluster",
                    "role": "inline",
                    "align": "baseline",
                    "children": [
                        {"kind": "param-ref", "param": "stamp"},
                        {"kind": "param-ref", "param": "summary"},
                        # 1.1.0: state chips (Status/Badge) ride the event line —
                        # the arm that gave every event field a home (KRA-788 D3:
                        # zygos rejected `trail` because valid fields classified
                        # into no arm and disappeared).
                        {"kind": "slot", "name": "signals", "fallback": []},
                    ],
                },
                # 1.1.0: everything the event carries beyond its line — amounts,
                # facts, secondary values — at body register, never dropped.
                {"kind": "slot", "name": "detail", "fallback": []},
                # Relations the entry points to (linked-ref children the call site owns).
                {"kind": "slot", "name": "ref", "fallback": []},
                # Identifiers / provenance footer — the one place an id exists.
                {"kind": "slot", "name": "provenance", "fallback": []},
            ],
        },
    }
)

KEY_VALUE_PANEL = CompoundDefinition.model_validate(
    {
        "name": "KeyValuePanel",
        "version": "1.0.0",
        "grammar_version": GRAMMAR_VERSION,
        "lifecycle": "promoted",
        "params": {
            "type": "object",
            # The panel is pure tiering — all variability is the three tiers of field
            # rows the call site builds, so it carries no params.
            "properties": {},
        },
        "template": {
            "kind": "stack",
            "role": "panel",
            "children": [
                # Emphasised fields (value strong, body register).
                {"kind": "slot", "name": "primary", "fallback": []},
                # The rest, at the lighter caption tier.
                {"kind": "slot", "name": "secondary", "fallback": []},
                # Identifiers / provenance footer.
                {"kind": "slot", "name": "provenance", "fallback": []},
            ],
        },
    }
)

PROMOTED_COMPOUNDS = MappingProxyType(
    {
        SIGNAL_CARD.name: SIGNAL_CARD,
        ENTITY_HEADER.name: ENTITY_HEADER,
        PROVENANCE_FOOTER.name: PROVENANCE_FOOTER,
        STAT_BAND.name: STAT_BAND,
        BREAKDOWN.name: BREAKDOWN,
        TRAIL_ENTRY.name: TRAIL_ENTRY,
        KEY_VALUE_PANEL.name: KEY_VALUE_PANEL,
    }
)


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


def _entry_prefix_width(depth: int, key: str) -> int:
    # Expanded indent + "key: " + the trailing comma the parent appends.
    return (depth + 1) * _TYPESCRIPT_TAB_WIDTH + len(_typescript_key(key)) + 3


def _typescript_list_literal(
    value: list[TypeScriptValue],
    *,
    depth: int,
    prefix_width: int | None,
) -> str:
    if not value:
        return "[]"
    if all(not isinstance(item, dict | list) for item in value):
        inline = f"[{', '.join(typescript_data_literal(item) for item in value)}]"
        occupied = (
            prefix_width if prefix_width is not None else (depth + 1) * _TYPESCRIPT_TAB_WIDTH + 1
        )
        if occupied + len(inline) <= _TYPESCRIPT_LINE_WIDTH:
            return inline
    child_indent = "\t" * (depth + 1)
    item_prefix = (depth + 1) * _TYPESCRIPT_TAB_WIDTH + 1
    lines = ["["]
    for item in value:
        encoded = typescript_data_literal(item, depth=depth + 1, prefix_width=item_prefix)
        lines.append(f"{child_indent}{encoded},")
    lines.append("\t" * depth + "]")
    return "\n".join(lines)


def typescript_data_literal(
    value: TypeScriptValue,
    *,
    depth: int = 0,
    prefix_width: int | None = None,
) -> str:
    # ``prefix_width`` is everything already on the emitted line besides this literal:
    # expanded indent, any ``key: `` prefix, and the trailing comma. Biome inlines an
    # array only when the whole line fits ``lineWidth`` (a tab counting as its indent
    # width), so the fit check must measure the same line the formatter measures.
    indent = "\t" * depth
    child_indent = "\t" * (depth + 1)
    if value is None:
        rendered = "null"
    elif isinstance(value, bool):
        rendered = "true" if value else "false"
    elif isinstance(value, int | float | str):
        rendered = json.dumps(value, ensure_ascii=True)
    elif isinstance(value, list):
        return _typescript_list_literal(value, depth=depth, prefix_width=prefix_width)
    else:
        if not value:
            return "{}"
        lines = ["{"]
        for key, item in value.items():
            encoded = typescript_data_literal(
                item,
                depth=depth + 1,
                prefix_width=_entry_prefix_width(depth, key),
            )
            lines.append(f"{child_indent}{_typescript_key(key)}: {encoded},")
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
    "BREAKDOWN",
    "ENTITY_HEADER",
    "KEY_VALUE_PANEL",
    "PROMOTED_COMPOUNDS",
    "PROVENANCE_FOOTER",
    "SIGNAL_CARD",
    "STAT_BAND",
    "TRAIL_ENTRY",
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

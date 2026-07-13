from __future__ import annotations

import json
import re
from copy import deepcopy
from hashlib import sha256
from hmac import compare_digest
from importlib.resources import files
from typing import cast

from pydantic import BaseModel

from .catalog import CompoundDefinition, CompoundParam, compound_slot_names, promoted_compound
from .dialects import (
    DIALECT_CONSTRAINTS,
    DIALECT_IDS,
    DialectCompoundConstraint,
    DialectId,
    dialect_constraint,
)
from .schema import JsonSchema, JsonSchemaValue, schema_document
from .version import GRAMMAR_VERSION

ROOT_MASK_DIRECTORY = "schema/masks/dialects"
PACKAGE_MASK_DIRECTORY = "py/morphe_grammar/schemas/masks/dialects"
ROOT_MASK_MANIFEST_PATH = "schema/masks/manifest.json"
PACKAGE_MASK_MANIFEST_PATH = "py/morphe_grammar/schemas/masks/manifest.json"


def dialect_mask_filename(dialect_id: DialectId) -> str:
    return f"morphe-node.{dialect_id}.schema.json"


def dialect_mask_path(dialect_id: DialectId) -> str:
    return f"{ROOT_MASK_DIRECTORY}/{dialect_mask_filename(dialect_id)}"


def package_dialect_mask_path(dialect_id: DialectId) -> str:
    return f"{PACKAGE_MASK_DIRECTORY}/{dialect_mask_filename(dialect_id)}"


DIALECT_MASK_PATHS: tuple[str, ...] = tuple(dialect_mask_path(item) for item in DIALECT_IDS)
PACKAGE_DIALECT_MASK_PATHS: tuple[str, ...] = tuple(
    package_dialect_mask_path(item) for item in DIALECT_IDS
)


def _schema_object(value: JsonSchemaValue | None, label: str) -> JsonSchema:
    if not isinstance(value, dict):
        msg = f"expected JSON Schema object at {label}"
        raise TypeError(msg)
    return value


def _json_value(value: object) -> JsonSchemaValue:
    if isinstance(value, BaseModel):
        return cast(
            "JsonSchemaValue",
            value.model_dump(mode="json", by_alias=True, exclude_none=True),
        )
    return cast("JsonSchemaValue", value)


def _parameter_schema(parameter: CompoundParam) -> JsonSchema:
    document: dict[str, object] = {}
    match parameter.type:
        case "string":
            document["type"] = "string"
        case "number":
            document["type"] = "number"
        case "boolean":
            document["type"] = "boolean"
        case "node":
            document["$ref"] = "#/$defs/Node"
        case "node-list":
            document["type"] = "array"
            document["items"] = {"$ref": "#/$defs/Node"}
    if parameter.description is not None:
        document["description"] = parameter.description
    if parameter.default is not None:
        document["default"] = _json_value(parameter.default)
    return cast("JsonSchema", document)


def _definition_key(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_]", "_", name)
    return f"CompoundRef_{safe}"


def _specialized_compound_schema(
    definition: CompoundDefinition,
    generic_properties: JsonSchema,
) -> JsonSchema:
    args_properties = {
        name: _parameter_schema(parameter)
        for name, parameter in definition.params.properties.items()
    }
    required_args = [
        name for name, parameter in definition.params.properties.items() if parameter.required
    ]
    args_schema_data: dict[str, object] = {
        "additionalProperties": False,
        "properties": args_properties,
        "type": "object",
    }
    if required_args:
        args_schema_data["required"] = required_args
    args_schema = cast("JsonSchema", args_schema_data)

    properties: JsonSchema = {
        "args": args_schema,
        "kind": deepcopy(_schema_object(generic_properties.get("kind"), "CompoundRef.kind")),
        "name": {"const": definition.name, "type": "string"},
    }
    emphasis = generic_properties.get("emphasis")
    if isinstance(emphasis, dict):
        properties["emphasis"] = deepcopy(emphasis)

    slots = compound_slot_names(definition)
    if slots:
        properties["slots"] = {
            "additionalProperties": False,
            "properties": {
                name: {"items": {"$ref": "#/$defs/Node"}, "type": "array"} for name in slots
            },
            "type": "object",
        }

    return {
        "additionalProperties": False,
        "properties": properties,
        "required": ["kind", "name", "args"],
        "title": definition.name,
        "type": "object",
    }


def _apply_allowlist(document: JsonSchema, constraint: DialectCompoundConstraint) -> None:
    definitions = _schema_object(document.get("$defs"), "$defs")
    generic = _schema_object(definitions.get("CompoundRef"), "$defs.CompoundRef")
    generic_properties = _schema_object(generic.get("properties"), "$defs.CompoundRef.properties")

    references: list[JsonSchemaValue] = []
    for compound_name in constraint.compounds:
        definition = promoted_compound(compound_name)
        key = _definition_key(compound_name)
        definitions[key] = _specialized_compound_schema(definition, generic_properties)
        references.append({"$ref": f"#/$defs/{key}"})

    definitions["CompoundRef"] = {
        "oneOf": references,
        "title": f"{constraint.id} CompoundRef",
    }


def dialect_mask_document(dialect_id: str) -> JsonSchema:
    constraint = dialect_constraint(dialect_id)
    document = deepcopy(schema_document())
    document["$id"] = f"urn:morphe:grammar:node:dialect:{constraint.id}"
    document["title"] = f"Morphe Node Decoder Mask — {constraint.id}"
    document["x-morphe-dialect"] = constraint.id
    document["x-morphe-compound-policy"] = {
        "mode": constraint.mode,
        "compounds": list(constraint.compounds),
    }
    if constraint.mode == "allowlist":
        _apply_allowlist(document, constraint)
    return document


def dialect_mask_documents() -> dict[DialectId, JsonSchema]:
    return {dialect_id: dialect_mask_document(dialect_id) for dialect_id in DIALECT_IDS}


def dialect_mask_text(dialect_id: str) -> str:
    return (
        json.dumps(
            dialect_mask_document(dialect_id),
            ensure_ascii=True,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )


def mask_manifest_document() -> JsonSchema:
    return {
        "format_version": 1,
        "grammar_version": GRAMMAR_VERSION,
        "dialects": {
            dialect_id: {
                "compound_policy": {
                    "mode": constraint.mode,
                    "compounds": list(constraint.compounds),
                },
                "schema": f"dialects/{dialect_mask_filename(dialect_id)}",
                "sha256": sha256(dialect_mask_text(dialect_id).encode()).hexdigest(),
            }
            for dialect_id, constraint in DIALECT_CONSTRAINTS.items()
        },
    }


def load_mask_manifest() -> JsonSchema:
    resource = files("morphe_grammar").joinpath("schemas/masks/manifest.json")
    decoded = json.loads(resource.read_text(encoding="utf-8"))
    if not isinstance(decoded, dict):
        msg = "installed Morphe decoder-mask manifest must be a JSON object"
        raise TypeError(msg)
    manifest = cast("JsonSchema", decoded)
    format_version = manifest.get("format_version")
    if format_version != 1:
        msg = (
            "installed decoder-mask manifest format version mismatch: "
            f"expected 1, received {format_version!r}"
        )
        raise ValueError(msg)
    grammar_version = manifest.get("grammar_version")
    if grammar_version != GRAMMAR_VERSION:
        msg = (
            "installed decoder-mask manifest grammar version mismatch: "
            f"expected {GRAMMAR_VERSION!r}, received {grammar_version!r}"
        )
        raise ValueError(msg)
    return manifest


def load_dialect_mask(dialect_id: str) -> JsonSchema:
    constraint = dialect_constraint(dialect_id)
    manifest = load_mask_manifest()
    dialects = _schema_object(manifest.get("dialects"), "manifest.dialects")
    entry = _schema_object(dialects.get(constraint.id), f"manifest.dialects.{constraint.id}")
    relative_path = entry.get("schema")
    if not isinstance(relative_path, str):
        msg = f"decoder-mask manifest entry for {constraint.id!r} has no schema path"
        raise TypeError(msg)
    expected_digest = entry.get("sha256")
    if not isinstance(expected_digest, str):
        msg = f"decoder-mask manifest entry for {constraint.id!r} has no SHA-256"
        raise TypeError(msg)
    resource = files("morphe_grammar").joinpath("schemas/masks", *relative_path.split("/"))
    payload = resource.read_bytes()
    actual_digest = sha256(payload).hexdigest()
    if not compare_digest(actual_digest, expected_digest):
        msg = f"installed decoder mask for {constraint.id!r} failed SHA-256 verification"
        raise ValueError(msg)
    decoded = json.loads(payload)
    if not isinstance(decoded, dict):
        msg = f"installed decoder mask for {constraint.id!r} must be a JSON object"
        raise TypeError(msg)
    return cast("JsonSchema", decoded)


__all__ = [
    "DIALECT_MASK_PATHS",
    "PACKAGE_DIALECT_MASK_PATHS",
    "PACKAGE_MASK_DIRECTORY",
    "PACKAGE_MASK_MANIFEST_PATH",
    "ROOT_MASK_DIRECTORY",
    "ROOT_MASK_MANIFEST_PATH",
    "dialect_mask_document",
    "dialect_mask_documents",
    "dialect_mask_filename",
    "dialect_mask_path",
    "dialect_mask_text",
    "load_dialect_mask",
    "load_mask_manifest",
    "mask_manifest_document",
    "package_dialect_mask_path",
]

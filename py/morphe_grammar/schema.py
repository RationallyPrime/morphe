from __future__ import annotations

import json
import sys
from typing import cast

from .models import NODE_ADAPTER

type JsonSchemaValue = (
    None | bool | int | float | str | list[JsonSchemaValue] | dict[str, JsonSchemaValue]
)
type JsonSchema = dict[str, JsonSchemaValue]


def _drop_null_from_optional(schema: JsonSchema) -> JsonSchema:
    if schema.get("default") is not None:
        return schema
    any_of = schema.get("anyOf")
    if not isinstance(any_of, list):
        return schema
    non_null_options = [
        option
        for option in any_of
        if not (isinstance(option, dict) and option.get("type") == "null")
    ]
    if len(non_null_options) != 1 or len(non_null_options) == len(any_of):
        return schema
    replacement = non_null_options[0]
    if not isinstance(replacement, dict):
        return schema
    for key, value in schema.items():
        if key not in {"anyOf", "default"}:
            replacement.setdefault(key, value)
    return replacement


def normalize_schema(value: JsonSchemaValue) -> JsonSchemaValue:
    if isinstance(value, list):
        return [normalize_schema(item) for item in value]
    if not isinstance(value, dict):
        return value

    normalized: JsonSchema = {}
    for key, item in value.items():
        if key == "default" and item is None:
            continue
        normalized[key] = normalize_schema(item)
    return _drop_null_from_optional(normalized)


def schema_document() -> JsonSchema:
    raw_schema = cast(
        "JsonSchema",
        NODE_ADAPTER.json_schema(ref_template="#/$defs/{model}", union_format="any_of"),
    )
    normalized = cast("JsonSchema", normalize_schema(raw_schema))
    defs = normalized.get("$defs")
    ref = normalized.get("$ref")
    if ref == "#/$defs/Node" and isinstance(defs, dict):
        node_def = defs.get("Node")
        if isinstance(node_def, dict):
            normalized = dict(node_def)
            normalized["$defs"] = defs
    normalized["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    normalized["title"] = "Morphe Grammar Node"
    return normalized


def main() -> None:
    sys.stdout.write(json.dumps(schema_document(), ensure_ascii=True, indent=2, sort_keys=True))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()

from __future__ import annotations

from typing import Any


def resolve_ref(schema: dict[str, Any], root: dict[str, Any]) -> dict[str, Any]:
    """Resolve a local ``#/...`` JSON Pointer ``$ref`` against ``root`` (else unchanged)."""
    ref = schema.get("$ref")
    if not isinstance(ref, str) or not ref.startswith("#/"):
        return schema
    node: Any = root
    for part in ref[2:].split("/"):
        if not isinstance(node, dict) or part not in node:
            return schema
        node = node[part]
    return node if isinstance(node, dict) else schema


def schema_type(schema: dict[str, Any]) -> str | None:
    """Best-effort JSON Schema type tag: explicit `type`, else `enum`/`object` shape."""
    t = schema.get("type")
    if isinstance(t, str):
        return t
    if "enum" in schema:
        return "enum"
    if "properties" in schema:
        return "object"
    return None

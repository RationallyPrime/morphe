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


def unwrap_nullable(schema: dict[str, Any], root: dict[str, Any]) -> dict[str, Any]:
    """Strip the Pydantic optional wrapper: ``anyOf [X, null]`` reads as ``X``.

    ``X | None`` is by far the most common union a model emits, and without this
    the structural floor classified every optional field as unrenderable — a
    nullable count degraded to a diagnostic-node instead of a scalar (found by
    the Apotheke surface upgrade). Only the single-non-null shape unwraps; a
    genuine multi-branch union still has no structural rendering and keeps the
    diagnostic degrade. Titles/hints stay with the FIELD schema (callers read
    them off the raw schema, never the unwrapped branch).
    """
    options = schema.get("anyOf")
    if not isinstance(options, list):
        return schema
    branches = [option for option in options if isinstance(option, dict)]
    if len(branches) != len(options):
        return schema
    non_null = [option for option in branches if option.get("type") != "null"]
    has_null_branch = len(non_null) < len(branches)
    if len(non_null) != 1 or not has_null_branch:
        return schema
    return resolve_ref(non_null[0], root)

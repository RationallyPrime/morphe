from __future__ import annotations

from typing import Any

from morphe_grammar.catalog import CompoundDefinition, compound_slot_names


def _parameter_value(parameter_type: str, label: str) -> object:
    if parameter_type == "node":
        return {"kind": "text", "value": label, "as": "body"}
    if parameter_type == "node-list":
        return [{"kind": "text", "value": label, "as": "body"}]
    if parameter_type == "string":
        return label
    if parameter_type == "number":
        return 1
    if parameter_type == "boolean":
        return True
    msg = f"unsupported compound parameter type: {parameter_type}"
    raise AssertionError(msg)


def full_compound_reference(definition: CompoundDefinition) -> dict[str, Any]:
    """Build a contract-complete reference for CMS and dialect gate proofs."""
    args = {
        name: _parameter_value(parameter.type, f"{definition.name}.{name}")
        for name, parameter in definition.params.properties.items()
    }
    slots = {
        name: [{"kind": "text", "value": f"{definition.name}.{name}", "as": "body"}]
        for name in compound_slot_names(definition)
    }
    return {
        "kind": "compound",
        "name": definition.name,
        "args": args,
        "slots": slots,
    }

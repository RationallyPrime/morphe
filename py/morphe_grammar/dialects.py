from __future__ import annotations

from types import MappingProxyType
from typing import Literal, Self, cast

from pydantic import StrictStr, model_validator

from .catalog import (
    PROMOTED_COMPOUNDS,
    CompoundDefinition,
    CompoundParam,
    TypeScriptValue,
    compound_slot_names,
    promoted_compound,
    typescript_data_literal,
)
from .models import (
    Cluster,
    CompoundRef,
    Dialog,
    Disclosure,
    Frame,
    GrammarModel,
    Grid,
    Node,
    Popover,
    Slot,
    Stack,
    Table,
    Vary,
    Within,
    validate_node,
)

type DialectId = Literal[
    "icelandic-archive",
    "clinical",
    "reykjavik-registry",
    "timaeus",
    "gallery",
    "night",
    "ledger",
    "estate",
    "foundry",
]
type CompoundPolicyMode = Literal["unrestricted", "allowlist"]

DIALECT_IDS: tuple[DialectId, ...] = (
    "icelandic-archive",
    "clinical",
    "reykjavik-registry",
    "timaeus",
    "gallery",
    "night",
    "ledger",
    "estate",
    "foundry",
)


class DialectCompoundConstraint(GrammarModel):
    id: DialectId
    mode: CompoundPolicyMode
    compounds: tuple[StrictStr, ...] = ()

    @model_validator(mode="after")
    def validate_policy(self) -> Self:
        unknown = sorted(set(self.compounds) - PROMOTED_COMPOUNDS.keys())
        if unknown:
            msg = f"dialect {self.id!r} names unknown promoted compounds: {', '.join(unknown)}"
            raise ValueError(msg)
        if len(set(self.compounds)) != len(self.compounds):
            msg = f"dialect {self.id!r} repeats a promoted compound"
            raise ValueError(msg)
        if self.mode == "unrestricted" and self.compounds:
            msg = f"unrestricted dialect {self.id!r} must not carry an allowlist"
            raise ValueError(msg)
        if self.mode == "allowlist" and not self.compounds:
            msg = f"allowlisted dialect {self.id!r} requires at least one promoted compound"
            raise ValueError(msg)
        return self


class DialectNodeValidationError(ValueError):
    code: str
    dialect_id: str
    path: str

    def __init__(self, *, code: str, dialect_id: str, path: str, message: str) -> None:
        self.code = code
        self.dialect_id = dialect_id
        self.path = path
        super().__init__(f"{code} at {path} for dialect {dialect_id!r}: {message}")


def _constraint(
    dialect_id: DialectId,
    mode: CompoundPolicyMode,
    *compounds: str,
) -> DialectCompoundConstraint:
    return DialectCompoundConstraint(id=dialect_id, mode=mode, compounds=compounds)


_DIALECT_CONSTRAINTS = (
    _constraint("icelandic-archive", "unrestricted"),
    # Clinical's structural restriction is PROMOTED-ONLY (ratified KRA-788, repair d):
    # the allowlist names the full promoted package catalog and thereby excludes
    # unreviewed consumer compounds — it does not narrow the reviewed package
    # vocabulary. Earlier doctrine describing a SignalCard-only clinical mask
    # documented the first entry, not the policy; the live catalog is the truth.
    # A compound promoted into the package catalog is added here in the same change.
    _constraint(
        "clinical",
        "allowlist",
        "SignalCard",
        "EntityHeader",
        "ProvenanceFooter",
        "StatBand",
        "Breakdown",
        "TrailEntry",
        "KeyValuePanel",
    ),
    _constraint("reykjavik-registry", "unrestricted"),
    _constraint("timaeus", "unrestricted"),
    _constraint("gallery", "unrestricted"),
    _constraint("night", "unrestricted"),
    _constraint("ledger", "unrestricted"),
    _constraint("estate", "unrestricted"),
    _constraint("foundry", "unrestricted"),
)

DIALECT_CONSTRAINTS = MappingProxyType(
    {constraint.id: constraint for constraint in _DIALECT_CONSTRAINTS}
)


def dialect_constraint(dialect_id: str) -> DialectCompoundConstraint:
    for known_id, constraint in DIALECT_CONSTRAINTS.items():
        if known_id == dialect_id:
            return constraint
    msg = f"unknown Morphe dialect: {dialect_id}"
    raise ValueError(msg)


def validate_dialect_constraints() -> None:
    if tuple(DIALECT_CONSTRAINTS) != DIALECT_IDS:
        msg = "dialect constraint catalog must define every shipped dialect exactly once"
        raise ValueError(msg)


def _validation_error(
    constraint: DialectCompoundConstraint,
    *,
    code: str,
    path: str,
    message: str,
) -> DialectNodeValidationError:
    return DialectNodeValidationError(
        code=code,
        dialect_id=constraint.id,
        path=path,
        message=message,
    )


def _validated_node(
    value: object,
    constraint: DialectCompoundConstraint,
    path: str,
) -> Node:
    try:
        return validate_node(value)
    except ValueError as exc:
        raise _validation_error(
            constraint,
            code="DIALECT_NODE_SHAPE",
            path=path,
            message=str(exc),
        ) from exc


def _validate_parameter(
    value: object,
    parameter: CompoundParam,
    constraint: DialectCompoundConstraint,
    path: str,
) -> None:
    if parameter.type == "string":
        valid = isinstance(value, str)
    elif parameter.type == "number":
        valid = isinstance(value, int | float) and not isinstance(value, bool)
    elif parameter.type == "boolean":
        valid = isinstance(value, bool)
    elif parameter.type == "node":
        _walk_node(_validated_node(value, constraint, path), constraint, path)
        return
    elif not isinstance(value, list | tuple):
        valid = False
    else:
        for index, item in enumerate(value):
            item_path = f"{path}[{index}]"
            _walk_node(_validated_node(item, constraint, item_path), constraint, item_path)
        return
    if not valid:
        raise _validation_error(
            constraint,
            code="DIALECT_COMPOUND_ARG_TYPE",
            path=path,
            message=f"expected {parameter.type}",
        )


def _validate_compound(
    node: CompoundRef,
    constraint: DialectCompoundConstraint,
    path: str,
) -> None:
    name = node.name
    if name not in constraint.compounds:
        raise _validation_error(
            constraint,
            code="DIALECT_COMPOUND_NOT_ALLOWED",
            path=f"{path}.name",
            message=f"compound {name!r} is outside the allowlist",
        )
    definition = promoted_compound(name)
    args = node.args
    unknown_args = sorted(set(args) - definition.params.properties.keys())
    if unknown_args:
        raise _validation_error(
            constraint,
            code="DIALECT_COMPOUND_UNKNOWN_ARG",
            path=f"{path}.args",
            message=f"unknown arguments: {', '.join(unknown_args)}",
        )
    missing = sorted(
        name
        for name, parameter in definition.params.properties.items()
        if parameter.required and name not in args
    )
    if missing:
        raise _validation_error(
            constraint,
            code="DIALECT_COMPOUND_MISSING_ARG",
            path=f"{path}.args",
            message=f"missing required arguments: {', '.join(missing)}",
        )
    for arg_name, value in args.items():
        _validate_parameter(
            value,
            definition.params.properties[arg_name],
            constraint,
            f"{path}.args.{arg_name}",
        )
    _validate_slots(node.slots, definition, constraint, path)


def _validate_slots(
    value: dict[str, tuple[Node, ...]] | None,
    definition: CompoundDefinition,
    constraint: DialectCompoundConstraint,
    path: str,
) -> None:
    if value is None:
        return
    slots = value
    allowed = set(compound_slot_names(definition))
    unknown = sorted(set(slots) - allowed)
    if unknown:
        raise _validation_error(
            constraint,
            code="DIALECT_COMPOUND_UNKNOWN_SLOT",
            path=f"{path}.slots",
            message=f"unknown slots: {', '.join(unknown)}",
        )
    for slot_name, fills in slots.items():
        for index, fill in enumerate(fills):
            _walk_node(fill, constraint, f"{path}.slots.{slot_name}[{index}]")


def _walk_children(
    children: tuple[Node, ...],
    constraint: DialectCompoundConstraint,
    path: str,
) -> None:
    for index, child in enumerate(children):
        _walk_node(child, constraint, f"{path}[{index}]")


def _walk_node(node: Node, constraint: DialectCompoundConstraint, path: str) -> None:
    if isinstance(node, CompoundRef):
        _validate_compound(node, constraint, path)
        return
    if isinstance(node, Stack | Grid | Cluster | Frame | Dialog | Popover | Disclosure):
        _walk_children(node.children, constraint, f"{path}.children")
    elif isinstance(node, Table):
        for row_index, row in enumerate(node.rows):
            for cell_index, cell in enumerate(row.cells):
                _walk_children(
                    cell.children,
                    constraint,
                    f"{path}.rows[{row_index}].cells[{cell_index}].children",
                )
            if row.diagnostics is not None:
                _walk_children(
                    row.diagnostics,
                    constraint,
                    f"{path}.rows[{row_index}].diagnostics",
                )
    elif isinstance(node, Vary):
        _walk_children(node.options, constraint, f"{path}.options")
    elif isinstance(node, Within) and node.target is not None:
        _walk_node(node.target, constraint, f"{path}.target")
    elif isinstance(node, Slot) and node.fallback is not None:
        _walk_children(node.fallback, constraint, f"{path}.fallback")


def validate_node_for_dialect(payload: object, dialect_id: str) -> Node:
    constraint = dialect_constraint(dialect_id)
    validated = _validated_node(payload, constraint, "$")
    if constraint.mode == "unrestricted":
        return validated
    _walk_node(validated, constraint, "$")
    return validated


def constraints_typescript_document() -> str:
    validate_dialect_constraints()
    document = {
        dialect_id: constraint.model_dump(mode="json", exclude={"id"})
        for dialect_id, constraint in DIALECT_CONSTRAINTS.items()
    }
    encoded = typescript_data_literal(cast("TypeScriptValue", document))
    return (
        "/**\n"
        " * @generated by `python -m morphe_grammar.artifacts --write`.\n"
        " * Source of truth: `py/morphe_grammar/dialects.py`.\n"
        " */\n"
        f"export const DIALECT_COMPOUND_CONSTRAINTS = {encoded} as const;\n\n"
        "export type DialectConstraintId = keyof typeof DIALECT_COMPOUND_CONSTRAINTS;\n"
    )


validate_dialect_constraints()


__all__ = [
    "DIALECT_CONSTRAINTS",
    "DIALECT_IDS",
    "CompoundPolicyMode",
    "DialectCompoundConstraint",
    "DialectId",
    "DialectNodeValidationError",
    "constraints_typescript_document",
    "dialect_constraint",
    "validate_dialect_constraints",
    "validate_node_for_dialect",
]

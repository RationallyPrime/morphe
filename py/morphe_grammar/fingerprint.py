from __future__ import annotations

from hashlib import sha256
from typing import Final, cast

import rfc8785

from .catalog import PROMOTED_COMPOUNDS
from .dialects import DIALECT_CONSTRAINTS, DIALECT_IDS
from .masks import dialect_mask_document
from .schema import JsonSchemaValue, schema_document

type ContractDocument = dict[str, JsonSchemaValue]


def grammar_contract_document() -> ContractDocument:
    """Canonical decoder/admission contract (schema + catalog + dialect policy/masks).

    Documentation, CSS, demo fixtures, and distribution package versions are excluded.
    """
    return {
        "schema": schema_document(),
        "promoted_compounds": [
            cast(
                "JsonSchemaValue",
                definition.model_dump(mode="json", by_alias=True, exclude_none=True),
            )
            for definition in PROMOTED_COMPOUNDS.values()
        ],
        "dialect_compound_policies": [
            cast(
                "JsonSchemaValue",
                constraint.model_dump(mode="json", by_alias=True, exclude_none=True),
            )
            for constraint in DIALECT_CONSTRAINTS.values()
        ],
        "dialect_masks": {
            dialect_id: dialect_mask_document(dialect_id) for dialect_id in DIALECT_IDS
        },
    }


def fingerprint_contract(document: object) -> str:
    canonical = rfc8785.dumps(cast("dict[str, JsonSchemaValue]", document))
    digest = sha256(canonical).hexdigest()
    return f"sha256:{digest}"


GRAMMAR_FINGERPRINT: Final = fingerprint_contract(grammar_contract_document())

__all__ = [
    "GRAMMAR_FINGERPRINT",
    "fingerprint_contract",
    "grammar_contract_document",
]

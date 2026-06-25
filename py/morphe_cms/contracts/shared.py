from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

# The substrate-generic primitives live in morphe_contracts (the thin base shared with
# morphe_surface). cms re-exports them so existing `from ...contracts.shared import X`
# call sites keep working while the honest home is the base package.
from morphe_contracts import (
    ContractModel,
    Diagnostic,
    DialectName,
    EmphasisClaim,
    IntentRef,
    MorpheControls,
    RenderHints,
    SurfaceRef,
)

__all__ = [
    "Audience",
    "CmsModel",
    "Diagnostic",
    "DialectName",
    "EmphasisClaim",
    "IntentRef",
    "MorpheControls",
    "RenderHints",
    "Slug",
    "SurfaceRef",
]

# Back-compat alias for existing cms imports (the cms base IS the contract base).
CmsModel = ContractModel

# Genuinely cms-specific — these stay here, never promoted.
Audience = Literal[
    "founder",
    "operator",
    "cto",
    "cfo",
    "operations_lead",
    "developer",
    "buyer",
]

Slug = Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]

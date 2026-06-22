from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# Closed Literal mirror of morphe_grammar CoreIntent (CONTRACT.md §8). Closed (not
# the grammar's open `CoreIntent | str`) so the exported JSON Schema constrains agent
# generation to known intents.
IntentRef = Literal[
    "primary-action",
    "neutral",
    "provenance",
    "evidence",
    "accession",
    "caution",
    "success",
    "info",
]

# The nine registered dialect ids (src/lib/dialects/registry.ts).
DialectName = Literal[
    "gallery",
    "night",
    "icelandic-archive",
    "clinical",
    "reykjavik-registry",
    "timaeus",
    "ledger",
    "estate",
    "foundry",
]

# Frame.surface in the grammar is exactly these three.
SurfaceRef = Literal["base", "raised", "sunken"]

# EmphasisClaim in the grammar.
EmphasisClaim = Literal["muted", "normal", "strong", "critical"]

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


class CmsModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MorpheControls(CmsModel):
    # `dialect` is a RENDER HINT only — never emitted into the tree (content ⊥ presentation).
    dialect: DialectName = "gallery"
    primary_intent: IntentRef = "evidence"
    surface: SurfaceRef = "base"
    emphasis: EmphasisClaim = "normal"


class RenderHints(CmsModel):
    dialect: DialectName = "gallery"


class Diagnostic(CmsModel):
    code: str
    severity: Literal["error", "warning", "info"]
    path: str
    message: str
    repair_hint: str | None = None

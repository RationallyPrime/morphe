"""Thin substrate-contract base shared by morphe_cms and morphe_surface.

Holds the generic primitives both pipelines need — the Affordance-Substrate
``Diagnostic`` shape, the closed grammar-mirror enums, render hints, and the
``CompiledArtifact`` envelope — so neither sibling has to depend on the other. Depends
only on Pydantic; never imports morphe_cms, morphe_surface, or morphe_grammar.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

type CoreIntent = Literal[
    "primary-action",
    "neutral",
    "provenance",
    "evidence",
    "accession",
    "caution",
    "success",
    "info",
]

type RegisterIntent = Literal["folio", "marginalia", "seal"]

# Closed Literal mirror of morphe_grammar IntentRef (CONTRACT.md §8): core intents plus
# the shared register tier. Exported JSON Schema constrains agent generation instead of
# accepting arbitrary strings.
type IntentRef = CoreIntent | RegisterIntent

# Frame.surface in the grammar is exactly these three.
SurfaceRef = Literal["base", "raised", "sunken"]

# EmphasisClaim in the grammar.
EmphasisClaim = Literal["muted", "normal", "strong", "critical"]

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


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Diagnostic(ContractModel):
    code: str
    severity: Literal["error", "warning", "info"]
    path: str
    message: str
    repair_hint: str | None = None
    # Where the offending entries live: a producer-relative path (or absolute
    # http(s) URL) the edge renders as the alert's drill-through. The viewer's
    # trust gate rewrites it against the source's DECLARED surface paths and
    # strips anything unresolvable, so a warning can name its evidence without
    # the producer gaining a new navigation authority.
    href: str | None = None


class RenderHints(ContractModel):
    dialect: DialectName = "gallery"


class MorpheControls(ContractModel):
    # `dialect` is a RENDER HINT only — never emitted into the tree (content ⊥ presentation).
    dialect: DialectName = "gallery"
    primary_intent: IntentRef = "evidence"
    surface: SurfaceRef = "base"
    emphasis: EmphasisClaim = "normal"


class ArtifactProvenance(ContractModel):
    created_by: Literal["agent", "human", "migration"]
    prompt_id: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    created_at: str


class CompiledArtifact[TreeT](ContractModel):
    """Versioned, deterministic compiled-tree envelope. Timestamps/versions are passed in."""

    tree: TreeT
    grammar_version: str
    producer_version: str
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    produced_at: str


__all__ = [
    "ArtifactProvenance",
    "CompiledArtifact",
    "ContractModel",
    "CoreIntent",
    "Diagnostic",
    "DialectName",
    "EmphasisClaim",
    "IntentRef",
    "MorpheControls",
    "RegisterIntent",
    "RenderHints",
    "SurfaceRef",
]

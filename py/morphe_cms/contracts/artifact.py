from __future__ import annotations

from typing import Any, Literal

from pydantic import field_serializer

from morphe_contracts import ArtifactProvenance, CompiledArtifact
from morphe_grammar import NODE_ADAPTER, Node

from .shared import CmsModel, RenderHints

# ArtifactProvenance now lives in morphe_contracts; re-exported here (it is referenced as
# an ArtifactEnvelope field) so `from ...contracts.artifact import ArtifactProvenance` holds.
__all__ = [
    "ArtifactEnvelope",
    "ArtifactProvenance",
    "ArtifactType",
    "CompiledTree",
    "Publication",
]

ArtifactType = Literal[
    "landingPage",
    "capabilityPage",
    "caseStudy",
    "comparisonPage",
    "article",
    "campaignPage",
]


class ArtifactEnvelope(CmsModel):
    id: str
    type: ArtifactType
    schema_version: str
    presenter_version: str
    # Frozen at write time: "draft" (gate failed) or "validated" (gate passed). Never
    # mutated. "published"/"archived" are pointer facts, not file mutations (see store).
    status: Literal["draft", "validated", "published", "archived"]
    data: dict[str, Any]
    provenance: ArtifactProvenance


class CompiledTree(CompiledArtifact[Node]):
    # Editorial specialization of the shared CompiledArtifact envelope. `presenter_version`
    # is the cms domain term for the producer (mirrors ArtifactEnvelope.presenter_version);
    # `producer_version`/`produced_at`/`tree`/`grammar_version`/`diagnostics` are inherited.
    artifact_id: str
    revision_id: str
    presenter_version: str
    render_hints: RenderHints

    @field_serializer("tree")
    @staticmethod
    def serialize_tree(tree: Node) -> object:
        return NODE_ADAPTER.dump_python(tree, mode="json", by_alias=True, exclude_none=True)


class Publication(CmsModel):
    slug: str
    artifact_id: str
    revision_id: str
    channel: Literal["site", "preview", "campaign"]
    published_at: str
    published_by: Literal["agent", "human", "system"]

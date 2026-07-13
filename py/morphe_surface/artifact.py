from __future__ import annotations

import hashlib
import json
from typing import Literal, Self

from pydantic import field_serializer, model_validator

from morphe_contracts import CompiledArtifact
from morphe_grammar import NODE_ADAPTER, Node

SURFACE_ARTIFACT_VERSION = "1.0.0"


class CompiledSurface(CompiledArtifact[Node]):
    """Operational specialization of the shared CompiledArtifact envelope (ADR-0014 D10).

    The sibling of cms's CompiledTree over the same generic base. ``tree`` is the
    authoritative Pydantic ``Node`` union, so loading an artifact re-runs the complete
    recursive grammar gate instead of trusting a producer-side convention.
    """

    artifact_version: Literal["1.0.0"]
    compiler_version: str

    @field_serializer("tree")
    @staticmethod
    def serialize_tree(tree: Node) -> object:
        return NODE_ADAPTER.dump_python(tree, mode="json", by_alias=True, exclude_none=True)

    @model_validator(mode="after")
    def require_one_producer_version(self) -> Self:
        if self.producer_version != self.compiler_version:
            msg = "producer_version must equal compiler_version for a compiled surface"
            raise ValueError(msg)
        return self


def canonical_surface_artifact_bytes(artifact: CompiledSurface) -> bytes:
    """Return the canonical content-addressing representation of ``artifact``.

    This digest is a stable content identity, not proof of producer authenticity. Transport
    authentication remains the host's responsibility; artifact loading still performs full
    structural validation on every boundary.
    """
    document = artifact.model_dump(mode="json", by_alias=True, exclude_none=True)
    return json.dumps(
        document,
        allow_nan=False,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode()


def surface_artifact_digest(artifact: CompiledSurface) -> str:
    """Return the stable SHA-256 content address for a compiled surface."""
    digest = hashlib.sha256(
        canonical_surface_artifact_bytes(artifact), usedforsecurity=False
    ).hexdigest()
    return f"sha256:{digest}"

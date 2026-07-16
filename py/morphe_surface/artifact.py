from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Any, Literal, Self

from pydantic import field_serializer, model_validator

from morphe_contracts import CompiledArtifact
from morphe_grammar import NODE_ADAPTER, Node

if TYPE_CHECKING:
    from pydantic import GetJsonSchemaHandler
    from pydantic_core import CoreSchema

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

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> dict[str, Any]:
        # KRA-754: the ``-> object`` serializer above erases ``tree`` to the empty
        # schema ``{}`` in SERIALIZATION mode, so every consumer's OpenAPI said the
        # tree accepts any JSON. Annotating the serializer's return as ``Node`` is not
        # an option — the function returns a pre-dumped dict, and Pydantic would then
        # warn (and re-serialize) on every dump. Restore the union by generating the
        # Node schema THROUGH the live handler (its defs register with the same
        # generator); the runtime dump stays byte-identical.
        document = handler(core_schema)
        properties = document.get("properties")
        if handler.mode == "serialization" and isinstance(properties, dict):
            properties["tree"] = handler(NODE_ADAPTER.core_schema)
        return document

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
    """Return the stable SHA-256 content address for a compiled surface.

    Identity, not authenticity — and currently a forward capability: no ingress
    verifies this digest yet (no store lookup, no TS-side equivalent). Do not
    assume content-addressing is enforced anywhere until a consumer wires it.
    """
    digest = hashlib.sha256(
        canonical_surface_artifact_bytes(artifact), usedforsecurity=False
    ).hexdigest()
    return f"sha256:{digest}"

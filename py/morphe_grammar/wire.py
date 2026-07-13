from __future__ import annotations

import json
import sys
from typing import ClassVar, Literal, cast

from pydantic import ConfigDict, StrictStr, TypeAdapter
from pydantic import Field as PydanticField

from .models import GrammarModel, JsonValue, Node, NumberValue
from .schema import JsonSchema, normalize_schema


class TierEvent(GrammarModel):
    tier: Literal["slow", "mid", "fast"]
    name: StrictStr
    payload: dict[str, JsonValue] = PydanticField(default_factory=dict)


class ContextDigest(GrammarModel):
    summary: StrictStr | None = None
    signals: dict[str, JsonValue] = PydanticField(default_factory=dict)
    events: tuple[TierEvent, ...] = ()


class Delta(GrammarModel):
    id: StrictStr
    choice: NumberValue
    epoch: NumberValue


class EmissionEnvelope(GrammarModel):
    epoch: NumberValue
    tree: Node
    choices: dict[str, NumberValue]


class DecisionRequest(GrammarModel):
    task_state: dict[str, JsonValue]
    event: TierEvent
    digest: ContextDigest
    dialect_id: StrictStr
    surface_id: StrictStr


class DecisionResponse(GrammarModel):
    source: Literal["live", "fallback"]
    tree: Node
    model: StrictStr | None = None
    diagnostics: tuple[StrictStr, ...] = ()


class DecisionContract(GrammarModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        extra="forbid",
        frozen=True,
        populate_by_name=True,
        json_schema_extra={
            "description": (
                "Contract wrapper for the adaptive decision sidecar: request and response "
                "schemas live in one artifact for OpenAPI/source-binding ingestion."
            ),
        },
    )

    request: DecisionRequest
    response: DecisionResponse


def rebuild_wire_models() -> None:
    namespace = {"JsonValue": JsonValue, "Node": Node, "NumberValue": NumberValue}
    for model_type in (
        TierEvent,
        ContextDigest,
        Delta,
        EmissionEnvelope,
        DecisionRequest,
        DecisionResponse,
        DecisionContract,
    ):
        model_type.model_rebuild(_types_namespace=namespace)


rebuild_wire_models()

DELTA_ADAPTER: TypeAdapter[Delta] = TypeAdapter(Delta)
DECISION_CONTRACT_ADAPTER: TypeAdapter[DecisionContract] = TypeAdapter(DecisionContract)


def _schema_document(adapter: TypeAdapter[object], title: str) -> JsonSchema:
    raw_schema = cast(
        "JsonSchema",
        adapter.json_schema(ref_template="#/$defs/{model}", union_format="any_of"),
    )
    normalized = cast("JsonSchema", normalize_schema(raw_schema))
    normalized["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    normalized["title"] = title
    return normalized


def delta_schema_document() -> JsonSchema:
    return _schema_document(cast("TypeAdapter[object]", DELTA_ADAPTER), "Morphe Delegation Delta")


def decision_schema_document() -> JsonSchema:
    return _schema_document(
        cast("TypeAdapter[object]", DECISION_CONTRACT_ADAPTER),
        "Morphe Adaptive Decision Contract",
    )


def main() -> None:
    sys.stdout.write(
        json.dumps(decision_schema_document(), ensure_ascii=True, indent=2, sort_keys=True)
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()

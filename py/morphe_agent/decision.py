from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from typing import TYPE_CHECKING, cast

from pydantic import RootModel
from pydantic_ai import Agent, ModelRetry, RunContext, ToolOutput
from pydantic_ai.capabilities import PrepareOutputTools
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from morphe_grammar import (
    DialectId,
    DialectNodeValidationError,
    load_dialect_mask,
    validate_node_for_dialect,
)
from morphe_grammar.models import Node
from morphe_grammar.wire import DecisionRequest, DecisionResponse

from .fallback import fallback_tree
from .settings import AgentSettings

if TYPE_CHECKING:
    from pydantic_ai.models import Model
    from pydantic_ai.tools import ObjectJsonSchema, ToolDefinition

    from morphe_grammar.schema import JsonSchema

_MASK_SHAPE_ERROR = "DIALECT_MASK_SHAPE"
_OUTPUT_TOOL_COUNT_ERROR = "OUTPUT_TOOL_COUNT"
_OUTPUT_TOOL_NAME_ERROR = "OUTPUT_TOOL_NAME"

INSTRUCTIONS = """
You are Morphe's adaptive UI decision service.

Return exactly one schema-valid Morphe Node. The tree must stay inside the fixed
grammar: no CSS, no pixels, no classes, no raw colors, no scripts, no HTML.
Use roles, intents, emphasis claims and typed children only. Prefer compact
evidence-led panels for the substrate lab.
""".strip()


class NodeOutput(RootModel[Node]):
    pass


NodeOutput.model_rebuild(_types_namespace={"Node": Node})

type DecisionAgent = Agent[DialectEmissionPolicy, NodeOutput]


class StructuredEmissionConfigurationError(RuntimeError):
    code: str

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(f"{code}: {message}")


@dataclass(frozen=True, slots=True)
class DialectEmissionPolicy:
    """Immutable per-run decoder policy loaded from installed package resources."""

    dialect_id: DialectId
    _mask_json: str = field(repr=False)

    @classmethod
    def load(cls, dialect_id: str) -> DialectEmissionPolicy:
        mask = load_dialect_mask(dialect_id)
        return cls(
            dialect_id=cast("DialectId", dialect_id),
            _mask_json=json.dumps(mask, ensure_ascii=True, separators=(",", ":"), sort_keys=True),
        )

    def fresh_mask(self) -> JsonSchema:
        decoded = json.loads(self._mask_json)
        if not isinstance(decoded, dict):  # pragma: no cover - constructor owns the encoding.
            raise StructuredEmissionConfigurationError(
                _MASK_SHAPE_ERROR,
                f"decoder mask for {self.dialect_id!r} is not an object",
            )
        return cast("JsonSchema", decoded)


def _prepare_dialect_output(
    ctx: RunContext[DialectEmissionPolicy],
    tool_defs: list[ToolDefinition],
) -> list[ToolDefinition]:
    if len(tool_defs) != 1:
        raise StructuredEmissionConfigurationError(
            _OUTPUT_TOOL_COUNT_ERROR,
            f"expected one Morphe output tool, received {len(tool_defs)}",
        )
    output_tool = tool_defs[0]
    if output_tool.name != "emit_morphe_node":
        raise StructuredEmissionConfigurationError(
            _OUTPUT_TOOL_NAME_ERROR,
            f"expected 'emit_morphe_node', received {output_tool.name!r}",
        )
    return [
        replace(
            output_tool,
            parameters_json_schema=cast("ObjectJsonSchema", ctx.deps.fresh_mask()),
        )
    ]


async def _validate_dialect_output(
    ctx: RunContext[DialectEmissionPolicy],
    output: NodeOutput,
) -> NodeOutput:
    try:
        validate_node_for_dialect(output.root, ctx.deps.dialect_id)
    except DialectNodeValidationError as exc:
        raise ModelRetry(str(exc)) from exc
    return output


def _fallback_response(request: DecisionRequest, *diagnostics: str) -> DecisionResponse:
    return DecisionResponse(
        source="fallback",
        tree=fallback_tree(request),
        diagnostics=diagnostics or ("fallback",),
    )


def _openai_model(settings: AgentSettings) -> Model:
    if settings.model is None or settings.gateway_api_key is None:
        msg = "live agent requires model and gateway API key"
        raise ValueError(msg)
    return OpenAIChatModel(
        settings.model,
        provider=OpenAIProvider(
            base_url=settings.gateway_base_url,
            api_key=settings.gateway_api_key,
        ),
    )


def build_decision_agent(model: Model) -> DecisionAgent:
    agent = cast(
        "DecisionAgent",
        Agent(
            model,
            deps_type=DialectEmissionPolicy,
            output_type=ToolOutput(NodeOutput, name="emit_morphe_node"),
            instructions=INSTRUCTIONS,
            capabilities=[PrepareOutputTools(_prepare_dialect_output)],
        ),
    )
    agent.output_validator(_validate_dialect_output)
    return agent


def _prompt(request: DecisionRequest) -> str:
    return "\n".join(
        [
            "Adapt this Morphe surface from the governed task state and context digest.",
            request.model_dump_json(exclude_none=True),
        ],
    )


async def decide(
    request: DecisionRequest,
    *,
    settings: AgentSettings | None = None,
    agent: DecisionAgent | None = None,
) -> DecisionResponse:
    resolved_settings = settings or AgentSettings()
    if not resolved_settings.live:
        return _fallback_response(request, "live-disabled")
    if agent is None and not resolved_settings.live_ready:
        return _fallback_response(request, "live-not-configured")

    try:
        policy = DialectEmissionPolicy.load(request.dialect_id)
        resolved_agent = agent or build_decision_agent(_openai_model(resolved_settings))
        result = await resolved_agent.run(_prompt(request), deps=policy)
        tree = validate_node_for_dialect(result.output.root, policy.dialect_id)
        return DecisionResponse(
            source="live",
            model=result.response.model_name or resolved_settings.model,
            tree=tree,
            diagnostics=("pydantic-ai",),
        )
    except Exception as exc:  # noqa: BLE001 - live providers must never break the render path.
        return _fallback_response(request, f"live-error:{type(exc).__name__}")

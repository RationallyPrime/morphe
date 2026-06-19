from __future__ import annotations

from typing import cast

from pydantic import RootModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from morphe_grammar.models import Node, validate_node
from morphe_grammar.wire import DecisionRequest, DecisionResponse

from .fallback import fallback_tree
from .settings import AgentSettings

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


def _fallback_response(request: DecisionRequest, *diagnostics: str) -> DecisionResponse:
    return DecisionResponse(
        source="fallback",
        tree=fallback_tree(request),
        diagnostics=diagnostics or ("fallback",),
    )


def _build_agent(settings: AgentSettings) -> Agent[None, NodeOutput]:
    if settings.model is None or settings.gateway_api_key is None:
        msg = "live agent requires model and gateway API key"
        raise ValueError(msg)
    model = OpenAIChatModel(
        settings.model,
        provider=OpenAIProvider(
            base_url=settings.gateway_base_url,
            api_key=settings.gateway_api_key,
        ),
    )
    return cast(
        "Agent[None, NodeOutput]", Agent(model, output_type=NodeOutput, instructions=INSTRUCTIONS)
    )


def _prompt(request: DecisionRequest) -> str:
    return "\n".join(
        [
            "Adapt this Morphe surface from the governed task state and context digest.",
            request.model_dump_json(exclude_none=True),
        ],
    )


async def decide(
    request: DecisionRequest, *, settings: AgentSettings | None = None
) -> DecisionResponse:
    resolved_settings = settings or AgentSettings()
    if not resolved_settings.live:
        return _fallback_response(request, "live-disabled")
    if not resolved_settings.live_ready:
        return _fallback_response(request, "live-not-configured")

    try:
        agent = _build_agent(resolved_settings)
        result = await agent.run(_prompt(request))
        return DecisionResponse(
            source="live",
            model=resolved_settings.model,
            tree=validate_node(result.output.root),
            diagnostics=("pydantic-ai",),
        )
    except Exception as exc:  # noqa: BLE001 - live providers must never break the render path.
        return _fallback_response(request, f"live-error:{type(exc).__name__}")

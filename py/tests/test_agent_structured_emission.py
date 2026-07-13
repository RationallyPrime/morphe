from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING, cast

import anyio
import anyio.lowlevel
import pytest
from pydantic import ValidationError
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    ToolCallPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from morphe_agent.decision import build_decision_agent, decide
from morphe_agent.settings import AgentSettings
from morphe_grammar import load_dialect_mask, validate_node
from morphe_grammar.wire import DecisionRequest, DecisionResponse

if TYPE_CHECKING:
    from morphe_grammar.schema import JsonSchema

EXPECTED_RETRY_CALLS = 2


def _request(dialect_id: str) -> DecisionRequest:
    return DecisionRequest.model_validate(
        {
            "task_state": {"goal": f"Inspect the {dialect_id} surface"},
            "event": {"tier": "mid", "name": "surface.requested", "payload": {}},
            "digest": {"summary": "Prefer a compact evidence-led panel."},
            "dialect_id": dialect_id,
            "surface_id": "structured-emission-test",
        }
    )


def _response(info: AgentInfo, payload: dict[str, object]) -> ModelResponse:
    assert len(info.output_tools) == 1
    return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, payload)])


def _prompt_text(messages: list[ModelMessage]) -> str:
    chunks: list[str] = []
    for message in messages:
        if not isinstance(message, ModelRequest):
            continue
        chunks.extend(
            part.content
            for part in message.parts
            if isinstance(part, UserPromptPart) and isinstance(part.content, str)
        )
    return "\n".join(chunks)


def test_function_model_sees_the_exact_installed_dialect_schema() -> None:
    expected = load_dialect_mask("clinical")

    async def inspect_schema(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        assert '"dialect_id":"clinical"' in _prompt_text(messages)
        assert info.model_request_parameters.output_mode == "tool"
        assert info.model_request_parameters.output_object is None
        assert info.allow_text_output is False
        assert len(info.output_tools) == 1
        output_tool = info.output_tools[0]
        assert output_tool.name == "emit_morphe_node"
        assert output_tool.outer_typed_dict_key is None
        assert output_tool.parameters_json_schema == expected
        return _response(info, {"kind": "text", "value": "Schema-constrained output"})

    async def run() -> DecisionResponse:
        agent = build_decision_agent(FunctionModel(inspect_schema, model_name="schema-inspector"))
        return await decide(
            _request("clinical"),
            settings=AgentSettings(live=True),
            agent=agent,
        )

    response = anyio.run(run)

    assert response.source == "live"
    assert response.model == "schema-inspector"
    validate_node(response.tree)


def test_dialect_output_validator_retries_a_base_valid_but_disallowed_compound() -> None:
    call_count = 0
    saw_retry_prompt = False

    async def retry_then_succeed(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        nonlocal call_count, saw_retry_prompt
        call_count += 1
        saw_retry_prompt = saw_retry_prompt or any(
            isinstance(part, RetryPromptPart)
            for message in messages
            if isinstance(message, ModelRequest)
            for part in message.parts
        )
        if call_count == 1:
            return _response(
                info,
                {"kind": "compound", "name": "ConsumerOwned", "args": {}},
            )
        return _response(info, {"kind": "text", "value": "Recovered inside the mask"})

    async def run() -> DecisionResponse:
        agent = build_decision_agent(FunctionModel(retry_then_succeed, model_name="retry-proof"))
        return await decide(
            _request("clinical"),
            settings=AgentSettings(live=True),
            agent=agent,
        )

    response = anyio.run(run)

    assert call_count == EXPECTED_RETRY_CALLS
    assert saw_retry_prompt is True
    assert response.source == "live"
    assert response.tree.kind == "text"


def test_dialect_output_validator_fails_closed_after_retry_exhaustion() -> None:
    call_count = 0

    async def always_disallowed(_: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        nonlocal call_count
        call_count += 1
        return _response(
            info,
            {"kind": "compound", "name": "ConsumerOwned", "args": {}},
        )

    async def run() -> DecisionResponse:
        agent = build_decision_agent(FunctionModel(always_disallowed, model_name="invalid-proof"))
        return await decide(
            _request("clinical"),
            settings=AgentSettings(live=True),
            agent=agent,
        )

    response = anyio.run(run)

    assert call_count == EXPECTED_RETRY_CALLS
    assert response.source == "fallback"
    assert "live-error:UnexpectedModelBehavior" in response.diagnostics
    validate_node(response.tree)


def test_unknown_dialect_is_unrepresentable_before_model_construction() -> None:
    with pytest.raises(ValidationError):
        _request("unknown-dialect")


def test_one_agent_keeps_concurrent_dialect_schemas_isolated() -> None:
    observed: list[tuple[str, JsonSchema]] = []

    async def record_schema(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        output_tool = info.output_tools[0]
        schema = cast("JsonSchema", deepcopy(output_tool.parameters_json_schema))
        dialect_id = schema.get("x-morphe-dialect")
        assert isinstance(dialect_id, str)
        assert f'"dialect_id":"{dialect_id}"' in _prompt_text(messages)
        observed.append((dialect_id, schema))
        await anyio.lowlevel.checkpoint()
        return _response(info, {"kind": "text", "value": f"{dialect_id} output"})

    async def run() -> dict[str, DecisionResponse]:
        agent = build_decision_agent(FunctionModel(record_schema, model_name="concurrency-proof"))
        responses: dict[str, DecisionResponse] = {}

        async def decide_for(dialect_id: str) -> None:
            responses[dialect_id] = await decide(
                _request(dialect_id),
                settings=AgentSettings(live=True),
                agent=agent,
            )

        async with anyio.create_task_group() as tasks:
            tasks.start_soon(decide_for, "clinical")
            tasks.start_soon(decide_for, "gallery")
        return responses

    responses = anyio.run(run)

    assert set(responses) == {"clinical", "gallery"}
    assert all(response.source == "live" for response in responses.values())
    assert {dialect_id for dialect_id, _ in observed} == {"clinical", "gallery"}
    for dialect_id, schema in observed:
        assert schema == load_dialect_mask(dialect_id)

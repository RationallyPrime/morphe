from __future__ import annotations

from typing import TYPE_CHECKING

import anyio
import httpx

from morphe_agent.app import create_app
from morphe_agent.decision import decide
from morphe_agent.settings import AgentSettings
from morphe_grammar import validate_node
from morphe_grammar.wire import DecisionRequest, DecisionResponse

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from fastapi import FastAPI

HTTP_OK = 200
HTTP_UNPROCESSABLE_ENTITY = 422

REQUEST_BODY = {
    "task_state": {
        "goal": "Inspect ERP exception workflow",
        "lead": {"company": "Northwind Controls", "vertical": "industrial quality"},
    },
    "event": {"tier": "mid", "name": "substrate.lab.requested", "payload": {"intent": "proof"}},
    "digest": {
        "summary": "Operator wants a compact, evidence-led panel.",
        "signals": {"risk": "medium", "latency_budget_ms": 1500},
        "events": [{"tier": "fast", "name": "hover.intent-chip", "payload": {"count": 2}}],
    },
    "dialect_id": "gallery",
    "surface_id": "substrate-lab",
}


async def live_decision(_: DecisionRequest) -> DecisionResponse:
    return DecisionResponse(
        source="live",
        model="test:function-model",
        tree=validate_node(
            {
                "kind": "stack",
                "role": "section",
                "children": [
                    {"kind": "text", "value": "Live adaptive panel", "as": "heading"},
                    {
                        "kind": "status",
                        "tone": "success",
                        "signal": {"text": "Validated live path"},
                    },
                ],
            }
        ),
        diagnostics=("injected-live",),
    )


async def post_decision(app: FastAPI, body: object) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://morphe.test") as client:
        return await client.post("/v1/morphe/decision", json=body)


def test_decision_falls_back_without_live_credentials() -> None:
    request = DecisionRequest.model_validate(REQUEST_BODY)

    async def run_decision() -> DecisionResponse:
        return await decide(request, settings=AgentSettings(live=False))

    response = anyio.run(run_decision)

    assert response.source == "fallback"
    assert "live-disabled" in response.diagnostics
    validate_node(response.tree)


def test_sidecar_endpoint_returns_valid_fallback_without_credentials() -> None:
    response = anyio.run(
        post_decision,
        create_app(settings=AgentSettings(live=False)),
        REQUEST_BODY,
    )

    assert response.status_code == HTTP_OK
    payload = response.json()
    assert payload["source"] == "fallback"
    validate_node(payload["tree"])


def test_sidecar_endpoint_rejects_invalid_request_body() -> None:
    response = anyio.run(
        post_decision,
        create_app(settings=AgentSettings(live=False)),
        {"task_state": {}},
    )

    assert response.status_code == HTTP_UNPROCESSABLE_ENTITY


def test_sidecar_endpoint_can_surface_injected_live_decision() -> None:
    service: Callable[[DecisionRequest], Awaitable[DecisionResponse]] = live_decision
    response = anyio.run(
        post_decision,
        create_app(settings=AgentSettings(live=True), decision_service=service),
        REQUEST_BODY,
    )

    assert response.status_code == HTTP_OK
    payload = response.json()
    assert payload["source"] == "live"
    assert payload["model"] == "test:function-model"
    assert payload["diagnostics"] == ["injected-live"]
    validate_node(payload["tree"])

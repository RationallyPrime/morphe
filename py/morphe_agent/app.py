from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

from fastapi import FastAPI

from morphe_grammar.wire import DecisionRequest, DecisionResponse

from .decision import decide

if TYPE_CHECKING:
    from .settings import AgentSettings

DecisionService = Callable[[DecisionRequest], Awaitable[DecisionResponse]]


def create_app(
    *,
    settings: AgentSettings | None = None,
    decision_service: DecisionService | None = None,
) -> FastAPI:
    app = FastAPI(title="Morphe Adaptive Decision Sidecar")

    async def default_service(request: DecisionRequest) -> DecisionResponse:
        return await decide(request, settings=settings)

    service = decision_service or default_service

    @app.post(
        "/v1/morphe/decision",
        response_model=DecisionResponse,
        response_model_exclude_none=True,
    )
    async def decision(request: DecisionRequest) -> DecisionResponse:
        return await service(request)

    return app


app = create_app()

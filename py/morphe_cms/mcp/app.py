from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi_mcp import FastApiMCP

from morphe_cms.store.files import FileStore
from morphe_cms.tools.models import (  # noqa: TC001
    CreateCapabilityPageInput,
    PublishContentArtifactInput,
    RenderPreviewInput,
    RenderPreviewResult,
    ToolResult,
    ValidateContentArtifactInput,
    ValidateContentArtifactResult,
)
from morphe_cms.tools.service import (
    create_capability_page,
    publish_content_artifact,
    render_preview,
    validate_content_artifact,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


def build_app(root: Path | None = None) -> FastAPI:
    store = FileStore(Path(root) if root is not None else Path.cwd())
    app = FastAPI(title="Morphe CMS", version="0.1.0")

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # Schema-invalid tool calls -> repairable diagnostics, NOT persisted.
        diagnostics = [
            {
                "code": str(err["type"]).upper().replace(".", "_"),
                "severity": "error",
                "path": ".".join(str(p) for p in err["loc"]),
                "message": err["msg"],
                "repair_hint": "Fix this field to satisfy the tool schema, then resubmit.",
            }
            for err in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"ok": False, "diagnostics": diagnostics})

    @app.post("/tools/create_capability_page", operation_id="createCapabilityPage")
    def _create(body: CreateCapabilityPageInput) -> ToolResult:
        return create_capability_page(body, store, now=_now())

    @app.post("/tools/validate_content_artifact", operation_id="validateContentArtifact")
    def _validate(body: ValidateContentArtifactInput) -> ValidateContentArtifactResult:
        return validate_content_artifact(body, store)

    @app.post("/tools/render_preview", operation_id="renderPreview")
    def _preview(body: RenderPreviewInput) -> RenderPreviewResult:
        return render_preview(body, store)

    @app.post("/tools/publish_content_artifact", operation_id="publishContentArtifact")
    def _publish(body: PublishContentArtifactInput) -> ToolResult:
        return publish_content_artifact(body, store, now=_now())

    # mount_http() is the recommended transport in fastapi-mcp 0.4.0;
    # mount() is deprecated (SSE-only, hangs on GET in tests). Both mount at /mcp by default.
    FastApiMCP(app).mount_http()
    return app


app = build_app()

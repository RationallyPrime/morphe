from __future__ import annotations

import copy
from typing import TYPE_CHECKING

from fastapi.testclient import TestClient

from morphe_cms.mcp.app import build_app

from .cms_fixtures import VALID_DRAFT

if TYPE_CHECKING:
    from pathlib import Path


def _client(tmp_path: Path) -> TestClient:
    return TestClient(build_app(root=tmp_path))


def test_create_endpoint_happy_path(tmp_path: Path) -> None:
    client = _client(tmp_path)
    resp = client.post("/tools/create_capability_page", json={"draft": VALID_DRAFT})
    assert resp.status_code == 200  # noqa: PLR2004
    body = resp.json()
    assert body["ok"] is True
    assert body["artifact_id"] == "capability-page.workflow-automation"


def test_schema_invalid_returns_diagnostics_not_persisted(tmp_path: Path) -> None:
    client = _client(tmp_path)
    bad = copy.deepcopy(VALID_DRAFT)
    bad["cta"] = {"label": "Go", "intent": "primary-action"}  # no action_id/href
    resp = client.post("/tools/create_capability_page", json={"draft": bad})
    assert resp.status_code == 422  # noqa: PLR2004
    body = resp.json()
    assert body["ok"] is False
    assert body["diagnostics"]
    assert all(d["severity"] == "error" for d in body["diagnostics"])
    assert not (tmp_path / "content").exists()


def test_mcp_mounted(tmp_path: Path) -> None:
    # fastapi-mcp 0.4.0: mount_http() (recommended over deprecated mount()/SSE) mounts
    # at /mcp by default. GET returns 406 (not acceptable) when missing SSE headers —
    # that's still reachable (not 404).
    client = _client(tmp_path)
    resp = client.get("/mcp")
    assert resp.status_code != 404  # noqa: PLR2004

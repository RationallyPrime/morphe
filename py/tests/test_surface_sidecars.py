from __future__ import annotations

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

SCHEMA = {
    "type": "object",
    "title": "Shift",
    "properties": {"worker_id": {"type": "string", "title": "Worker"}},
}


def _diags() -> dict[str, list[Diagnostic]]:
    return {
        "$.worker_id": [
            Diagnostic(
                code="CERT",
                severity="error",
                path="$.worker_id",
                message="Lacks forklift cert.",
            ),
        ],
    }


def test_path_keyed_diagnostic_attaches_to_field() -> None:
    spec = build_surface(SCHEMA, {"worker_id": "w-3"}, root=SCHEMA, diagnostics=_diags())
    field = next(c for c in spec.children if c.path == "$.worker_id")
    assert field.diagnostics[0].code == "CERT"


def test_attached_diagnostic_renders_inline_alert() -> None:
    node = emit_node(build_surface(SCHEMA, {"worker_id": "w-3"}, root=SCHEMA, diagnostics=_diags()))
    txt = repr(node)
    assert "inline-alert" in txt
    assert "Lacks forklift cert." in txt
    validate_node(node)

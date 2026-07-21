from __future__ import annotations

import json
from typing import Any, cast

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_grammar.catalog import PROMOTED_COMPOUNDS, PROVENANCE_FOOTER
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node
from morphe_surface.spec import SurfaceNode

EXPECTED_TASK_AND_PROVENANCE_CHILDREN = 2

PANE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "title": "Obligation review",
    # Deliberately machine-first source order. The compiler may move only the
    # generic, signed presentation classes: identity/context, attention claims,
    # ordinary content, then audit proof. Order within each class stays signed.
    "x-morphe": {"order": ["worklist", "description", "name", "receipt", "state", "seal", "proof"]},
    "properties": {
        "description": {"type": "string", "title": "Scope"},
        "name": {"type": "string", "title": "Book"},
        "receipt": {
            "type": "string",
            "title": "Receipt id",
            "x-morphe": {"role": "provenance"},
        },
        "state": {
            "type": "string",
            "title": "Attention",
            "x-morphe": {"strategy": "status", "intents": {"blocked": "caution"}},
        },
        "worklist": {
            "type": "array",
            "title": "Obligations",
            "items": {
                "type": "object",
                "properties": {"subject": {"type": "string", "title": "Subject"}},
            },
        },
        "seal": {
            "type": "string",
            "title": "Testimony seal",
            "x-morphe": {"role": "seal"},
        },
        "proof": {
            "type": "object",
            "title": "Receipt",
            "x-morphe": {"strategy": "linked-ref", "role": "provenance"},
        },
    },
}

PANE_DATA = {
    "description": "Quarter close",
    "name": "Main book",
    "receipt": "receipt-798",
    "state": "blocked",
    "worklist": [{"subject": "VAT return"}],
    "seal": "seal-798",
    "proof": {"label": "Open receipt", "href": "/receipts/798"},
}


def test_stage_one_demotes_only_conventional_root_identity() -> None:
    spec = build_surface(PANE_SCHEMA, PANE_DATA, root=PANE_SCHEMA)
    identity = next(child for child in spec.children if child.path == "$.name")

    assert identity.text_as == "caption"
    assert identity.emphasis == "muted"
    assert identity.intent == "folio"

    required_only = {
        "type": "object",
        "title": "Code review",
        "required": ["code"],
        "properties": {"code": {"type": "string"}},
    }
    code = build_surface(required_only, {"code": "LEDGER"}, root=required_only).children[0]
    assert code.text_as is None
    assert code.emphasis is None


def test_stage_two_orders_decisions_and_preserves_audit_proof() -> None:
    node = emit_node(build_surface(PANE_SCHEMA, PANE_DATA, root=PANE_SCHEMA))
    validate_node(node)

    section = cast("dict[str, Any]", node["children"][0])
    children = cast("list[dict[str, Any]]", section["children"])
    assert children[0] == {
        "kind": "text",
        "value": "Obligation review",
        "as": "heading",
        "level": 1,
    }
    assert children[1] == {
        "kind": "text",
        "value": "Main book",
        "as": "caption",
        "emphasis": "muted",
        "intent": "folio",
    }
    assert children[2]["kind"] == "grid"
    assert children[2]["children"][1]["kind"] == "status"
    assert children[3]["kind"] == "stack"  # primary worklist section
    assert children[4]["kind"] == "grid"  # ordinary scope/detail

    footer = children[-1]
    assert footer["kind"] == "compound"
    assert footer["name"] == "ProvenanceFooter"
    assert [item["kind"] for item in footer["slots"]["facts"]] == ["stack"]
    assert [item["kind"] for item in footer["slots"]["seals"]] == ["stack"]
    assert [item["kind"] for item in footer["slots"]["links"]] == ["link"]

    encoded = json.dumps(node)
    for signed_value in ("receipt-798", "seal-798", "Open receipt", "/receipts/798"):
        assert encoded.count(signed_value) == 1
    assert '"as": "display"' not in encoded


def test_provenance_footer_is_promoted_native_disclosure_without_frame() -> None:
    assert "ProvenanceFooter" in PROMOTED_COMPOUNDS
    payload = PROVENANCE_FOOTER.template.model_dump(mode="json", by_alias=True, exclude_none=True)

    assert payload["kind"] == "disclosure"
    assert payload["summary"] == "Audit proof"
    assert set(PROVENANCE_FOOTER.params.properties) == {"heading"}
    assert payload["children"][0] == {"kind": "param-ref", "param": "heading"}
    assert '"kind": "frame"' not in json.dumps(payload)


def test_nested_record_keeps_one_root_h1() -> None:
    schema = {
        "type": "object",
        "title": "Root task",
        "properties": {
            "name": {"type": "string"},
            "nested": {
                "type": "object",
                "title": "Nested detail",
                "x-morphe": {"collapse": False},
                "properties": {"value": {"type": "string"}},
            },
        },
    }
    node = emit_node(
        build_surface(schema, {"name": "Context", "nested": {"value": "detail"}}, root=schema)
    )

    def headings(value: object) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        if isinstance(value, dict):
            mapping = cast("dict[str, Any]", value)
            if mapping.get("kind") == "text" and mapping.get("level") == 1:
                found.append(mapping)
            for child in mapping.values():
                found.extend(headings(child))
        elif isinstance(value, list | tuple):
            for child in value:
                found.extend(headings(child))
        return found

    assert [heading["value"] for heading in headings(node)] == ["Root task"]


def test_every_closed_root_strategy_gets_exactly_one_task_h1() -> None:
    strategies = (
        "scalar",
        "badge",
        "linked-ref",
        "diagnostic-node",
        "number",
        "status",
        "progress",
        "collapsed-section",
        "table",
        "card-stack",
        "kpi-row",
        "breakdown",
        "trail",
        "key-value",
    )

    for strategy in strategies:
        value: str | int | float = 1 if strategy in {"number", "progress"} else "value"
        spec = SurfaceNode(
            path="$",
            label="Root task",
            strategy=strategy,
            value=value,
            href="/detail" if strategy == "linked-ref" else None,
            heading=False,
        )
        node = emit_node(spec)
        encoded = json.dumps(node)
        assert encoded.count('"level": 1') == 1, strategy
        assert '"value": "Root task", "as": "heading", "level": 1' in encoded, strategy
        validate_node(node)


def test_explicit_provenance_wins_over_inferred_name_context() -> None:
    schema = {
        "type": "object",
        "title": "Identity audit",
        "properties": {
            "name": {
                "type": "string",
                "title": "Organization id",
                "x-morphe": {"role": "provenance"},
            }
        },
    }
    node = emit_node(build_surface(schema, {"name": "org-798"}, root=schema))
    section = cast("dict[str, Any]", node["children"][0])
    children = cast("list[dict[str, Any]]", section["children"])

    assert len(children) == EXPECTED_TASK_AND_PROVENANCE_CHILDREN
    footer = children[1]
    assert footer["name"] == "ProvenanceFooter"
    assert json.dumps(footer).count("Organization id") == 1
    assert json.dumps(footer).count("org-798") == 1


def test_nested_provenance_container_keeps_content_and_hoists_diagnostics_once() -> None:
    warning = Diagnostic(
        code="BUNDLE_RECEIPT_REVIEW",
        severity="warning",
        path="$.proof.receipt",
        message="Review the nested receipt.",
    )
    schema = {
        "type": "object",
        "title": "Bundle review",
        "x-morphe": {"order": ["proof"]},
        "properties": {
            "proof": {
                "type": "object",
                "title": "Receipt bundle",
                "x-morphe": {"role": "provenance", "order": ["receipt"]},
                "properties": {"receipt": {"type": "string", "title": "Receipt id"}},
            }
        },
    }
    spec = build_surface(
        schema,
        {"proof": {"receipt": "bundle-receipt-798"}},
        root=schema,
        diagnostics={"$.proof.receipt": [warning]},
    )
    assert spec.children[0].intent == "provenance"

    node = emit_node(spec)
    section = cast("dict[str, Any]", node["children"][0])
    children = cast("list[dict[str, Any]]", section["children"])
    alert = children[1]
    footer = children[2]
    encoded = json.dumps(node)

    assert alert["kind"] == "inline-alert"
    assert alert["title"] == "Receipt id: BUNDLE_RECEIPT_REVIEW"
    assert footer["name"] == "ProvenanceFooter"
    assert "BUNDLE_RECEIPT_REVIEW" not in json.dumps(footer)
    assert encoded.count("BUNDLE_RECEIPT_REVIEW") == 1
    assert encoded.count("Receipt bundle") == 1
    assert encoded.count("bundle-receipt-798") == 1
    validate_node(node)


def test_provenance_container_does_not_repeat_an_intrinsic_diagnostic_node() -> None:
    schema = {
        "type": "object",
        "title": "Bundle review",
        "properties": {
            "proof": {
                "type": "object",
                "title": "Receipt bundle",
                "x-morphe": {"role": "provenance"},
                "properties": {"mystery": {"title": "Mystery"}},
            }
        },
    }

    node = emit_node(build_surface(schema, {"proof": {"mystery": {}}}, root=schema))
    section = cast("dict[str, Any]", node["children"][0])
    children = cast("list[dict[str, Any]]", section["children"])
    footer = children[-1]
    encoded = json.dumps(node)

    assert encoded.count("UNRENDERABLE") == 1
    assert encoded.count("unrenderable: unknown construct") == 1
    assert "UNRENDERABLE" not in json.dumps(footer)
    assert "unrenderable: unknown construct" not in json.dumps(footer)
    assert children[1]["title"] == "Mystery: UNRENDERABLE"
    validate_node(node)


def test_child_diagnostic_precedes_the_primary_worklist() -> None:
    warning = Diagnostic(
        code="FIELD_REVIEW",
        severity="warning",
        path="$.detail",
        message="Review the changed detail.",
        repair_hint="Confirm it before dispatch.",
    )
    root = SurfaceNode(
        path="$",
        label="Decision review",
        strategy="record-card",
        children=(
            SurfaceNode(
                path="$.worklist",
                label="Worklist",
                strategy="table",
                emphasis="strong",
            ),
            SurfaceNode(
                path="$.detail",
                label="Changed detail",
                strategy="scalar",
                value="changed",
                diagnostics=(warning,),
            ),
        ),
    )
    node = emit_node(root)
    encoded = json.dumps(node)

    assert encoded.index("FIELD_REVIEW") < encoded.index("Worklist")
    validate_node(node)


def test_provenance_diagnostic_stays_visible_outside_audit_proof_once() -> None:
    warning = Diagnostic(
        code="SEAL_MISMATCH",
        severity="warning",
        path="$.receipt",
        message="Receipt signature does not match.",
        repair_hint="Request a fresh receipt.",
    )
    root = SurfaceNode(
        path="$",
        label="Receipt review",
        strategy="record-card",
        children=(
            SurfaceNode(
                path="$.receipt",
                label="Receipt id",
                strategy="scalar",
                value="receipt-798",
                intent="provenance",
                diagnostics=(warning,),
            ),
        ),
    )

    node = emit_node(root)
    section = cast("dict[str, Any]", node["children"][0])
    children = cast("list[dict[str, Any]]", section["children"])
    alert = children[1]
    footer = children[2]

    assert alert["kind"] == "inline-alert"
    assert alert["title"] == "Receipt id: SEAL_MISMATCH"
    assert alert["repair"] == "Request a fresh receipt."
    assert footer["name"] == "ProvenanceFooter"
    assert "SEAL_MISMATCH" not in json.dumps(footer)
    assert json.dumps(node).count("SEAL_MISMATCH") == 1
    assert json.dumps(node).count("receipt-798") == 1
    validate_node(node)


def test_trail_provenance_diagnostic_precedes_closed_footer_once() -> None:
    warning = Diagnostic(
        code="EVENT_RECEIPT_REVIEW",
        severity="warning",
        path="$.events[0].receipt",
        message="Review the event receipt.",
    )
    root = SurfaceNode(
        path="$",
        label="Audit trail",
        strategy="trail",
        items=(
            SurfaceNode(
                path="$.events[0]",
                label="Event",
                strategy="record-card",
                children=(
                    SurfaceNode(
                        path="$.events[0].receipt",
                        label="Receipt",
                        strategy="scalar",
                        value="event-receipt-798",
                        intent="provenance",
                        diagnostics=(warning,),
                    ),
                ),
            ),
        ),
    )

    node = emit_node(root)
    encoded = json.dumps(node)
    assert encoded.count("EVENT_RECEIPT_REVIEW") == 1
    assert encoded.count("event-receipt-798") == 1
    assert encoded.index("EVENT_RECEIPT_REVIEW") < encoded.index("ProvenanceFooter")
    validate_node(node)

"""The 0.5.0 hint-selected strategy: entity-header -> the promoted EntityHeader.

Like the 0.3.0 additions, this strategy is hint-selected ONLY — structural inference
never picks it, so the hint-free floor stays byte-identical. Every case runs the real
two-stage pipeline and gates through validate_node where it emits (D8).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_contracts import Diagnostic
from morphe_grammar import validate_node
from morphe_grammar.catalog import ENTITY_HEADER, PROMOTED_COMPOUNDS
from morphe_grammar.version import GRAMMAR_VERSION
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node
from morphe_surface.hints import MorpheHint
from morphe_surface.resolve import resolve_strategy

if TYPE_CHECKING:
    from morphe_surface.spec import SurfaceNode


VENDOR_SCHEMA: dict[str, Any] = {
    "type": "object",
    "title": "Vendor",
    # Real source-v1 testimony always carries a signed property order (stamped at
    # sign time); pin it here so both compilers key on the same order. Without a
    # signed order the two engines follow different legacy tie-breaks (Python keeps
    # insertion order, TypeScript sorts) — a pre-existing, out-of-scope asymmetry.
    "x-morphe": {
        "strategy": "entity-header",
        "order": ["name", "exposure", "standing", "contact", "ledgerRef"],
    },
    "properties": {
        "name": {"type": "string", "title": "Name"},
        "exposure": {
            "type": "integer",
            "title": "Exposure",
            "x-morphe": {"strategy": "number", "format": "currency", "currency": "ISK"},
        },
        "standing": {
            "type": "string",
            "title": "Standing",
            "x-morphe": {"strategy": "status", "intents": {"active": "success"}},
        },
        "contact": {"type": "string", "title": "Primary contact"},
        "ledgerRef": {"type": "string", "title": "Ledger id", "x-morphe": {"role": "provenance"}},
    },
}
VENDOR_DATA: dict[str, object] = {
    "name": "Krates ehf",
    "exposure": 2_450_000,
    "standing": "active",
    "contact": "Sok",
    "ledgerRef": "vnd-001",
}

# The SAME expected tree is asserted verbatim by the TypeScript twin
# (src/lib/surface-edge/entity-header.test.ts) — cross-language parity by hand plus the
# mechanical conformance vector (krates-vendor) pin the two compilers together.
EXPECTED_COMPOUND: dict[str, Any] = {
    "kind": "compound",
    "name": "EntityHeader",
    "args": {
        "kicker": {"kind": "text", "value": "Vendor", "as": "caption", "intent": "folio"},
        "title": {"kind": "text", "value": "Krates ehf", "as": "heading"},
        "keyFigure": {
            "kind": "number",
            "value": 2_450_000,
            "format": "currency",
            "currency": "ISK",
            "emphasis": "strong",
        },
    },
    "slots": {
        "signal": [{"kind": "status", "tone": "success", "signal": {"text": "active"}}],
        "meta": [
            {
                "kind": "grid",
                "role": "field-group",
                "columns": ["content", "flexible"],
                "children": [
                    {
                        "kind": "text",
                        "value": "Primary contact",
                        "as": "caption",
                        "intent": "neutral",
                    },
                    {"kind": "text", "value": "Sok", "as": "body"},
                ],
            }
        ],
        "provenance": [{"kind": "text", "value": "vnd-001", "as": "body", "intent": "provenance"}],
    },
}


def _build(schema: dict[str, Any], data: object) -> SurfaceNode:
    return build_surface(schema, data, root=schema)


# --- resolve: hint-selected only; the structural floor is untouched -------------------


def test_entity_header_is_hint_selected_only() -> None:
    obj = {"type": "object", "properties": {"name": {"type": "string"}}}
    # Structural inference never returns entity-header — an object is a record-card.
    assert resolve_strategy(obj, hint=MorpheHint()) == "record-card"
    assert resolve_strategy(obj, hint=MorpheHint(strategy="entity-header")) == "entity-header"


def test_hint_free_object_still_lowers_to_record_card() -> None:
    floor_schema = {k: v for k, v in VENDOR_SCHEMA.items() if k != "x-morphe"}
    spec = _build(floor_schema, VENDOR_DATA)
    assert spec.strategy == "record-card"


# --- build ----------------------------------------------------------------------------


def test_entity_header_builds_children_plainly() -> None:
    spec = _build(VENDOR_SCHEMA, VENDOR_DATA)
    assert spec.strategy == "entity-header"
    strategies = [child.strategy for child in spec.children]
    assert strategies == ["scalar", "number", "status", "scalar", "scalar"]
    # No identity promotion runs for an entity-header, so no child is display/critical.
    assert all(child.text_as is None for child in spec.children)


# --- emit (gated through validate_node) -----------------------------------------------


def test_entity_header_lowers_to_promoted_compound() -> None:
    node = emit_node(_build(VENDOR_SCHEMA, VENDOR_DATA))
    validate_node(node)
    assert node == EXPECTED_COMPOUND


def test_entity_header_omits_keyfigure_without_a_number() -> None:
    schema = {
        "type": "object",
        "title": "Person",
        "x-morphe": {"strategy": "entity-header"},
        "properties": {"name": {"type": "string", "title": "Name"}},
    }
    node = emit_node(_build(schema, {"name": "Ada"}))
    validate_node(node)
    # Omitting the arg lets the template's neutral-integer default apply.
    assert "keyFigure" not in node["args"]
    assert node["args"]["title"]["value"] == "Ada"


def test_entity_header_diagnostics_ride_the_meta_alert_head() -> None:
    diagnostics = {
        "$": [Diagnostic(code="OWN", severity="warning", path="$", message="node level")],
        "$.exposure": [
            Diagnostic(code="KEYFIG", severity="info", path="$.exposure", message="promoted arg")
        ],
    }
    spec = build_surface(VENDOR_SCHEMA, VENDOR_DATA, root=VENDOR_SCHEMA, diagnostics=diagnostics)
    node = emit_node(spec)
    validate_node(node)
    meta = node["slots"]["meta"]
    head = [item for item in meta if item.get("kind") == "inline-alert"]
    # The node's own diagnostic AND the diagnostic on the child promoted to a bare
    # keyFigure arg both surface at the head of the meta row (nothing dropped, D8).
    assert [alert["title"] for alert in head] == ["OWN", "KEYFIG"]


# --- factory gate ---------------------------------------------------------------------


def test_generated_catalog_registers_entity_header() -> None:
    assert "EntityHeader" in PROMOTED_COMPOUNDS
    assert ENTITY_HEADER.lifecycle == "promoted"
    assert ENTITY_HEADER.grammar_version == GRAMMAR_VERSION
    assert set(ENTITY_HEADER.params.properties) == {"kicker", "title", "keyFigure"}
    assert ENTITY_HEADER.params.properties["kicker"].required is True
    assert ENTITY_HEADER.params.properties["title"].required is True
    assert ENTITY_HEADER.params.properties["keyFigure"].required is False
    # Expansion / acyclicity / depth all pass because validate_node accepts the template.
    validate_node(ENTITY_HEADER.template)

"""Linked-ref fidelity (0.3.1).

Declared intent survives emit, absent relations keep their producer-authored
label, and label-less degrades stay blank (the D9 backstops build their specs
with no data label, so the blank case IS their case).
"""

from __future__ import annotations

from typing import Any

from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node


def _schema(hint: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"ref": {"x-morphe": hint}},
    }


def _ref_node(hint: dict[str, Any], data: object) -> dict[str, Any]:
    schema = _schema(hint)
    spec = build_surface(schema, {"ref": data}, root=schema)
    child = next(c for c in spec.children if c.path == "$.ref")
    node = emit_node(child)
    validate_node(node)
    return node


def test_linked_ref_carries_the_declared_intent() -> None:
    node = _ref_node(
        {"strategy": "linked-ref", "role": "primary-action"},
        {"label": "Authorized details", "href": "/orgs/x/counterparties/y"},
    )
    assert node == {
        "kind": "link",
        "href": "/orgs/x/counterparties/y",
        "label": "Authorized details",
        "intent": "primary-action",
    }


def test_absent_relation_renders_the_producer_label() -> None:
    node = _ref_node({"strategy": "linked-ref"}, {"label": "—", "href": None})
    assert node == {"kind": "text", "value": "—", "as": "body"}


def test_absent_relation_without_data_label_stays_blank() -> None:
    node = _ref_node({"strategy": "linked-ref"}, None)
    assert node == {"kind": "text", "value": "", "as": "body"}


def test_string_data_is_an_href_with_the_field_label() -> None:
    node = _ref_node({"strategy": "linked-ref", "label": "Manager"}, "/workers/w-9")
    assert node == {"kind": "link", "href": "/workers/w-9", "label": "Manager"}


def test_empty_data_label_uses_the_field_label() -> None:
    node = _ref_node(
        {"strategy": "linked-ref", "label": "Receipt"},
        {"label": "", "href": "/receipts/r-1"},
    )
    assert node == {"kind": "link", "href": "/receipts/r-1", "label": "Receipt"}

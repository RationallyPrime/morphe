from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

if TYPE_CHECKING:
    from collections.abc import Callable

WORKER = {
    "type": "object",
    "title": "Worker",
    "properties": {
        "name": {"type": "string", "title": "Name"},
        "status": {"enum": ["active", "leave"], "title": "Status"},
        "address": {
            "type": "object",
            "title": "Address",
            "properties": {"city": {"type": "string", "title": "City"}},
        },
    },
}
DATA = {"name": "Ada", "status": "active", "address": {"city": "Rvk"}}


def _find(node: object, pred: Callable[[dict[str, Any]], bool]) -> dict[str, Any] | None:
    if isinstance(node, dict):
        found = cast("dict[str, Any]", node)
        if pred(found):
            return found
        for value in found.values():
            hit = _find(value, pred)
            if hit is not None:
                return hit
    elif isinstance(node, list | tuple):
        for value in node:
            hit = _find(value, pred)
            if hit is not None:
                return hit
    return None


def test_record_card_emits_valid_frame() -> None:
    node = emit_node(build_surface(WORKER, DATA, root=WORKER))
    assert node["kind"] == "frame"
    assert node["role"] == "page"
    validate_node(node)


def test_scalar_emits_text() -> None:
    spec = build_surface({"type": "string", "title": "Name"}, "Ada", root={})
    node = emit_node(spec)
    assert node["kind"] == "text"
    assert node["value"] == "Ada"
    validate_node(node)


def test_enum_emits_badge() -> None:
    spec = build_surface({"enum": ["active"], "title": "Status"}, "active", root={})
    node = emit_node(spec)
    assert node["kind"] == "badge"
    assert node["label"] == "active"
    validate_node(node)


def test_collapsed_section_emits_within_collapse() -> None:
    node = emit_node(build_surface(WORKER, DATA, root=WORKER))
    addr = _find(node, lambda n: n.get("kind") == "within")
    assert addr is not None
    assert addr["dimension"] == "collapse"
    validate_node(node)

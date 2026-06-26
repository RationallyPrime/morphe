from __future__ import annotations

from morphe_surface.hints import parse_hint
from morphe_surface.spec import SurfaceNode


def test_surfacenode_is_recursive_and_frozen_extra() -> None:
    node = SurfaceNode(
        path="$",
        label="Root",
        strategy="record-card",
        children=(SurfaceNode(path="$.a", label="A", strategy="scalar", value="x"),),
    )
    assert node.children[0].value == "x"


def test_parse_hint_reads_x_morphe_block() -> None:
    hint = parse_hint(
        {
            "x-morphe": {
                "section": "Compliance",
                "priority": "secondary",
                "collapse": True,
                "strategy": "table",
            }
        },
    )
    assert hint.section == "Compliance"
    assert hint.priority == "secondary"
    assert hint.collapse is True
    assert hint.strategy == "table"


def test_parse_hint_defaults_when_absent() -> None:
    hint = parse_hint({"type": "string"})
    assert hint.strategy is None
    assert hint.priority == "primary"

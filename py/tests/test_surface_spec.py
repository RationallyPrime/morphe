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
                "collapse": True,
                "strategy": "table",
                "hidden": True,
                "heading": False,
            }
        },
    )
    assert hint.collapse is True
    assert hint.strategy == "table"
    assert hint.hidden is True
    assert hint.heading is False


def test_parse_hint_defaults_when_absent() -> None:
    hint = parse_hint({"type": "string"})
    assert hint.strategy is None
    assert hint.hidden is False
    assert hint.heading is True


def test_parse_hint_ignores_unknown_keys() -> None:
    # The vocabulary is forward-open across pinned revs (KRA-677): retired keys such as
    # priority/section — or keys from a newer compiler — must not crash the parse.
    hint = parse_hint({"x-morphe": {"priority": "hero", "section": "Meta", "hidden": True}})
    assert hint.hidden is True


def test_parse_hint_degrades_on_invalid_values() -> None:
    hint = parse_hint({"x-morphe": {"strategy": "not-a-strategy"}})
    assert hint == parse_hint({})


def test_parse_hint_does_not_coerce_known_value_types() -> None:
    assert parse_hint({"x-morphe": {"strategy": "status", "heading": "false"}}) == parse_hint(
        {}
    )
    assert parse_hint({"x-morphe": {"strategy": "status", "collapse": 1}}) == parse_hint({})


def test_parse_hint_accepts_json_order_arrays_under_strict_validation() -> None:
    hint = parse_hint({"x-morphe": {"strategy": "record-card", "order": ["b", "a"]}})
    assert hint.strategy == "record-card"
    assert hint.order == ("b", "a")

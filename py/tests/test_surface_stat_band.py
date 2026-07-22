"""StatBand (KRA-784): the kpi-row emitter's SignalCard tiles ride a promoted band.

StatBand is NOT a new strategy — kpi-row is already hint-selected. This suite pins the
refined lowering: the band owns the auto-fit narrow-track grid, so the emitted section
holds one StatBand compound whose ``tiles`` slot carries the SignalCards. The SAME
expected tree is asserted verbatim by the TypeScript twin (src/lib/surface-edge/stat-band.test.ts).
"""

from __future__ import annotations

from typing import Any

from morphe_grammar import validate_node
from morphe_grammar.catalog import PROMOTED_COMPOUNDS, STAT_BAND
from morphe_grammar.version import GRAMMAR_VERSION
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

FIGURES_SCHEMA: dict[str, Any] = {
    "type": "array",
    "title": "Figures",
    "x-morphe": {
        "strategy": "kpi-row",
        "heading": False,
        "gloss": "The current operating signals.",
    },
}
FIGURES_DATA: list[dict[str, object]] = [
    {
        "label": "Net",
        "value": 7,
        "kicker": "Q4",
        "gloss": "Net settled value in this period.",
        "kicker_gloss": "The reporting quarter.",
    },
    # The corner-signal lever (KRA-757 §3.2): signal text + tone ride the cell.
    {
        "label": "Rail",
        "value": "bank_batch",
        "kicker": "Route",
        "signal": "Queued",
        "signal_intent": "info",
        "signal_gloss": "The batch is waiting to be sent.",
    },
]

# The SAME expected tree asserted verbatim by the TypeScript twin
# (src/lib/surface-edge/stat-band.test.ts::EXPECTED_BAND).
EXPECTED_BAND: dict[str, Any] = {
    "kind": "stack",
    "role": "section",
    "children": [
        {
            "kind": "compound",
            "name": "StatBand",
            "args": {},
            "slots": {
                "tiles": [
                    {
                        "kind": "compound",
                        "name": "SignalCard",
                        "args": {
                            "kicker": {
                                "kind": "text",
                                "value": "Q4",
                                "as": "caption",
                                "intent": "folio",
                                "gloss": "The reporting quarter.",
                            },
                            "title": {
                                "kind": "text",
                                "value": "Net",
                                "as": "subheading",
                                "gloss": "Net settled value in this period.",
                            },
                            "measure": {"kind": "number", "value": 7, "emphasis": "strong"},
                        },
                        "slots": {"signal": [], "body": []},
                    },
                    {
                        "kind": "compound",
                        "name": "SignalCard",
                        "args": {
                            "kicker": {
                                "kind": "text",
                                "value": "Route",
                                "as": "caption",
                                "intent": "folio",
                            },
                            "title": {"kind": "text", "value": "Rail", "as": "subheading"},
                            "measure": {
                                "kind": "text",
                                "value": "bank_batch",
                                "as": "body",
                                "emphasis": "strong",
                            },
                        },
                        "slots": {
                            "signal": [
                                {
                                    "kind": "status",
                                    "tone": "info",
                                    "signal": {"text": "Queued"},
                                    "gloss": "The batch is waiting to be sent.",
                                }
                            ],
                            "body": [],
                        },
                    },
                ]
            },
        }
    ],
}


def _band_payload(node: dict[str, Any]) -> dict[str, Any]:
    assert node["kind"] == "stack"
    assert node["role"] == "section"
    assert node["children"][0] == {
        "kind": "text",
        "value": "Figures",
        "as": "heading",
        "level": 1,
        "gloss": "The current operating signals.",
    }
    return node["children"][1]


def test_kpi_row_lowers_to_a_stat_band_of_signal_cards() -> None:
    node = emit_node(build_surface(FIGURES_SCHEMA, FIGURES_DATA, root=FIGURES_SCHEMA))
    validate_node(node)
    assert _band_payload(node) == EXPECTED_BAND


def test_empty_kpi_row_keeps_the_empty_collection_floor() -> None:
    node = emit_node(build_surface(FIGURES_SCHEMA, [], root=FIGURES_SCHEMA))
    validate_node(node)
    # An empty band degrades to the "No <label>." text, not an empty StatBand.
    assert _band_payload(node) == {
        "kind": "stack",
        "role": "section",
        "children": [
            {"kind": "text", "value": "No figures.", "as": "caption", "intent": "neutral"}
        ],
    }


def test_malformed_inline_kpi_glosses_degrade_without_invalid_grammar() -> None:
    node = emit_node(
        build_surface(
            FIGURES_SCHEMA,
            [
                {
                    "label": "Net",
                    "value": 7,
                    "kicker": "Q4",
                    "kicker_gloss": "\u200b",
                    "signal": "Queued",
                    "signal_gloss": "",
                }
            ],
            root=FIGURES_SCHEMA,
        )
    )
    validate_node(node)
    tile = _band_payload(node)["children"][0]["slots"]["tiles"][0]
    assert "gloss" not in tile["args"]["kicker"]
    assert "gloss" not in tile["slots"]["signal"][0]


def test_generated_catalog_registers_stat_band() -> None:
    assert "StatBand" in PROMOTED_COMPOUNDS
    assert STAT_BAND.lifecycle == "promoted"
    assert STAT_BAND.grammar_version == GRAMMAR_VERSION
    # The band owns the layout, so it carries no params; the tiles ride the one slot.
    assert set(STAT_BAND.params.properties) == set()
    # Expansion / acyclicity / depth all pass because validate_node accepts the template.
    validate_node(STAT_BAND.template)

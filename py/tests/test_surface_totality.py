from __future__ import annotations

from typing import Any

from hypothesis import given
from hypothesis import strategies as st

from morphe_grammar import validate_node
from morphe_surface.build import build_surface
from morphe_surface.emit import emit_node

_leaf = st.fixed_dictionaries({"type": st.sampled_from(["string", "integer", "boolean"])})
_schema = st.recursive(
    _leaf | st.just({"enum": ["a", "b"]}) | st.just({"type": "null"}) | st.just({}),
    lambda children: st.fixed_dictionaries(
        {
            "type": st.just("object"),
            "properties": st.dictionaries(st.text(min_size=1, max_size=6), children, max_size=4),
        },
    ),
    max_leaves=8,
)


@given(
    schema=_schema,
    data=st.none() | st.dictionaries(st.text(), st.integers(), max_size=3),
)
def test_compiler_is_total_and_valid(schema: dict[str, Any], data: object) -> None:
    # ADR-0014 D8: arbitrary schema + data never raises and always emits a valid tree.
    spec = build_surface(schema, data, root=schema)
    node = emit_node(spec)
    validate_node(node)

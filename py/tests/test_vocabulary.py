"""Grammar vocabulary-neutrality gate (KRA-825 gate 1).

The intent unions in ``morphe_grammar.models`` are the grammar's only
authored-facing intent vocabulary. Every member must come from the registered
vocabulary file (``py/morphe_grammar/vocabulary.json``) — the single source of
truth shared with the TS mirror gate (``src/lib/grammar/vocabulary.test.ts``).
An intent added to a union without registering it here fails CI; in an
agent-heavy workflow an invariant that is not a gate is a suggestion.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import get_args

from morphe_grammar.models import CoreIntent, RegisterIntent

VOCABULARY_PATH = Path(__file__).resolve().parent.parent / "morphe_grammar" / "vocabulary.json"


def _registry() -> dict[str, list[str]]:
    data = json.loads(VOCABULARY_PATH.read_text(encoding="utf-8"))
    assert isinstance(data, dict)
    return data


def _members(alias: object) -> tuple[str, ...]:
    # PEP 695 `type X = Literal[...]` aliases expose the union via __value__.
    value = getattr(alias, "__value__", alias)
    return get_args(value)


def test_core_intent_union_equals_the_registered_vocabulary() -> None:
    registry = _registry()
    assert list(_members(CoreIntent)) == registry["core"], (
        "CoreIntent must match vocabulary.json 'core' exactly (order included): "
        "register the name there in the same change, or remove it from the union"
    )


def test_register_intent_union_equals_the_registered_vocabulary() -> None:
    registry = _registry()
    assert list(_members(RegisterIntent)) == registry["register"], (
        "RegisterIntent must match vocabulary.json 'register' exactly (order included)"
    )


def test_grandfathered_names_are_a_subset_of_the_registered_vocabulary() -> None:
    registry = _registry()
    registered = set(registry["core"]) | set(registry["register"])
    grandfathered = set(registry["grandfathered_vertical"])
    assert grandfathered <= registered, (
        "grandfathered_vertical annotates registered names; a name that left the "
        "vocabulary must leave the grandfather list in the same change"
    )


def test_vocabulary_has_no_duplicates_across_tiers() -> None:
    registry = _registry()
    core = registry["core"]
    register = registry["register"]
    assert len(core) == len(set(core))
    assert len(register) == len(set(register))
    assert not set(core) & set(register), "an intent name may live in exactly one tier"

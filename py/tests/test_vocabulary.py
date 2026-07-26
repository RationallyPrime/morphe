"""Grammar vocabulary-neutrality gate (KRA-825 gate 1).

The intent unions in ``morphe_grammar.models`` — and their closed producer-side
mirror in ``morphe_contracts`` (the CONTRACT §8 keyset that constrains CMS and
surface authoring) — are the only authored-facing intent vocabulary. Every
member of EVERY mirror must come from the registered vocabulary file
(``py/morphe_grammar/vocabulary.json``) — the single source of truth shared
with the TS mirror gate (``src/lib/grammar/vocabulary.test.ts``). An intent
added to one union without registering it here fails CI; in an agent-heavy
workflow an invariant that is not a gate is a suggestion.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, get_args

import pytest

if TYPE_CHECKING:
    from types import ModuleType

import morphe_contracts
from morphe_grammar import models

VOCABULARY_PATH = Path(__file__).resolve().parent.parent / "morphe_grammar" / "vocabulary.json"

# Every Python module carrying a closed intent union. A new mirror module must
# be added here in the same change that introduces it.
INTENT_UNION_MODULES = [models, morphe_contracts]


def _registry() -> dict[str, list[str]]:
    data = json.loads(VOCABULARY_PATH.read_text(encoding="utf-8"))
    assert isinstance(data, dict)
    return data


def _members(alias: object) -> tuple[str, ...]:
    # PEP 695 `type X = Literal[...]` aliases expose the union via __value__.
    value = getattr(alias, "__value__", alias)
    return get_args(value)


@pytest.mark.parametrize("module", INTENT_UNION_MODULES, ids=lambda m: m.__name__)
def test_core_intent_union_equals_the_registered_vocabulary(module: ModuleType) -> None:
    registry = _registry()
    assert list(_members(module.CoreIntent)) == registry["core"], (
        f"{module.__name__}.CoreIntent must match vocabulary.json 'core' exactly "
        "(order included): register the name there in the same change, or remove "
        "it from the union"
    )


@pytest.mark.parametrize("module", INTENT_UNION_MODULES, ids=lambda m: m.__name__)
def test_register_intent_union_equals_the_registered_vocabulary(module: ModuleType) -> None:
    registry = _registry()
    assert list(_members(module.RegisterIntent)) == registry["register"], (
        f"{module.__name__}.RegisterIntent must match vocabulary.json 'register' "
        "exactly (order included)"
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

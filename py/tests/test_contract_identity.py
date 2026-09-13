from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from morphe_grammar.contract_history import load_contract_history
from morphe_grammar.fingerprint import (
    GRAMMAR_FINGERPRINT,
    fingerprint_contract,
    grammar_contract_document,
)
from morphe_grammar.version import GRAMMAR_VERSION, version_typescript_document

KRA_831_COMMIT = "a931e2c8bcd9bcb4d157a677cf7c540dad46b75d"
KRA_831_FINGERPRINT = "sha256:11b53181bbe69b165874ea556967b43918ae52e640f427073c53fdfa990cf61f"
HISTORY_PATH = Path("py/morphe_grammar/contract_history.json")


def test_live_fingerprint_is_stable_and_exported() -> None:
    assert GRAMMAR_VERSION == "0.8.0"
    assert fingerprint_contract(grammar_contract_document()) == GRAMMAR_FINGERPRINT
    assert GRAMMAR_FINGERPRINT.startswith("sha256:")
    assert len(GRAMMAR_FINGERPRINT) == len("sha256:") + 64
    typescript = version_typescript_document()
    assert f'GRAMMAR_VERSION = "{GRAMMAR_VERSION}"' in typescript
    assert f'GRAMMAR_FINGERPRINT = "{GRAMMAR_FINGERPRINT}"' in typescript


def test_contract_history_records_current_identity_and_freezes_kra_831() -> None:
    history = load_contract_history()
    entries = history["entries"]
    versions = [entry["grammar_version"] for entry in entries]
    assert len(versions) == len(set(versions))
    assert entries[0] == {
        "grammar_version": "0.7.0",
        "fingerprint": KRA_831_FINGERPRINT,
        "source_commit": KRA_831_COMMIT,
        "issue": "KRA-831",
    }
    by_version = {entry["grammar_version"]: entry["fingerprint"] for entry in entries}
    assert GRAMMAR_VERSION in by_version
    assert by_version[GRAMMAR_VERSION] == GRAMMAR_FINGERPRINT
    committed = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    assert committed["entries"][0]["fingerprint"] == KRA_831_FINGERPRINT
    assert committed["entries"][0]["source_commit"] == KRA_831_COMMIT


def test_same_grammar_version_cannot_alias_a_changed_contract() -> None:
    document = grammar_contract_document()
    mutated = deepcopy(document)
    compounds = mutated["promoted_compounds"]
    assert isinstance(compounds, list)
    compounds.append({"name": "UnreviewedAlias", "version": "0.0.0"})
    mutated_fingerprint = fingerprint_contract(mutated)
    assert mutated_fingerprint != GRAMMAR_FINGERPRINT
    history = load_contract_history()
    recorded = next(
        entry["fingerprint"]
        for entry in history["entries"]
        if entry["grammar_version"] == GRAMMAR_VERSION
    )
    assert recorded == GRAMMAR_FINGERPRINT
    assert recorded != mutated_fingerprint

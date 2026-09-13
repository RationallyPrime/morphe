from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import TYPE_CHECKING

import morphe_grammar.fingerprint as fingerprint_mod
from morphe_grammar.contract_history import load_contract_history
from morphe_grammar.fingerprint import (
    GRAMMAR_FINGERPRINT,
    compute_grammar_fingerprint,
    fingerprint_contract,
    grammar_contract_document,
)
from morphe_grammar.fingerprint_stamp import GRAMMAR_FINGERPRINT as RELEASED_FINGERPRINT
from morphe_grammar.masks import load_mask_manifest
from morphe_grammar.version import GRAMMAR_VERSION, version_typescript_document

if TYPE_CHECKING:
    import pytest

KRA_831_COMMIT = "a931e2c8bcd9bcb4d157a677cf7c540dad46b75d"
KRA_831_FINGERPRINT = "sha256:11b53181bbe69b165874ea556967b43918ae52e640f427073c53fdfa990cf61f"
HISTORY_PATH = Path("py/morphe_grammar/contract_history.json")
STAMP_PATH = Path("py/morphe_grammar/fingerprint_stamp.py")

RELEASED_CONTRACTS: tuple[dict[str, str], ...] = (
    {
        "grammar_version": "0.7.0",
        "fingerprint": KRA_831_FINGERPRINT,
        "source_commit": KRA_831_COMMIT,
        "issue": "KRA-831",
    },
    {
        "grammar_version": "0.8.0",
        "fingerprint": "sha256:c0ecb8a72bbb22ed06c5480d7bd0700c28c3ae312a040fd68f8f2ea47f821f1c",
        "source_commit": "KRA-920",
        "issue": "KRA-920",
    },
)


def test_live_fingerprint_is_stable_and_exported() -> None:
    assert GRAMMAR_VERSION == "0.8.0"
    assert compute_grammar_fingerprint() == GRAMMAR_FINGERPRINT
    assert fingerprint_contract(grammar_contract_document()) == GRAMMAR_FINGERPRINT
    assert GRAMMAR_FINGERPRINT.startswith("sha256:")
    assert len(GRAMMAR_FINGERPRINT) == len("sha256:") + 64
    typescript = version_typescript_document()
    assert f'GRAMMAR_VERSION = "{GRAMMAR_VERSION}"' in typescript
    assert f'"{GRAMMAR_FINGERPRINT}"' in typescript


def test_exported_fingerprint_is_the_released_stamp_literal() -> None:
    assert GRAMMAR_FINGERPRINT == RELEASED_FINGERPRINT
    stamp = STAMP_PATH.read_text(encoding="utf-8")
    assert f'"{RELEASED_FINGERPRINT}"' in stamp
    assert "fingerprint_contract(" not in stamp
    assert "compute_grammar_fingerprint(" not in stamp


def test_mask_manifest_identity_uses_the_released_stamp(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        fingerprint_mod,
        "compute_grammar_fingerprint",
        lambda: "sha256:" + "0" * 64,
    )
    assert load_mask_manifest()["grammar_fingerprint"] == GRAMMAR_FINGERPRINT
    assert fingerprint_mod.GRAMMAR_FINGERPRINT == RELEASED_FINGERPRINT
    assert fingerprint_mod.compute_grammar_fingerprint() != GRAMMAR_FINGERPRINT


def test_contract_history_records_current_identity_and_freezes_every_release() -> None:
    history = load_contract_history()
    entries = history["entries"]
    versions = [entry["grammar_version"] for entry in entries]
    assert len(versions) == len(set(versions))
    assert entries == list(RELEASED_CONTRACTS)
    assert entries[-1]["grammar_version"] == GRAMMAR_VERSION
    assert entries[-1]["fingerprint"] == GRAMMAR_FINGERPRINT
    committed = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    assert committed["entries"] == list(RELEASED_CONTRACTS)


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

from __future__ import annotations

import json
from importlib.resources import files
from typing import TypedDict, cast


class ContractHistoryEntry(TypedDict):
    grammar_version: str
    fingerprint: str
    source_commit: str
    issue: str


class ContractHistoryDocument(TypedDict):
    format_version: int
    entries: list[ContractHistoryEntry]


CONTRACT_HISTORY_RESOURCE = "contract_history.json"


def load_contract_history() -> ContractHistoryDocument:
    raw = files("morphe_grammar").joinpath(CONTRACT_HISTORY_RESOURCE).read_text(encoding="utf-8")
    decoded = json.loads(raw)
    if not isinstance(decoded, dict):
        msg = "contract history must be a JSON object"
        raise TypeError(msg)
    format_version = decoded.get("format_version")
    if format_version != 1:
        msg = f"unsupported contract history format: {format_version!r}"
        raise ValueError(msg)
    entries = decoded.get("entries")
    if not isinstance(entries, list) or not entries:
        msg = "contract history must contain a non-empty entries array"
        raise ValueError(msg)
    parsed: list[ContractHistoryEntry] = []
    for index, raw_entry in enumerate(entries):
        if not isinstance(raw_entry, dict):
            msg = f"contract history entry {index} must be an object"
            raise TypeError(msg)
        grammar_version = raw_entry.get("grammar_version")
        fingerprint = raw_entry.get("fingerprint")
        source_commit = raw_entry.get("source_commit")
        issue = raw_entry.get("issue")
        if not all(
            isinstance(value, str) and value
            for value in (grammar_version, fingerprint, source_commit, issue)
        ):
            msg = f"contract history entry {index} is missing required string fields"
            raise ValueError(msg)
        parsed.append(
            {
                "grammar_version": cast("str", grammar_version),
                "fingerprint": cast("str", fingerprint),
                "source_commit": cast("str", source_commit),
                "issue": cast("str", issue),
            }
        )
    return {"format_version": 1, "entries": parsed}


__all__ = [
    "CONTRACT_HISTORY_RESOURCE",
    "ContractHistoryDocument",
    "ContractHistoryEntry",
    "load_contract_history",
]

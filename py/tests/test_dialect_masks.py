from __future__ import annotations

import json
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
from typing import TYPE_CHECKING, cast

import pytest

from morphe_grammar import dialects, masks

if TYPE_CHECKING:
    from collections.abc import Callable

from morphe_grammar.artifacts import ARTIFACT_PATHS, artifact_documents
from morphe_grammar.catalog import (
    PROMOTED_COMPOUNDS,
    SIGNAL_CARD,
    catalog_typescript_document,
)
from morphe_grammar.dialects import (
    DIALECT_CONSTRAINTS,
    DIALECT_IDS,
    constraints_typescript_document,
    dialect_constraint,
    validate_node_for_dialect,
)
from morphe_grammar.masks import (
    PACKAGE_MASK_MANIFEST_PATH,
    ROOT_MASK_MANIFEST_PATH,
    dialect_mask_document,
    dialect_mask_path,
    load_dialect_mask,
    load_mask_manifest,
    mask_manifest_document,
    package_dialect_mask_path,
)
from morphe_grammar.models import validate_node
from morphe_grammar.schema import JsonSchema, schema_document
from morphe_grammar.version import GRAMMAR_VERSION, version_typescript_document
from morphe_grammar.wire import DecisionRequest, decision_schema_document


def _object(value: object) -> dict[str, object]:
    assert isinstance(value, dict)
    return cast("dict[str, object]", value)


def _definitions(document: JsonSchema) -> dict[str, object]:
    return _object(document["$defs"])


def test_signal_card_is_a_neutral_promoted_compound() -> None:
    assert tuple(PROMOTED_COMPOUNDS) == ("SignalCard",)
    assert SIGNAL_CARD.lifecycle == "promoted"
    assert SIGNAL_CARD.grammar_version == GRAMMAR_VERSION
    assert set(SIGNAL_CARD.params.properties) == {"kicker", "title", "measure"}
    assert SIGNAL_CARD.params.properties["kicker"].required is True
    assert SIGNAL_CARD.params.properties["title"].required is True
    assert SIGNAL_CARD.params.properties["measure"].required is False
    validate_node(SIGNAL_CARD.template)

    payload = SIGNAL_CARD.template.model_dump(mode="json", by_alias=True, exclude_none=True)
    assert payload["kind"] == "frame"
    assert payload["role"] == "panel"
    assert "persona" not in payload


def test_only_clinical_is_restricted_and_others_remain_explicitly_unrestricted() -> None:
    assert DIALECT_IDS == (
        "icelandic-archive",
        "clinical",
        "reykjavik-registry",
        "timaeus",
        "gallery",
        "night",
        "ledger",
        "estate",
        "foundry",
    )
    assert tuple(DIALECT_CONSTRAINTS) == DIALECT_IDS
    assert DIALECT_CONSTRAINTS["clinical"].mode == "allowlist"
    assert DIALECT_CONSTRAINTS["clinical"].compounds == ("SignalCard",)

    for dialect_id in DIALECT_IDS:
        if dialect_id != "clinical":
            assert DIALECT_CONSTRAINTS[dialect_id].mode == "unrestricted"
            assert DIALECT_CONSTRAINTS[dialect_id].compounds == ()


def test_unknown_dialect_is_rejected() -> None:
    with pytest.raises(ValueError, match="unknown Morphe dialect"):
        dialect_constraint("invented")


def test_decision_request_wire_owns_the_shipped_dialect_set() -> None:
    request = DecisionRequest.model_validate(
        {
            "task_state": {},
            "event": {"tier": "fast", "name": "surface.requested"},
            "digest": {},
            "dialect_id": "clinical",
            "surface_id": "wire-proof",
        }
    )
    assert request.dialect_id == "clinical"
    with pytest.raises(ValueError, match="dialect_id"):
        DecisionRequest.model_validate(
            {
                "task_state": {},
                "event": {"tier": "fast", "name": "surface.requested"},
                "digest": {},
                "dialect_id": "invented",
                "surface_id": "wire-proof",
            }
        )

    definitions = _definitions(decision_schema_document())
    decision_request = _object(definitions["DecisionRequest"])
    properties = _object(decision_request["properties"])
    dialect_schema = _object(properties["dialect_id"])
    assert dialect_schema["$ref"] == "#/$defs/DialectId"
    assert _object(definitions["DialectId"])["enum"] == list(DIALECT_IDS)


def _signal_card() -> dict[str, object]:
    return {
        "kind": "compound",
        "name": "SignalCard",
        "args": {
            "kicker": {"kind": "text", "value": "Signal", "as": "caption"},
            "title": {"kind": "text", "value": "System health", "as": "heading"},
        },
        "slots": {"body": [{"kind": "text", "value": "All checks passed.", "as": "body"}]},
    }


def test_dialect_validator_accepts_allowed_compound_and_preserves_unrestricted_mode() -> None:
    assert validate_node_for_dialect(_signal_card(), "clinical").kind == "compound"
    arbitrary = {"kind": "compound", "name": "ConsumerOwned", "args": {}}
    assert validate_node_for_dialect(arbitrary, "gallery").kind == "compound"


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (lambda node: node.update(name="ConsumerOwned"), "DIALECT_COMPOUND_NOT_ALLOWED"),
        (lambda node: _object(node["args"]).pop("title"), "DIALECT_COMPOUND_MISSING_ARG"),
        (lambda node: _object(node["args"]).update(extra=True), "DIALECT_COMPOUND_UNKNOWN_ARG"),
        (lambda node: _object(node["args"]).update(kicker="not-a-node"), "DIALECT_NODE_SHAPE"),
        (
            lambda node: _object(node["slots"]).update(unknown=[]),
            "DIALECT_COMPOUND_UNKNOWN_SLOT",
        ),
    ],
)
def test_dialect_validator_rejects_compound_contract_violations(
    mutate: Callable[[dict[str, object]], object],
    code: str,
) -> None:
    node = _signal_card()
    mutate(node)
    with pytest.raises(ValueError, match=code):
        validate_node_for_dialect(node, "clinical")


def test_dialect_validator_recurses_through_node_args_and_slot_fills() -> None:
    for location in ("kicker", "slot"):
        node = _signal_card()
        nested = {"kind": "compound", "name": "ConsumerOwned", "args": {}}
        if location == "kicker":
            _object(node["args"])["kicker"] = nested
        else:
            _object(node["slots"])["body"] = [nested]
        with pytest.raises(ValueError, match="DIALECT_COMPOUND_NOT_ALLOWED"):
            validate_node_for_dialect(node, "clinical")


def test_dialect_validator_recurses_through_targeted_within() -> None:
    node = {
        "kind": "within",
        "id": "restricted-target",
        "dimension": "density",
        "range": [0, 2],
        "default": 1,
        "target": {"kind": "compound", "name": "ConsumerOwned", "args": {}},
    }

    with pytest.raises(ValueError, match=r"DIALECT_COMPOUND_NOT_ALLOWED at \$\.target\.name"):
        validate_node_for_dialect(node, "clinical")


def test_dialect_validator_validates_structural_tree_only_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = dialects.validate_node
    calls = 0

    def counted(payload: object) -> object:
        nonlocal calls
        calls += 1
        return original(payload)

    monkeypatch.setattr(dialects, "validate_node", counted)
    payload: dict[str, object] = {"kind": "text", "value": "leaf"}
    for _ in range(32):
        payload = {
            "kind": "frame",
            "role": "section",
            "children": [payload],
        }

    validate_node_for_dialect(payload, "clinical")

    assert calls == 1


def test_clinical_mask_replaces_generic_compounds_with_exact_signal_card_shape() -> None:
    document = dialect_mask_document("clinical")
    definitions = _definitions(document)
    compound_union = _object(definitions["CompoundRef"])
    options = compound_union["oneOf"]
    assert options == [{"$ref": "#/$defs/CompoundRef_SignalCard"}]

    signal_card = _object(definitions["CompoundRef_SignalCard"])
    properties = _object(signal_card["properties"])
    assert _object(properties["name"])["const"] == "SignalCard"

    args = _object(properties["args"])
    assert args["additionalProperties"] is False
    assert args["required"] == ["kicker", "title"]
    arg_properties = _object(args["properties"])
    assert _object(arg_properties["kicker"])["$ref"] == "#/$defs/Node"
    assert _object(arg_properties["title"])["$ref"] == "#/$defs/Node"
    assert _object(arg_properties["measure"])["$ref"] == "#/$defs/Node"

    slots = _object(properties["slots"])
    assert slots["additionalProperties"] is False
    assert set(_object(slots["properties"])) == {"body"}

    assert document["x-morphe-compound-policy"] == {
        "mode": "allowlist",
        "compounds": ["SignalCard"],
    }


def test_unrestricted_mask_retains_the_generic_compound_contract() -> None:
    full = schema_document()
    gallery = dialect_mask_document("gallery")

    full_compound = _object(_definitions(full)["CompoundRef"])
    gallery_compound = _object(_definitions(gallery)["CompoundRef"])
    assert gallery_compound == full_compound
    assert _object(_object(gallery_compound["properties"])["name"]) == {
        "title": "Name",
        "type": "string",
    }
    assert gallery["x-morphe-compound-policy"] == {
        "mode": "unrestricted",
        "compounds": [],
    }


def test_mask_generation_does_not_mutate_the_authoritative_full_schema() -> None:
    before = schema_document()
    snapshot = deepcopy(before)
    dialect_mask_document("clinical")
    assert before == snapshot


def test_every_dialect_mask_is_emitted_to_npm_and_python_resource_paths() -> None:
    documents = artifact_documents()
    assert documents[ROOT_MASK_MANIFEST_PATH] == documents[PACKAGE_MASK_MANIFEST_PATH]
    for dialect_id in DIALECT_IDS:
        root_path = dialect_mask_path(dialect_id)
        package_path = package_dialect_mask_path(dialect_id)
        assert root_path in ARTIFACT_PATHS
        assert package_path in ARTIFACT_PATHS
        assert documents[root_path] == documents[package_path]


def test_generated_typescript_data_is_catalog_owned() -> None:
    compounds = catalog_typescript_document()
    constraints = constraints_typescript_document()

    assert "PROMOTED_COMPOUNDS" in compounds
    assert 'name: "SignalCard"' in compounds
    assert f'grammarVersion: "{GRAMMAR_VERSION}"' in compounds
    assert "DIALECT_COMPOUND_CONSTRAINTS" in constraints
    assert "clinical:" in constraints
    assert 'mode: "allowlist"' in constraints
    assert '"SignalCard"' in constraints


def test_installed_resource_loader_resolves_manifest_and_dialect_masks() -> None:
    manifest = load_mask_manifest()
    assert manifest == mask_manifest_document()
    assert load_dialect_mask("clinical") == dialect_mask_document("clinical")
    assert load_dialect_mask("gallery") == dialect_mask_document("gallery")


def test_installed_resource_loader_rejects_unknown_manifest_format(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    manifest = mask_manifest_document()
    manifest["format_version"] = 2
    resource = tmp_path / "schemas" / "masks" / "manifest.json"
    resource.parent.mkdir(parents=True)
    resource.write_text(json.dumps(manifest), encoding="utf-8")
    monkeypatch.setattr(masks, "files", lambda _: tmp_path)

    with pytest.raises(ValueError, match="format version mismatch"):
        load_mask_manifest()


def test_manifest_records_paths_and_policies_without_implicit_empty_semantics() -> None:
    manifest = mask_manifest_document()
    dialects = _object(manifest["dialects"])
    clinical = _object(dialects["clinical"])
    gallery = _object(dialects["gallery"])

    assert manifest["grammar_version"] == GRAMMAR_VERSION
    assert clinical["schema"] == "dialects/morphe-node.clinical.schema.json"
    assert clinical["compound_policy"] == {
        "mode": "allowlist",
        "compounds": ["SignalCard"],
    }
    assert gallery["compound_policy"] == {"mode": "unrestricted", "compounds": []}

    documents = artifact_documents()
    for dialect_id in DIALECT_IDS:
        entry = _object(dialects[dialect_id])
        payload = documents[dialect_mask_path(dialect_id)].encode()
        assert entry["sha256"] == sha256(payload).hexdigest()


def test_typescript_grammar_version_is_generated_from_python() -> None:
    assert f'GRAMMAR_VERSION = "{GRAMMAR_VERSION}"' in version_typescript_document()


def test_committed_dialect_artifacts_are_byte_stable() -> None:
    documents = artifact_documents()
    for dialect_id in DIALECT_IDS:
        for relative_path in (
            dialect_mask_path(dialect_id),
            package_dialect_mask_path(dialect_id),
        ):
            assert Path(relative_path).read_text(encoding="utf-8") == documents[relative_path]

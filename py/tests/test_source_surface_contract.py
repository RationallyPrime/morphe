from __future__ import annotations

import base64
import json
from copy import deepcopy
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, Literal, cast

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from hypothesis import given
from hypothesis import strategies as st
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from morphe_contracts import Diagnostic
from morphe_surface.authoring import morphe_hint
from morphe_surface.source import (
    JSON_SCHEMA_2020_12,
    SOURCE_SIGNATURE_CONTEXT,
    SURFACE_ID_PATTERN,
    Ed25519Attestation,
    HiddenDiagnosticError,
    JsonObject,
    JsonValue,
    SourceSeals,
    SourceSurfaceArtifactV1,
    SourceSurfaceError,
    SourceVerificationError,
    ViewModelContract,
    canonical_json_bytes,
    is_valid_surface_id,
    minimize_source_surface,
    prepare_source_surface,
    source_signature_message,
    surface_family,
    verify_source_surface,
)

_SIGNING_SEED = bytes(range(32))
_SAFE_INTEGER_MAX = (1 << 53) - 1
_ED25519_SIGNATURE_TEXT_LENGTH = 86
_FIXTURE_ROOT = Path(__file__).resolve().parents[2] / "fixtures" / "source-surface"


class AliasPayload(BaseModel):
    internal_value: str = Field(serialization_alias="publicValue")
    happened_at: datetime = Field(serialization_alias="happenedAt")
    optional_note: str | None = Field(default=None, serialization_alias="optionalNote")
    internal_secret: str = Field(
        serialization_alias="secretValue",
        json_schema_extra=morphe_hint(hidden=True),
    )


class SharedDetail(BaseModel):
    public_value: str = Field(serialization_alias="visible")
    private_value: str = Field(
        serialization_alias="secret",
        json_schema_extra=morphe_hint(hidden=True),
    )


class HiddenOnly(BaseModel):
    token: str


class NestedPayload(BaseModel):
    direct: SharedDetail
    rows: list[SharedDetail]
    nullable: SharedDetail | None
    hidden_ref: SharedDetail = Field(
        serialization_alias="hiddenRef",
        json_schema_extra=morphe_hint(hidden=True),
    )
    hidden_only: HiddenOnly = Field(
        serialization_alias="hiddenOnly",
        json_schema_extra=morphe_hint(hidden=True),
    )


class MappingPayload(BaseModel):
    entries: dict[str, SharedDetail]


type PatternKey = Annotated[str, StringConstraints(pattern=r"^item-[0-9]+$")]


class PatternMappingPayload(BaseModel):
    entries: dict[PatternKey, SharedDetail]


class HiddenUnionVariant(BaseModel):
    kind: Literal["hidden"]
    shared: str = Field(json_schema_extra=morphe_hint(hidden=True))


class VisibleUnionVariant(BaseModel):
    kind: Literal["visible"]
    shared: str


class UnionPayload(BaseModel):
    item: HiddenUnionVariant | VisibleUnionVariant = Field(discriminator="kind")


class LowScoreVariant(BaseModel):
    score: int = Field(le=10)
    shared: str


class HighScoreVariant(BaseModel):
    score: int = Field(gt=10)
    shared: str = Field(json_schema_extra=morphe_hint(hidden=True))


class ConstrainedUnionPayload(BaseModel):
    item: LowScoreVariant | HighScoreVariant


class MutableIntegerPayload(BaseModel):
    count: int


def _private_key() -> Ed25519PrivateKey:
    return Ed25519PrivateKey.from_private_bytes(_SIGNING_SEED)


def _view_model() -> ViewModelContract:
    return ViewModelContract(
        id="test.alias-payload",
        revision=1,
        schema_dialect=JSON_SCHEMA_2020_12,
        hint_vocabulary="1.0.0",
    )


def _alias_payload() -> AliasPayload:
    return AliasPayload(
        internal_value="public",
        happened_at=datetime(2026, 7, 17, 12, 30, tzinfo=UTC),
        optional_note=None,
        internal_secret="NEVER-ON-THE-WIRE",  # noqa: S106 - disclosure sentinel
    )


def _nested_payload() -> NestedPayload:
    return NestedPayload(
        direct=SharedDetail(public_value="direct", private_value="DIRECT-SECRET"),
        rows=[SharedDetail(public_value="row", private_value="ROW-SECRET")],
        nullable=SharedDetail(public_value="nullable", private_value="NULLABLE-SECRET"),
        hidden_ref=SharedDetail(public_value="hidden", private_value="HIDDEN-REF-SECRET"),
        hidden_only=HiddenOnly(token="UNREACHABLE-DEFINITION"),  # noqa: S106 - sentinel
    )


def _mapping_payload() -> MappingPayload:
    return MappingPayload(
        entries={"one": SharedDetail(public_value="shown", private_value="MAP-SECRET")}
    )


def _pattern_mapping_payload() -> PatternMappingPayload:
    return PatternMappingPayload(
        entries={"item-1": SharedDetail(public_value="shown", private_value="PATTERN-SECRET")}
    )


def _raw_pair(model: BaseModel) -> tuple[JsonObject, JsonValue]:
    schema = type(model).model_json_schema(
        mode="serialization",
        by_alias=True,
        ref_template="#/$defs/{model}",
    )
    data = model.model_dump(mode="json", by_alias=True, exclude_none=False)
    return cast("JsonObject", schema), cast("JsonValue", data)


def _artifact() -> SourceSurfaceArtifactV1:
    return prepare_source_surface(
        _alias_payload(),
        issuer="test-kernel",
        surface_id="org.window:2",
        source_revision="rev-3",
        produced_at=datetime(2026, 7, 17, 12, 34, 56, tzinfo=UTC),
        valid_until=datetime(2026, 7, 17, 12, 39, 56, tzinfo=UTC),
        view_model=_view_model(),
        signing_key=_private_key(),
        key_id="test-key-1",
        required_capabilities=("capability-a",),
    )


def _object(value: object) -> dict[str, Any]:
    assert isinstance(value, dict)
    return cast("dict[str, Any]", value)


def _definition_name(node: dict[str, Any]) -> str:
    reference = node["$ref"]
    assert isinstance(reference, str)
    return reference.rsplit("/", maxsplit=1)[-1]


def _diagnostic(path: str) -> Diagnostic:
    return Diagnostic(
        code="TEST_DIAGNOSTIC",
        severity="warning",
        path=path,
        message="test diagnostic",
    )


def test_wire_models_are_strict_and_frozen() -> None:
    artifact = _artifact()
    models = (
        _view_model(),
        artifact.seals,
        artifact.attestation,
        artifact,
    )

    for model in models:
        document = model.model_dump(mode="json", by_alias=True, exclude_none=False)
        with pytest.raises(ValidationError, match="extra_forbidden"):
            type(model).model_validate({**document, "unexpected": True})

        field_name = next(iter(type(model).model_fields))
        with pytest.raises(ValidationError, match="frozen_instance"):
            setattr(model, field_name, getattr(model, field_name))


@pytest.mark.parametrize(
    "legacy_field",
    ["tree", "grammar_version", "compiler_version", "producer_version", "dialect_id"],
)
def test_source_artifact_forbids_legacy_compiler_fields(legacy_field: str) -> None:
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
    document[legacy_field] = "forbidden"

    with pytest.raises(ValidationError, match="extra_forbidden"):
        SourceSurfaceArtifactV1.model_validate(document)


def test_prepare_uses_the_exact_serialization_alias_pair() -> None:
    payload = _alias_payload()
    raw_schema, raw_data = _raw_pair(payload)
    expected_schema, expected_data, _ = minimize_source_surface(raw_schema, raw_data)

    artifact = _artifact()
    document = artifact.model_dump(mode="json", by_alias=True, exclude_none=False)

    assert artifact.schema_ == expected_schema
    assert artifact.data == expected_data
    assert document["schema"] == expected_schema
    assert "schema_" not in document
    assert expected_data == {
        "publicValue": "public",
        "happenedAt": "2026-07-17T12:30:00Z",
        "optionalNote": None,
    }
    properties = _object(expected_schema["properties"])
    assert "publicValue" in properties
    assert "happenedAt" in properties
    assert "optionalNote" in properties
    assert "internal_value" not in properties
    assert "secretValue" not in properties
    root_hint = _object(expected_schema["x-morphe"])
    assert root_hint["order"] == ["publicValue", "happenedAt", "optionalNote"]


def test_property_order_stamp_covers_composed_schema_without_explicit_object_type() -> None:
    schema: JsonObject = {
        "allOf": [{"type": "object"}],
        "properties": {
            "second": {"type": "string"},
            "first": {"type": "string"},
        },
    }
    data: JsonObject = {"second": "B", "first": "A"}

    minimized_schema, minimized_data, diagnostics = minimize_source_surface(schema, data)

    assert _object(minimized_schema["x-morphe"])["order"] == ["second", "first"]
    assert minimized_data == data
    assert diagnostics == ()


def test_composition_order_parity_fixture_stamps_the_signed_order() -> None:
    """Stamp the signed order from the shared composition-parity fixture.

    F4 (KRA-765): the fixture carries `properties` beside `allOf` with no explicit
    top-level `type: object`. Python stamps the exact signed order the TypeScript
    admission gate keys on; the TS suite (composition-parity.test.ts) admits these
    same stamped bytes and rejects them un-stamped.
    """
    fixture = json.loads((_FIXTURE_ROOT / "composition-order-v1.json").read_text(encoding="utf-8"))
    raw_schema = _object(fixture["schema"])
    # The fixture must genuinely omit an explicit object type — that is the whole
    # point of the composition path both languages key on `properties` for.
    assert "type" not in raw_schema
    assert isinstance(raw_schema["allOf"], list)

    schema = cast("JsonObject", deepcopy(raw_schema))
    data = cast("JsonValue", deepcopy(fixture["data"]))
    minimized_schema, minimized_data, diagnostics = minimize_source_surface(schema, data)

    assert _object(minimized_schema["x-morphe"])["order"] == fixture["expected_order"]
    assert minimized_data == fixture["data"]
    assert diagnostics == ()


def test_hidden_minimization_recurses_through_refs_arrays_and_nullable_shapes() -> None:
    raw_schema, raw_data = _raw_pair(_nested_payload())
    raw_properties = _object(raw_schema["properties"])
    shared_definition = _definition_name(_object(raw_properties["direct"]))
    hidden_only_definition = _definition_name(_object(raw_properties["hiddenOnly"]))

    schema, data, diagnostics = minimize_source_surface(raw_schema, raw_data)

    properties = _object(schema["properties"])
    assert set(properties) == {"direct", "rows", "nullable"}
    assert set(cast("list[str]", schema["required"])) == {"direct", "rows", "nullable"}

    definitions = _object(schema["$defs"])
    assert shared_definition in definitions
    assert hidden_only_definition not in definitions
    shared = _object(definitions[shared_definition])
    assert set(_object(shared["properties"])) == {"visible"}
    assert shared["required"] == ["visible"]
    assert _object(shared["x-morphe"])["order"] == ["visible"]

    minimized_data = _object(data)
    assert set(minimized_data) == {"direct", "rows", "nullable"}
    assert minimized_data["direct"] == {"visible": "direct"}
    assert minimized_data["rows"] == [{"visible": "row"}]
    assert minimized_data["nullable"] == {"visible": "nullable"}
    assert diagnostics == ()

    # The minimizer owns its copies: callers can retain the validated source pair for audit.
    assert "hiddenRef" in raw_properties
    assert "hiddenOnly" in raw_properties
    raw_shared = _object(_object(raw_schema["$defs"])[shared_definition])
    assert "secret" in _object(raw_shared["properties"])
    assert _object(raw_data)["rows"][0]["secret"] == "ROW-SECRET"  # noqa: S105


@pytest.mark.parametrize("payload", [_mapping_payload(), _pattern_mapping_payload()])
def test_hidden_minimization_recurses_through_mapping_value_schemas(
    payload: BaseModel,
) -> None:
    raw_schema, raw_data = _raw_pair(payload)

    schema, data, diagnostics = minimize_source_surface(
        raw_schema,
        raw_data,
        [_diagnostic("$.entries.one.visible")]
        if isinstance(payload, MappingPayload)
        else [_diagnostic("$.entries.item-1.visible")],
    )

    entries = _object(_object(data)["entries"])
    entry = _object(next(iter(entries.values())))
    assert entry == {"visible": "shown"}
    assert "secret" not in canonical_json_bytes(schema).decode()
    assert len(diagnostics) == 1


@pytest.mark.parametrize(
    ("payload", "key"),
    [(_mapping_payload(), "one"), (_pattern_mapping_payload(), "item-1")],
)
def test_diagnostics_below_hidden_mapping_values_are_rejected(
    payload: BaseModel,
    key: str,
) -> None:
    raw_schema, raw_data = _raw_pair(payload)

    with pytest.raises(HiddenDiagnosticError, match="targets pruned path"):
        minimize_source_surface(raw_schema, raw_data, [_diagnostic(f"$.entries.{key}.secret")])


def test_union_minimization_and_diagnostics_follow_the_selected_variant() -> None:
    visible = UnionPayload(item=VisibleUnionVariant(kind="visible", shared="kept"))
    visible_schema, visible_data = _raw_pair(visible)
    minimized_schema, minimized_data, diagnostics = minimize_source_surface(
        visible_schema,
        visible_data,
        [_diagnostic("$.item.shared")],
    )

    assert _object(_object(minimized_data)["item"])["shared"] == "kept"
    assert diagnostics == (_diagnostic("$.item.shared"),)
    assert canonical_json_bytes(minimized_schema)

    hidden = UnionPayload(item=HiddenUnionVariant(kind="hidden", shared="UNION-SECRET"))
    hidden_schema, hidden_data = _raw_pair(hidden)
    _, minimized_hidden_data, _ = minimize_source_surface(hidden_schema, hidden_data)
    assert "shared" not in _object(_object(minimized_hidden_data)["item"])
    with pytest.raises(HiddenDiagnosticError, match="targets pruned path"):
        minimize_source_surface(
            hidden_schema,
            hidden_data,
            [_diagnostic("$.item.shared")],
        )


def test_union_selection_honors_numeric_constraints() -> None:
    payload = ConstrainedUnionPayload(item=LowScoreVariant(score=7, shared="kept"))
    schema, data = _raw_pair(payload)

    _, minimized_data, diagnostics = minimize_source_surface(
        schema,
        data,
        [_diagnostic("$.item.shared")],
    )

    assert _object(_object(minimized_data)["item"])["shared"] == "kept"
    assert diagnostics == (_diagnostic("$.item.shared"),)


def test_visible_diagnostic_survives_hidden_minimization() -> None:
    raw_schema, raw_data = _raw_pair(_nested_payload())
    diagnostic = _diagnostic("$.rows[0].visible")

    _, _, diagnostics = minimize_source_surface(raw_schema, raw_data, [diagnostic])

    assert diagnostics == (diagnostic,)


@pytest.mark.parametrize(
    "path",
    [
        "$.direct.secret",
        "$.rows[0].secret",
        "$.nullable.secret",
        "$.hiddenRef",
        "$.hiddenRef.visible",
        "$.hiddenOnly.token",
    ],
)
def test_diagnostics_below_hidden_paths_are_rejected(path: str) -> None:
    raw_schema, raw_data = _raw_pair(_nested_payload())

    with pytest.raises(HiddenDiagnosticError, match="targets pruned path"):
        minimize_source_surface(raw_schema, raw_data, [_diagnostic(path)])


@pytest.mark.parametrize(
    "path",
    ["$.missing", "$.nullable.secret", "$.rows.secret", "$.rows[9].secret"],
)
def test_diagnostic_paths_must_resolve_against_serialized_data(path: str) -> None:
    payload = _nested_payload()
    payload.nullable = None
    raw_schema, raw_data = _raw_pair(payload)

    with pytest.raises(SourceSurfaceError, match="does not resolve against serialized data"):
        minimize_source_surface(raw_schema, raw_data, [_diagnostic(path)])


def test_timestamps_serialize_as_canonical_utc_rfc3339_seconds() -> None:
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
    document["produced_at"] = datetime(
        2026,
        7,
        17,
        14,
        34,
        56,
        tzinfo=timezone(timedelta(hours=2)),
    )
    document["valid_until"] = "2026-07-17T12:39:56Z"

    admitted = SourceSurfaceArtifactV1.model_validate(document)
    serialized = admitted.model_dump(mode="json", by_alias=True, exclude_none=False)

    assert serialized["produced_at"] == "2026-07-17T12:34:56Z"
    assert serialized["valid_until"] == "2026-07-17T12:39:56Z"


def test_wire_rejects_internal_schema_name_and_coerced_revision() -> None:
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
    document["schema_"] = document.pop("schema")
    with pytest.raises(ValidationError, match="Field required"):
        SourceSurfaceArtifactV1.model_validate_json(json.dumps(document))

    for revision in ("1", True):
        document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
        _object(document["view_model"])["revision"] = revision
        with pytest.raises(ValidationError, match="int_type"):
            SourceSurfaceArtifactV1.model_validate(document)


@pytest.mark.parametrize(
    "timestamp",
    [
        "2026-07-17T12:34:56+00:00",
        "2026-07-17T12:34:56.000Z",
        "2026-07-17t12:34:56Z",
        "2026-07-17T12:34:56z",
        datetime(2026, 7, 17, 12, 34, 56),  # noqa: DTZ001 - invalid wire input
        datetime(2026, 7, 17, 12, 34, 56, 1, tzinfo=UTC),
    ],
)
def test_noncanonical_timestamps_are_rejected(timestamp: str | datetime) -> None:
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
    document["produced_at"] = timestamp

    with pytest.raises(ValidationError):
        SourceSurfaceArtifactV1.model_validate(document)


_json_scalar = (
    st.none()
    | st.booleans()
    | st.integers(min_value=-_SAFE_INTEGER_MAX, max_value=_SAFE_INTEGER_MAX)
    | st.floats(allow_nan=False, allow_infinity=False, width=64)
    | st.text(alphabet=st.characters(exclude_categories=("Cs",)), max_size=12)
)
_json_value = st.recursive(
    _json_scalar,
    lambda children: (
        st.lists(children, max_size=4)
        | st.dictionaries(
            st.text(
                alphabet=st.characters(exclude_categories=("Cs",)),
                min_size=1,
                max_size=8,
            ),
            children,
            max_size=4,
        )
    ),
    max_leaves=12,
)


def _reverse_object_order(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        return {key: _reverse_object_order(child) for key, child in reversed(tuple(value.items()))}
    if isinstance(value, list):
        return [_reverse_object_order(child) for child in value]
    return value


@given(value=_json_value)
def test_jcs_is_invariant_to_recursive_object_insertion_order(value: JsonValue) -> None:
    assert canonical_json_bytes(value) == canonical_json_bytes(_reverse_object_order(value))


@pytest.mark.parametrize(
    "value",
    [float("nan"), float("inf"), float("-inf"), 1 << 53, -(1 << 53)],
)
def test_jcs_rejects_nonfinite_and_unsafe_numbers(value: float) -> None:
    with pytest.raises(SourceSurfaceError, match="outside the RFC 8785 JSON domain"):
        canonical_json_bytes({"number": value})


def test_jcs_accepts_safe_integer_boundaries() -> None:
    canonical_json_bytes({"low": -_SAFE_INTEGER_MAX, "high": _SAFE_INTEGER_MAX})


def test_prepare_rejects_a_model_mutated_outside_its_serialization_schema() -> None:
    payload = MutableIntegerPayload(count=1)
    payload.count = cast("Any", "not-an-integer")

    with pytest.raises(SourceSurfaceError, match="no longer valid"):
        prepare_source_surface(
            payload,
            issuer="test-kernel",
            surface_id="mutable.pane:1",
            source_revision="rev-1",
            produced_at=datetime(2026, 7, 17, 12, 34, 56, tzinfo=UTC),
            view_model=_view_model(),
            signing_key=_private_key(),
            key_id="test-key-1",
        )


def test_sign_and_offline_verify_use_a_deterministic_domain_separated_attestation() -> None:
    artifact = _artifact()
    key = _private_key()

    admitted = verify_source_surface(
        artifact,
        public_keys={(artifact.issuer, artifact.attestation.key_id): key.public_key()},
        expected_issuer="test-kernel",
        expected_surface_id="org.window:2",
    )

    assert admitted is not artifact
    assert admitted == artifact

    assert source_signature_message(artifact) == (
        f"{SOURCE_SIGNATURE_CONTEXT}{artifact.seals.testimony_sha256}".encode()
    )
    assert len(artifact.attestation.signature) == _ED25519_SIGNATURE_TEXT_LENGTH
    assert "=" not in artifact.attestation.signature
    assert _artifact().attestation.signature == artifact.attestation.signature


def test_verification_rejects_schema_content_testimony_and_signature_tampering() -> None:
    artifact = _artifact()
    public_keys = {
        (artifact.issuer, artifact.attestation.key_id): _private_key().public_key(),
    }
    original = artifact.model_dump(mode="json", by_alias=True, exclude_none=False)
    tampered_documents: list[dict[str, Any]] = []

    schema_tamper = deepcopy(original)
    _object(schema_tamper["schema"])["title"] = "tampered schema"
    tampered_documents.append(schema_tamper)

    content_tamper = deepcopy(original)
    _object(content_tamper["data"])["publicValue"] = "tampered data"
    tampered_documents.append(content_tamper)

    testimony_tamper = deepcopy(original)
    testimony_tamper["source_revision"] = "tampered revision"
    tampered_documents.append(testimony_tamper)

    # Seal-only tamper: flip a claimed seal while leaving the schema, data, and
    # signature untouched. The recomputed schema digest no longer matches the claim,
    # so the seal gate rejects it before any signature check would.
    seal_tamper = deepcopy(original)
    seals = _object(seal_tamper["seals"])
    hex_part = cast("str", seals["schema_sha256"]).split(":", 1)[1]
    seals["schema_sha256"] = f"sha256:{'1' if hex_part[0] == '0' else '0'}{hex_part[1:]}"
    tampered_documents.append(seal_tamper)

    signature_tamper = deepcopy(original)
    attestation = _object(signature_tamper["attestation"])
    signature = cast("str", attestation["signature"])
    raw_signature = bytearray(base64.urlsafe_b64decode(signature + "=="))
    raw_signature[0] ^= 1
    attestation["signature"] = base64.urlsafe_b64encode(raw_signature).decode().rstrip("=")
    tampered_documents.append(signature_tamper)

    for document in tampered_documents:
        tampered = SourceSurfaceArtifactV1.model_validate(document)
        with pytest.raises(SourceVerificationError):
            verify_source_surface(
                tampered,
                public_keys=public_keys,
                expected_issuer="test-kernel",
                expected_surface_id="org.window:2",
            )


def test_verification_rejects_untrusted_or_mismatched_identity() -> None:
    artifact = _artifact()
    trusted = {
        (artifact.issuer, artifact.attestation.key_id): _private_key().public_key(),
    }

    with pytest.raises(SourceVerificationError, match="no trusted public key"):
        verify_source_surface(
            artifact,
            public_keys={},
            expected_issuer="test-kernel",
            expected_surface_id="org.window:2",
        )
    with pytest.raises(SourceVerificationError, match="issuer does not match"):
        verify_source_surface(
            artifact,
            public_keys=trusted,
            expected_issuer="other-kernel",
            expected_surface_id="org.window:2",
        )
    with pytest.raises(SourceVerificationError, match="surface_id does not match"):
        verify_source_surface(
            artifact,
            public_keys=trusted,
            expected_issuer="test-kernel",
            expected_surface_id="other.surface:1",
        )


# --- surface_id family grammar (KRA-777) ---------------------------------------------
# The loki6 finding: the admission gate derives the surface family as the token before the
# FIRST `:`, assuming `<source>.<pane>:<instance…>`. A producer emitting
# `<source>:<pane>:…` collapses the family to `<source>`, so every pane of that source is
# same-family. The grammar closes it in three enforcing layers; these lock all three.

# The six live signed kernel vectors plus the drill-through instance shapes real ids use.
_VALID_SURFACE_IDS = (
    "krates.budget:krates-ehf",
    "krates.vendor:krates-ehf",
    "krates.profile:krates-ehf",
    "krates.trail:krates-ehf",
    "obolos.evidence:settlement-2026-07-17",
    "taxis.roster:westfjords:2026-W29",
    "taxis.roster:party-50548990",
)

_INVALID_SURFACE_IDS = (
    "krates:budget:krates-ehf",  # the collapse attack: `<source>:<pane>:…`, no family dot
    "krates.budget",  # missing the `:instance` segment
    "kratesbudget:krates-ehf",  # missing the family `.`
    "krates.budget:",  # empty instance segment
    ".budget:krates-ehf",  # empty source
    "krates.:krates-ehf",  # empty pane
    "Krates.Budget:krates-ehf",  # uppercase family token
    "krat:es.budget:krates-ehf",  # a colon inside the family token
    "",  # empty
)


@pytest.mark.parametrize("surface_id", _VALID_SURFACE_IDS)
def test_grammar_accepts_live_kernel_and_drill_through_ids(surface_id: str) -> None:
    assert is_valid_surface_id(surface_id)
    family = surface_id.split(":", 1)[0]
    assert surface_family(surface_id) == family


@pytest.mark.parametrize("surface_id", _INVALID_SURFACE_IDS)
def test_grammar_rejects_malformed_ids(surface_id: str) -> None:
    # Rejected at the runtime assertion (the parser)...
    assert not is_valid_surface_id(surface_id)
    assert surface_family(surface_id) is None


@pytest.mark.parametrize("surface_id", _INVALID_SURFACE_IDS)
def test_schema_pattern_rejects_malformed_surface_id(surface_id: str) -> None:
    # ...and at the schema layer: the model pattern refuses to admit the wire document.
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
    document["surface_id"] = surface_id
    with pytest.raises(ValidationError):
        SourceSurfaceArtifactV1.model_validate(document)


def test_model_pattern_is_the_one_published_grammar() -> None:
    schema = SourceSurfaceArtifactV1.model_json_schema()
    assert schema["properties"]["surface_id"]["pattern"] == SURFACE_ID_PATTERN


def test_verify_rejects_a_collapse_attack_pin() -> None:
    # A misconfigured `<source>:<pane>:…` pin must never reach the family compare.
    artifact = _artifact()
    trusted = {(artifact.issuer, artifact.attestation.key_id): _private_key().public_key()}
    with pytest.raises(SourceVerificationError, match="family grammar"):
        verify_source_surface(
            artifact,
            public_keys=trusted,
            expected_issuer="test-kernel",
            expected_surface_id="org:window:2",
        )


def test_verified_snapshot_is_recursively_immutable() -> None:
    artifact = _artifact()
    admitted = verify_source_surface(
        artifact,
        public_keys={(artifact.issuer, artifact.attestation.key_id): _private_key().public_key()},
        expected_issuer="test-kernel",
        expected_surface_id="org.window:2",
    )
    data = _object(admitted.data)
    schema = _object(admitted.schema_)

    with pytest.raises(TypeError, match="immutable"):
        data["publicValue"] = "mutated"
    with pytest.raises(TypeError, match="immutable"):
        _object(schema["properties"])["added"] = {"type": "string"}

    document = artifact.model_dump(mode="json", by_alias=True, exclude_none=False)
    document["diagnostics"] = [_diagnostic("$.publicValue").model_dump(mode="json")]
    parsed = SourceSurfaceArtifactV1.model_validate(document)
    with pytest.raises(ValidationError, match="frozen_instance"):
        parsed.diagnostics[0].message = "mutated"


def test_attestation_rejects_padded_or_wrong_length_base64url() -> None:
    seals = SourceSeals(
        schema_sha256="sha256:" + "0" * 64,
        content_sha256="sha256:" + "1" * 64,
        testimony_sha256="sha256:" + "2" * 64,
    )
    assert seals.schema_sha256.endswith("0" * 64)

    with pytest.raises(ValidationError):
        Ed25519Attestation(algorithm="Ed25519", key_id="key", signature="A" * 85)
    with pytest.raises(ValidationError):
        Ed25519Attestation(algorithm="Ed25519", key_id="key", signature="A" * 86 + "=")


def test_attestation_rejects_noncanonical_base64url_pad_bits() -> None:
    signature = _artifact().attestation.signature
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    final_index = alphabet.index(signature[-1])
    alternative = alphabet[(final_index & ~0b11) | ((final_index + 1) & 0b11)]
    malleated = f"{signature[:-1]}{alternative}"

    assert malleated != signature
    assert base64.urlsafe_b64decode(malleated + "==") == base64.urlsafe_b64decode(signature + "==")
    with pytest.raises(ValidationError, match="pattern"):
        Ed25519Attestation(algorithm="Ed25519", key_id="key", signature=malleated)


# ── container-position and hint-merge minimization (leak regressions) ──
# Both blockers from the 2026-07-17 PR #50 post-merge review: hidden classes
# leaked from list/tuple/union positions, and a cosmetic local hint un-hid a
# hidden class by shadowing its $ref target.


class ContainedSecret(BaseModel):
    model_config = ConfigDict(json_schema_extra=morphe_hint(hidden=True))

    ssn: str


class ListPositionPayload(BaseModel):
    title: str
    rows: list[ContainedSecret]


class TuplePositionPayload(BaseModel):
    title: str
    pair: tuple[str, ContainedSecret]


class MixedUnionPayload(BaseModel):
    title: str
    payload: str | ContainedSecret


class ShadowedHintPayload(BaseModel):
    title: str
    secret: ContainedSecret = Field(json_schema_extra=morphe_hint(label="Card"))


class OptionalHiddenPayload(BaseModel):
    title: str
    maybe: ContainedSecret | None = None


@pytest.mark.parametrize(
    ("model", "sentinel"),
    [
        (ListPositionPayload(title="t", rows=[ContainedSecret(ssn="LIST-SECRET")]), "LIST-SECRET"),
        (
            TuplePositionPayload(title="t", pair=("a", ContainedSecret(ssn="TUPLE-SECRET"))),
            "TUPLE-SECRET",
        ),
        (
            MixedUnionPayload(title="t", payload=ContainedSecret(ssn="UNION-SECRET")),
            "UNION-SECRET",
        ),
        (
            ShadowedHintPayload(title="t", secret=ContainedSecret(ssn="SHADOW-SECRET")),
            "SHADOW-SECRET",
        ),
        (
            OptionalHiddenPayload(title="t", maybe=ContainedSecret(ssn="OPTIONAL-SECRET")),
            "OPTIONAL-SECRET",
        ),
    ],
    ids=["list-items", "tuple-prefix-items", "mixed-union-value", "hint-shadowing", "optional"],
)
def test_hidden_classes_are_pruned_from_container_positions(
    model: BaseModel, sentinel: str
) -> None:
    schema, data = _raw_pair(model)
    minimized_schema, minimized_data, _ = minimize_source_surface(schema, data)

    assert sentinel not in json.dumps(minimized_data)
    assert "ssn" not in json.dumps(minimized_schema)
    assert cast("dict[str, Any]", minimized_data)["title"] == "t"


def test_mixed_union_keeps_visible_variant_and_relaxes_required() -> None:
    schema, data = _raw_pair(MixedUnionPayload(title="t", payload="visible-string"))
    minimized_schema, minimized_data, _ = minimize_source_surface(schema, data)

    assert cast("dict[str, Any]", minimized_data)["payload"] == "visible-string"
    # The hidden branch is gone from the union and the property is no longer
    # required — an instance carrying the hidden variant ships without it.
    top = cast("dict[str, Any]", minimized_schema)
    assert "payload" not in top.get("required", [])
    payload_schema = json.dumps(top["properties"]["payload"])
    assert "ssn" not in payload_schema


def test_authoring_api_cannot_express_unhide() -> None:
    # morphe_hint(hidden=False) collapses to an empty hint block
    # (exclude_defaults), so the blessed authoring path cannot un-hide a
    # hidden class — absence of a local `hidden` key defers to the $ref
    # target. This pins the fail-hidden posture of the disclosure boundary.
    assert morphe_hint(hidden=False) == {"x-morphe": {}}

    class EmptyHintOverride(BaseModel):
        title: str
        secret: ContainedSecret = Field(json_schema_extra=morphe_hint(hidden=False))

    schema, data = _raw_pair(
        EmptyHintOverride(title="t", secret=ContainedSecret(ssn="STILL-HIDDEN"))
    )
    _, minimized_data, _ = minimize_source_surface(schema, data)
    assert "STILL-HIDDEN" not in json.dumps(minimized_data)


def test_diagnostic_on_container_hidden_path_is_rejected() -> None:
    model = ListPositionPayload(title="t", rows=[ContainedSecret(ssn="LIST-SECRET")])
    schema, data = _raw_pair(model)
    diagnostic = Diagnostic(path="$.rows[0].ssn", severity="info", code="X", message="m")

    with pytest.raises(HiddenDiagnosticError):
        minimize_source_surface(schema, data, [diagnostic])


def test_container_hidden_payload_round_trips_signed_without_sentinel() -> None:
    model = ListPositionPayload(title="t", rows=[ContainedSecret(ssn="SIGNED-SECRET")])
    artifact = prepare_source_surface(
        model,
        issuer="test-kernel",
        surface_id="test.surface:1",
        source_revision="r1",
        produced_at=datetime(2026, 7, 17, 12, 30, tzinfo=UTC),
        view_model=_view_model(),
        signing_key=_private_key(),
        key_id="k1",
    )

    assert "SIGNED-SECRET" not in json.dumps(artifact.model_dump(mode="json", by_alias=True))
    verified = verify_source_surface(
        artifact,
        public_keys={("test-kernel", "k1"): _private_key().public_key()},
        expected_issuer="test-kernel",
        expected_surface_id="test.surface:1",
    )
    assert verified.seals == artifact.seals


# ── valid_until enforcement (authenticity vs liveness) ──


def test_expired_artifact_verifies_by_default_and_fails_with_clock() -> None:
    model = ListPositionPayload(title="t", rows=[])
    produced = datetime(2026, 7, 17, 12, 30, tzinfo=UTC)
    artifact = prepare_source_surface(
        model,
        issuer="test-kernel",
        surface_id="test.surface:1",
        source_revision="r1",
        produced_at=produced,
        valid_until=produced + timedelta(hours=1),
        view_model=_view_model(),
        signing_key=_private_key(),
        key_id="k1",
    )
    keys = {("test-kernel", "k1"): _private_key().public_key()}

    # Default: authenticity only — expiry is host freshness policy (§3.2 step 7).
    verify_source_surface(
        artifact,
        public_keys=keys,
        expected_issuer="test-kernel",
        expected_surface_id="test.surface:1",
    )
    # Opt-in clock: the same artifact is rejected once valid_until has passed.
    with pytest.raises(SourceVerificationError, match="expired"):
        verify_source_surface(
            artifact,
            public_keys=keys,
            expected_issuer="test-kernel",
            expected_surface_id="test.surface:1",
            now=produced + timedelta(hours=2),
        )
    verify_source_surface(
        artifact,
        public_keys=keys,
        expected_issuer="test-kernel",
        expected_surface_id="test.surface:1",
        now=produced + timedelta(minutes=30),
    )


class OverlappingUnionPayload(BaseModel):
    title: str
    payload: ContainedSecret | dict[str, object]


def test_value_matching_hidden_and_overlapping_visible_branch_fails_hidden() -> None:
    # STOP-SHIP catch on the first fix (2026-07-17): a Secret instance also
    # validates against a permissive dict branch, so requiring ALL applicable
    # branches to be hidden let it ship under its visible reading. Any hidden
    # match must drop the value — the wire cannot tell the readings apart.
    schema, data = _raw_pair(
        OverlappingUnionPayload(title="t", payload=ContainedSecret(ssn="OVERLAP-SECRET"))
    )
    _, minimized_data, _ = minimize_source_surface(schema, data)
    assert "OVERLAP-SECRET" not in json.dumps(minimized_data)

    # A value only the permissive branch can explain still ships.
    schema, data = _raw_pair(OverlappingUnionPayload(title="t", payload={"note": "visible"}))
    _, minimized_data, _ = minimize_source_surface(schema, data)
    assert cast("dict[str, Any]", minimized_data)["payload"] == {"note": "visible"}


# --- KRA-764: untrusted-ingress bounds, union-prune cost, keyword posture ---------------

from morphe_surface.source import (  # noqa: E402 - grouped with the hardening tests
    _MAX_COLLECTION_ENTRIES,
    _MAX_STRUCTURAL_DEPTH,
)


def _nested_data(structural_depth: int) -> JsonValue:
    """Return a value whose deepest scalar sits at exactly ``structural_depth``.

    ``_check_source_bounds`` seeds the root at depth 1, so a chain of
    ``structural_depth - 1`` single-key objects reaches a leaf at ``structural_depth``.
    """
    value: JsonValue = "leaf"
    for _ in range(structural_depth - 1):
        value = {"child": value}
    return value


def test_structural_depth_ceiling_is_enforced_at_the_minimizer_ingress() -> None:
    # At the ceiling the artifact minimizes (an empty schema admits any value).
    minimize_source_surface({}, _nested_data(_MAX_STRUCTURAL_DEPTH))
    # One level past it fails closed with a domain error, never a bare RecursionError.
    with pytest.raises(SourceSurfaceError, match="structural depth"):
        minimize_source_surface({}, _nested_data(_MAX_STRUCTURAL_DEPTH + 1))


def test_deeply_nested_data_admission_raises_a_domain_error() -> None:
    # Model admission is the untrusted ingress (it runs before seals/signature): a
    # hostile depth must surface a bounded parse failure there too, never a
    # RecursionError. The bound is raised inside the model validator, so Pydantic
    # surfaces it as a ValidationError carrying the domain message.
    document = _artifact().model_dump(mode="json", by_alias=True, exclude_none=False)
    document["data"] = _nested_data(_MAX_STRUCTURAL_DEPTH + 1)
    with pytest.raises(ValidationError, match="structural depth"):
        SourceSurfaceArtifactV1.model_validate(document)


def test_oversized_collection_is_rejected_before_recursion() -> None:
    oversized = cast("JsonValue", [0] * (_MAX_COLLECTION_ENTRIES + 1))
    with pytest.raises(SourceSurfaceError, match="array exceeds"):
        minimize_source_surface({}, oversized)


def _nested_union(depth: int) -> JsonObject:
    """Return ``depth`` nested double-``anyOf`` layers, every branch permissive.

    Empty branches match any value, so every layer has two applicable alternatives and
    a naive prune fans out to O(2^depth) deepcopy+recurse expansions.
    """
    node: JsonObject = {}
    for _ in range(depth):
        node = {"anyOf": [node, deepcopy(node)]}
    return node


def test_union_prune_fanout_is_bounded_by_a_loud_error() -> None:
    # 2^depth branch expansions past the budget: a pathological nested union wedges the
    # producer unless the fan-out is bounded. depth 14 → ~2^15 expansions >> the budget.
    schema = _nested_union(14)
    with pytest.raises(SourceSurfaceError, match="mixed-union pruning budget"):
        minimize_source_surface(schema, cast("JsonValue", {}))


@pytest.mark.parametrize(
    "unsupported_schema",
    [
        {"if": {"properties": {"a": {}}}, "then": {"required": ["a"]}},
        {"type": "object", "dependentSchemas": {"a": {"required": ["b"]}}},
        {"not": {"type": "string"}},
        {"$dynamicRef": "#node"},
    ],
)
def test_unsupported_applicator_keywords_are_rejected(unsupported_schema: JsonObject) -> None:
    with pytest.raises(SourceSurfaceError, match="unsupported applicator keyword"):
        minimize_source_surface(unsupported_schema, cast("JsonValue", {}))


def test_allof_field_hint_wrapping_is_still_supported() -> None:
    # Kernels emit allOf to wrap a $ref beside field-level metadata; rejecting it would
    # break a live surface. It must minimize cleanly, not be rejected as unsupported.
    schema: JsonObject = {
        "type": "object",
        "properties": {
            "wrapped": {
                "allOf": [{"$ref": "#/$defs/Inner"}],
                "title": "Wrapped",
            }
        },
        "required": ["wrapped"],
        "$defs": {
            "Inner": {
                "type": "object",
                "properties": {
                    "shown": {"type": "string"},
                    "secret": {"type": "string", "x-morphe": {"hidden": True}},
                },
                "required": ["shown", "secret"],
            }
        },
    }
    data = cast("JsonValue", {"wrapped": {"shown": "public", "secret": "HIDDEN-ALLOF"}})
    minimized_schema, minimized_data, _ = minimize_source_surface(schema, data)
    assert "HIDDEN-ALLOF" not in json.dumps(minimized_data)
    assert "secret" not in json.dumps(minimized_schema)

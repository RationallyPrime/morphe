"""Deterministic source-v1 vectors and Python compiler migration oracles.

The documents built here are generated evidence, not production kernel payloads.  The
private seeds are intentionally public test material and must never be reused outside
this fixture corpus.
"""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Literal, cast

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from pydantic import BaseModel, ConfigDict, Field

from morphe_contracts import Diagnostic
from morphe_grammar import NODE_ADAPTER, validate_node

from .authoring import KpiCell, morphe_hint
from .build import build_surface
from .compile import compile_surface
from .emit import emit_node
from .source import (
    JSON_SCHEMA_2020_12,
    SourceSurfaceArtifactV1,
    SourceSurfaceError,
    ViewModelContract,
    canonical_json_bytes,
    prepare_source_surface,
    source_content_document,
    source_signature_message,
    source_testimony_document,
    verify_source_surface,
)

if TYPE_CHECKING:
    from .source import JsonValue

_SOURCE_GOLDEN_VECTOR_PATH = "fixtures/source-surface/source-surface-v1.ed25519-vector.json"
_TAXIS_SOURCE_PATH = "fixtures/source-surface/taxis-roster.source.json"
_TAXIS_SURFACE_SPEC_PATH = "fixtures/source-surface/taxis-roster.surface-spec.json"
_TAXIS_NODE_PATH = "fixtures/source-surface/taxis-roster.node.json"
_OBOLOS_SOURCE_PATH = "fixtures/source-surface/obolos-evidence.source.json"
_OBOLOS_SURFACE_SPEC_PATH = "fixtures/source-surface/obolos-evidence.surface-spec.json"
_OBOLOS_NODE_PATH = "fixtures/source-surface/obolos-evidence.node.json"
SOURCE_CONFORMANCE_MANIFEST_PATH = "fixtures/source-surface/conformance-v1.json"

SOURCE_VECTOR_PATHS: tuple[str, ...] = (
    _SOURCE_GOLDEN_VECTOR_PATH,
    _TAXIS_SOURCE_PATH,
    _TAXIS_SURFACE_SPEC_PATH,
    _TAXIS_NODE_PATH,
    _OBOLOS_SOURCE_PATH,
    _OBOLOS_SURFACE_SPEC_PATH,
    _OBOLOS_NODE_PATH,
    SOURCE_CONFORMANCE_MANIFEST_PATH,
)

_TAXIS_SEED_HEX = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"
_OBOLOS_SEED_HEX = "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb"
_TAXIS_KEY_ID = "taxis-fixture-2026-01"
_OBOLOS_KEY_ID = "obolos-fixture-2026-01"
_TAXIS_HIDDEN_FIELD = "dispatchSecret"
_TAXIS_HIDDEN_SENTINEL = "MORPHE-HIDDEN-TAXIS-7CFE42"
_OBOLOS_HIDDEN_FIELD = "rawBankAccount"
_OBOLOS_HIDDEN_SENTINEL = "MORPHE-HIDDEN-OBOLOS-91A8DD"


class _FixtureModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        allow_inf_nan=False,
        populate_by_name=True,
    )


class _SurfaceLink(_FixtureModel):
    label: str
    href: str


class _TaxisRosterRow(_FixtureModel):
    worker_id: str = Field(alias="workerId", title="Worker ID")
    name: str = Field(title="Worker")
    state: Literal["active", "review", "paused"] = Field(
        title="Roster state",
        json_schema_extra=morphe_hint(
            strategy="status",
            intents={"active": "success", "review": "caution", "paused": "neutral"},
        ),
    )
    allocation: float = Field(
        title="Allocation",
        json_schema_extra=morphe_hint(strategy="progress", role="info"),
    )
    hourly_rate: int | None = Field(
        default=None,
        alias="hourlyRate",
        title="Hourly rate",
        json_schema_extra=morphe_hint(
            strategy="number",
            format="currency",
            currency="ISK",
        ),
    )
    profile: _SurfaceLink = Field(
        title="Worker profile",
        json_schema_extra=morphe_hint(strategy="linked-ref", role="primary-action"),
    )
    dispatch_secret: str = Field(
        alias=_TAXIS_HIDDEN_FIELD,
        json_schema_extra=morphe_hint(hidden=True),
    )


class _TaxisRoster(_FixtureModel):
    name: str = Field(title="Roster")
    window: str | None = Field(default=None, alias="windowLabel", title="Window")
    coverage: float = Field(
        title="Window coverage",
        json_schema_extra=morphe_hint(strategy="progress", role="info"),
    )
    figures: list[KpiCell] = Field(
        alias="keyFigures",
        title="Key figures",
        json_schema_extra=morphe_hint(strategy="kpi-row", heading=False),
    )
    roster: list[_TaxisRosterRow] = Field(
        alias="workers",
        title="Workers",
        json_schema_extra=morphe_hint(strategy="table"),
    )


class _EvidenceSeal(_FixtureModel):
    digest: str = Field(alias="sha256", title="Evidence digest")
    finality: Literal["verified", "pending", "rejected"] = Field(
        title="Finality",
        json_schema_extra=morphe_hint(
            strategy="status",
            intents={"verified": "success", "pending": "caution", "rejected": "caution"},
        ),
    )


class _ObolosEvidenceRow(_FixtureModel):
    evidence_id: str = Field(alias="evidenceId", title="Evidence ID")
    pseudonym: str = Field(title="Beneficiary")
    amount: float = Field(
        title="Amount",
        json_schema_extra=morphe_hint(strategy="number", format="currency", currency="EUR"),
    )
    state: Literal["sealed", "exception", "queued"] = Field(
        title="Decision",
        json_schema_extra=morphe_hint(
            strategy="badge",
            intents={"sealed": "success", "exception": "caution", "queued": "info"},
        ),
    )
    seal: _EvidenceSeal = Field(title="Seal")
    receipt: _SurfaceLink = Field(
        title="Receipt",
        json_schema_extra=morphe_hint(strategy="linked-ref", role="evidence"),
    )
    exception_note: str | None = Field(default=None, alias="exceptionNote", title="Exception")
    raw_bank_account: str = Field(
        alias=_OBOLOS_HIDDEN_FIELD,
        json_schema_extra=morphe_hint(hidden=True),
    )


class _ObolosEvidence(_FixtureModel):
    case_name: str = Field(alias="name", title="Evidence case")
    decision: Literal["settled", "review", "blocked"] = Field(
        title="Decision status",
        json_schema_extra=morphe_hint(
            strategy="status",
            intents={"settled": "success", "review": "caution", "blocked": "caution"},
        ),
    )
    figures: list[KpiCell] = Field(
        alias="keyFigures",
        title="Evidence totals",
        json_schema_extra=morphe_hint(strategy="kpi-row", heading=False),
    )
    evidence: list[_ObolosEvidenceRow] = Field(
        title="Evidence ledger",
        json_schema_extra=morphe_hint(strategy="table"),
    )
    adjustment: float | None = Field(
        default=None,
        title="Adjustment",
        json_schema_extra=morphe_hint(strategy="number", format="currency", currency="ISK"),
    )


type _Fixture = tuple[SourceSurfaceArtifactV1, Ed25519PrivateKey, str]


def source_vector_documents() -> dict[str, str]:
    """Build every checked-in source artifact, crypto vector, and Python oracle."""
    taxis = _taxis_fixture()
    obolos = _obolos_fixture()
    taxis_spec, taxis_node = source_compiler_oracles(taxis[0])
    obolos_spec, obolos_node = source_compiler_oracles(obolos[0])

    _tassert_hidden_absent(taxis[0], _TAXIS_HIDDEN_FIELD, _TAXIS_HIDDEN_SENTINEL)
    _tassert_hidden_absent(obolos[0], _OBOLOS_HIDDEN_FIELD, _OBOLOS_HIDDEN_SENTINEL)

    documents = {
        _SOURCE_GOLDEN_VECTOR_PATH: _json_document(_golden_vector(taxis)),
        _TAXIS_SOURCE_PATH: _json_document(_artifact_document(taxis[0])),
        _TAXIS_SURFACE_SPEC_PATH: _json_document(taxis_spec),
        _TAXIS_NODE_PATH: _json_document(taxis_node),
        _OBOLOS_SOURCE_PATH: _json_document(_artifact_document(obolos[0])),
        _OBOLOS_SURFACE_SPEC_PATH: _json_document(obolos_spec),
        _OBOLOS_NODE_PATH: _json_document(obolos_node),
        SOURCE_CONFORMANCE_MANIFEST_PATH: _json_document(_conformance_manifest(taxis, obolos)),
    }
    if tuple(documents) != SOURCE_VECTOR_PATHS:
        msg = "source vector path order drifted"
        raise AssertionError(msg)
    return documents


def _taxis_fixture() -> _Fixture:
    model = _TaxisRoster(
        name='Vestfirðir — "night"\nroster',
        windowLabel="2026-W29",
        coverage=0.75,
        keyFigures=[
            KpiCell(
                label="Scheduled payroll",
                value=2_450_000,
                kicker="Window",
                format="currency",
                currency="ISK",
                intent="evidence",
            ),
            KpiCell(label="Dispatch mode", value="weather hold", kicker="Operations"),
        ],
        workers=[
            _TaxisRosterRow(
                workerId="wrk-001",
                name="Arna K.",
                state="active",
                allocation=0.8,
                hourlyRate=7_950,
                profile=_SurfaceLink(label="Open Arna", href="/workers/wrk-001"),
                dispatchSecret=_TAXIS_HIDDEN_SENTINEL,
            ),
            _TaxisRosterRow(
                workerId="wrk-002",
                name="Baldur R.",
                state="review",
                allocation=0.45,
                hourlyRate=None,
                profile=_SurfaceLink(label="Open Baldur", href="/workers/wrk-002"),
                dispatchSecret=f"{_TAXIS_HIDDEN_SENTINEL}-ROW-2",
            ),
        ],
    )
    diagnostics = (
        Diagnostic(
            code="TAXIS_ROW_REVIEW",
            severity="warning",
            path="$.workers[1]",
            message="The second worker needs roster review.",
            repair_hint="Confirm the allocation before dispatch.",
        ),
        Diagnostic(
            code="TAXIS_ALLOCATION_SOURCE",
            severity="info",
            path="$.workers[0].allocation",
            message="Allocation reflects the signed planning window.",
        ),
    )
    return _prepare_fixture(
        model,
        seed_hex=_TAXIS_SEED_HEX,
        key_id=_TAXIS_KEY_ID,
        issuer="taxis",
        surface_id="taxis.roster:westfjords:2026-W29",
        source_revision="taxis-fixture-rev-0001",
        view_model_id="taxis.roster",
        produced_at=datetime(2026, 7, 17, 12, 0, 0, tzinfo=UTC),
        # Committed conformance evidence must remain replayable in future CI.
        # Freshness/expiry behavior is pinned separately with injected-clock tests.
        valid_until=None,
        diagnostics=diagnostics,
        required_capabilities=(),
    )


def _obolos_fixture() -> _Fixture:
    model = _ObolosEvidence(
        name="Settlement evidence 2026-07-17",
        decision="review",
        keyFigures=[
            KpiCell(
                label="ISK exposure",
                value=1_280_000,
                kicker="Gross",
                format="currency",
                currency="ISK",
                intent="evidence",
            ),
            KpiCell(
                label="EUR exceptions",
                value=735.5,
                kicker="Cross-border",
                format="currency",
                currency="EUR",
                intent="caution",
            ),
            KpiCell(label="Evidence rail", value="SEPA + domestic", kicker="Route"),
        ],
        evidence=[
            _ObolosEvidenceRow(
                evidenceId="ev-901",
                pseudonym="beneficiary-7Q",
                amount=512.25,
                state="sealed",
                seal=_EvidenceSeal(sha256="sha256:" + "a1" * 32, finality="verified"),
                receipt=_SurfaceLink(label="Open receipt 901", href="/evidence/ev-901"),
                exceptionNote=None,
                rawBankAccount=_OBOLOS_HIDDEN_SENTINEL,
            ),
            _ObolosEvidenceRow(
                evidenceId="ev-902",
                pseudonym="beneficiary-2M",
                amount=223.25,
                state="exception",
                seal=_EvidenceSeal(sha256="sha256:" + "b7" * 32, finality="pending"),
                receipt=_SurfaceLink(label="Open receipt 902", href="/evidence/ev-902"),
                exceptionNote="Manual FX evidence required.",
                rawBankAccount=f"{_OBOLOS_HIDDEN_SENTINEL}-ROW-2",
            ),
        ],
        adjustment=None,
    )
    diagnostics = (
        Diagnostic(
            code="OBOLOS_EXCEPTION_ROW",
            severity="warning",
            path="$.evidence[1]",
            message="This evidence row needs manual adjudication.",
            repair_hint="Attach the missing FX testimony.",
        ),
        Diagnostic(
            code="OBOLOS_AMOUNT_ROUNDING",
            severity="info",
            path="$.evidence[0].amount",
            message="The amount is represented at settlement precision.",
        ),
    )
    return _prepare_fixture(
        model,
        seed_hex=_OBOLOS_SEED_HEX,
        key_id=_OBOLOS_KEY_ID,
        issuer="obolos",
        surface_id="obolos.evidence:settlement-2026-07-17",
        source_revision="obolos-fixture-rev-0001",
        view_model_id="obolos.evidence",
        produced_at=datetime(2026, 7, 17, 12, 5, 0, tzinfo=UTC),
        valid_until=None,
        diagnostics=diagnostics,
        required_capabilities=(),
    )


def _prepare_fixture(  # noqa: PLR0913 - explicit fields pin each fixture's testimony
    model: BaseModel,
    *,
    seed_hex: str,
    key_id: str,
    issuer: str,
    surface_id: str,
    source_revision: str,
    view_model_id: str,
    produced_at: datetime,
    valid_until: datetime | None,
    diagnostics: tuple[Diagnostic, ...],
    required_capabilities: tuple[str, ...],
) -> _Fixture:
    key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(seed_hex))
    artifact = prepare_source_surface(
        model,
        issuer=issuer,
        surface_id=surface_id,
        source_revision=source_revision,
        produced_at=produced_at,
        valid_until=valid_until,
        view_model=ViewModelContract(
            id=view_model_id,
            revision=1,
            schema_dialect=JSON_SCHEMA_2020_12,
            hint_vocabulary="0.3.0",
        ),
        signing_key=key,
        key_id=key_id,
        diagnostics=diagnostics,
        required_capabilities=required_capabilities,
    )
    verify_source_surface(
        artifact,
        public_keys={(issuer, key_id): key.public_key()},
        expected_issuer=issuer,
        expected_surface_id=surface_id,
    )
    return artifact, key, seed_hex


def source_compiler_oracles(
    artifact: SourceSurfaceArtifactV1,
) -> tuple[dict[str, object], object]:
    """Rebuild the frozen Python SurfaceSpec and Node migration oracles."""
    diagnostics: dict[str, list[Diagnostic]] = {}
    for diagnostic in artifact.diagnostics:
        diagnostics.setdefault(diagnostic.path, []).append(diagnostic)
    spec = build_surface(
        artifact.schema_,
        artifact.data,
        root=artifact.schema_,
        diagnostics=diagnostics,
    )
    emitted = validate_node(emit_node(spec))
    compiled = compile_surface(
        artifact.schema_,
        artifact.data,
        diagnostics=diagnostics,
        compiled_at="2026-07-17T12:30:00Z",
    )
    if emitted != compiled.tree:
        msg = "build/emit and compile_surface produced different Node values"
        raise AssertionError(msg)
    node = NODE_ADAPTER.dump_python(
        compiled.tree,
        mode="json",
        by_alias=True,
        exclude_none=True,
    )
    return spec.model_dump(mode="json", by_alias=True, exclude_none=True), node


def _conformance_manifest(
    taxis: _Fixture,
    obolos: _Fixture,
) -> dict[str, object]:
    """Index the shared Python/TypeScript compiler corpus and its trust bindings."""
    return {
        "manifest_version": "1.0",
        "cases": [
            _conformance_case(
                "taxis-roster",
                taxis,
                paths={
                    "source": _TAXIS_SOURCE_PATH,
                    "surface_spec": _TAXIS_SURFACE_SPEC_PATH,
                    "node": _TAXIS_NODE_PATH,
                },
                hidden_field=_TAXIS_HIDDEN_FIELD,
                hidden_sentinel=_TAXIS_HIDDEN_SENTINEL,
            ),
            _conformance_case(
                "obolos-evidence",
                obolos,
                paths={
                    "source": _OBOLOS_SOURCE_PATH,
                    "surface_spec": _OBOLOS_SURFACE_SPEC_PATH,
                    "node": _OBOLOS_NODE_PATH,
                },
                hidden_field=_OBOLOS_HIDDEN_FIELD,
                hidden_sentinel=_OBOLOS_HIDDEN_SENTINEL,
            ),
        ],
    }


def _conformance_case(
    case_id: str,
    fixture: _Fixture,
    *,
    paths: dict[str, str],
    hidden_field: str,
    hidden_sentinel: str,
) -> dict[str, object]:
    artifact, key, _seed_hex = fixture
    return {
        "id": case_id,
        "paths": paths,
        "expected": {
            "issuer": artifact.issuer,
            "surface_id": artifact.surface_id,
            "key_id": artifact.attestation.key_id,
            "public_key_raw_hex": _raw_public_key_bytes(key).hex(),
        },
        "hidden": {
            "field": hidden_field,
            "sentinel": hidden_sentinel,
        },
        "allowed_differences": [],
    }


def _golden_vector(fixture: _Fixture) -> dict[str, object]:
    artifact, key, seed_hex = fixture
    public_bytes = _raw_public_key_bytes(key)
    schema_jcs = canonical_json_bytes(artifact.schema_)
    content_jcs = canonical_json_bytes(source_content_document(artifact))
    testimony_jcs = canonical_json_bytes(source_testimony_document(artifact))
    signing_message = source_signature_message(artifact)
    jcs_edge_case = {
        "\r": "Carriage return",
        "1": -0.0,
        "€": "Euro sign",
        "😀": "Astral key",
        "exponent": 1e30,
        "escaped": 'line one\nline two "quoted" \\ slash',
        "null": None,
    }
    return {
        "vector_version": "1.0",
        "description": "Public test key; never use this private seed in production.",
        "algorithm": "Ed25519",
        "key_id": artifact.attestation.key_id,
        "private_key_seed_hex": seed_hex,
        "public_key_hex": public_bytes.hex(),
        "public_key_base64url": _base64url(public_bytes),
        "artifact": _artifact_document(artifact),
        "canonical": {
            "schema_jcs_hex": schema_jcs.hex(),
            "content_jcs_hex": content_jcs.hex(),
            "testimony_jcs_hex": testimony_jcs.hex(),
            "signing_message_hex": signing_message.hex(),
        },
        "jcs_edge_case": {
            "input": jcs_edge_case,
            "canonical_hex": canonical_json_bytes(cast("JsonValue", jcs_edge_case)).hex(),
        },
        "jcs_rejection_cases": _jcs_rejection_vectors(),
        "expected": {
            "seals": artifact.seals.model_dump(mode="json"),
            "signature": artifact.attestation.signature,
        },
    }


def _jcs_rejection_vectors() -> list[dict[str, str]]:
    """Return raw JSON values that every language must reject before JCS hashing."""
    cases = (
        ("unsafe-positive-integer-token", '{"number":9007199254740992}'),
        ("unsafe-negative-integer-token", '{"number":-9007199254740992}'),
        ("lone-high-surrogate-value", r'{"nested":{"text":"\ud800"}}'),
        ("lone-low-surrogate-key", r'{"\udc00":"value"}'),
    )
    vectors: list[dict[str, str]] = []
    for name, raw_json in cases:
        value = cast("JsonValue", json.loads(raw_json))
        try:
            canonical_json_bytes(value)
        except SourceSurfaceError:
            vectors.append({"name": name, "raw_json": raw_json})
            continue
        msg = f"JCS rejection vector {name!r} was unexpectedly canonicalized"
        raise AssertionError(msg)
    return vectors


def _artifact_document(artifact: SourceSurfaceArtifactV1) -> dict[str, object]:
    return artifact.model_dump(mode="json", by_alias=True, exclude_none=False)


def _tassert_hidden_absent(
    artifact: SourceSurfaceArtifactV1,
    field_name: str,
    sentinel: str,
) -> None:
    encoded_schema = canonical_json_bytes(artifact.schema_)
    encoded_data = canonical_json_bytes(artifact.data)
    minimized_pair = encoded_schema + encoded_data
    if field_name.encode() in minimized_pair or sentinel.encode() in minimized_pair:
        msg = f"hidden fixture material escaped minimization: {field_name}"
        raise AssertionError(msg)


def _raw_public_key_bytes(key: Ed25519PrivateKey) -> bytes:
    return key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _json_document(document: object) -> str:
    return (
        json.dumps(
            document,
            allow_nan=False,
            ensure_ascii=True,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )


__all__ = [
    "SOURCE_CONFORMANCE_MANIFEST_PATH",
    "SOURCE_VECTOR_PATHS",
    "source_compiler_oracles",
    "source_vector_documents",
]

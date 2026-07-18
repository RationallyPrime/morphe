"""Source-v1 artifact preparation, minimization, and offline verification.

Untrusted-ingress hardening (design §2.2). Every recursive walk over an artifact's
schema or data runs before that artifact's seals and signature are trusted — freeze on
model admission, hidden-field minimization on the producer — so hostile input is bounded
up front and mapped to :class:`SourceSurfaceError` (or, in the verifier,
:class:`SourceVerificationError`), never a bare ``RecursionError`` or an out-of-memory
kill. The structural limits (depth 64, 50k values, 10k collection entries, 262 144-char
strings, 2 MiB encoded) match the TypeScript viewer's ``DEFAULT_SOURCE_VALIDATION_LIMITS``.

Supported schema applicators. Hidden-field minimization interprets exactly this Draft
2020-12 applicator set: ``$ref`` (local ``#/...`` only), ``properties``,
``patternProperties``, ``additionalProperties``, ``items``, ``prefixItems``, ``allOf``,
``anyOf``, ``oneOf`` (``allOf`` is what kernels emit to wrap a ``$ref`` beside field-level
hints). Applicators whose disclosure policy the walk cannot prove — ``if``/``then``/
``else``, ``dependentSchemas``/``dependentRequired``, ``not``, and dynamic references —
are rejected at validation (:func:`_reject_unsupported_schema_keywords`) rather than
silently mis-minimized: a conditional or negated subschema could gate a hidden field the
walk never visits, so the safe posture is fail-closed.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import re
from copy import deepcopy
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Annotated, Any, Literal, Self, cast

import rfc8785
from cryptography.exceptions import InvalidSignature
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticSerializationError

from morphe_contracts import Diagnostic

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Mapping
    from typing import Never, SupportsIndex

    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )

type JsonValue = None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]
type JsonObject = dict[str, JsonValue]
type Sha256 = Annotated[str, Field(pattern=r"^sha256:[0-9a-f]{64}$")]
type DiagnosticPathToken = str | int

SOURCE_SURFACE_KIND = "morphe.source-surface"
SOURCE_SURFACE_WIRE_VERSION = "1.0"
SOURCE_SIGNATURE_CONTEXT = "morphe-source-surface-v1:"
JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema"

_TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
_SIGNATURE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{85}[AQgw]$")
_PATH_SEGMENT_PATTERN = re.compile(r"\.([^.[\]]+)|\[(\d+)]")
_ED25519_SIGNATURE_BYTES = 64
_DEFINITION_REF_PARTS = 2

# --- untrusted-ingress bounds (design §2.2) ------------------------------------------
# A source artifact is untrusted until its seals and signature verify, and the recursive
# walks below run *before* that gate (freeze on model admission, minimization on the
# producer). Unbounded input would otherwise raise a bare ``RecursionError`` or exhaust
# memory instead of a domain error. Every limit is no weaker than the current artifact
# gate and matches the TypeScript viewer's ``DEFAULT_SOURCE_VALIDATION_LIMITS``.
_MAX_STRUCTURAL_DEPTH = 64
"""Deepest JSON nesting admitted in schema or data (design §2.2). Real kernel panes sit
near depth 7, so this clears every live surface with wide margin."""
_MAX_JSON_VALUES = 50_000
_MAX_COLLECTION_ENTRIES = 10_000
_MAX_STRING_CHARS = 262_144
_MAX_ENCODED_BYTES = 2 * 1024 * 1024
# Schema traversal follows local ``$ref`` edges, so its stack depth is not the JSON
# nesting depth: a chain of distinct ``$defs`` adds a frame per hop. This backstop
# converts a pathological reference chain into a domain error well before CPython's own
# recursion limit, while clearing any real depth-≤64 artifact (real traversal ≈ 15).
_MAX_TRAVERSAL_DEPTH = 256
# A mixed-union data node is pruned once per applicable branch with a ``deepcopy`` each,
# so nested unions cost O(branches^depth). This ceiling bounds the total branch
# expansions across one minimization and fails loud on a pathological union model.
_MAX_ALTERNATIVE_EXPANSIONS = 10_000

# Object-applicator keywords whose hidden-field policy this minimizer cannot reason
# about are rejected at validation rather than silently mis-minimized (a conditional or
# negated subschema could gate a hidden field the walk never visits, leaking it). The
# supported applicator set is: ``$ref``, ``properties``, ``patternProperties``,
# ``additionalProperties``, ``items``, ``prefixItems``, ``allOf``, ``anyOf``, ``oneOf``.
# Pydantic serialization schemas emit none of the rejected keywords today (verified
# against the live taxis/obolos/chreos surfaces); the rejection makes that reliance
# explicit and fail-closed for any hand-authored or future schema shape.
_UNSUPPORTED_SCHEMA_KEYWORDS: frozenset[str] = frozenset(
    {
        "if",
        "then",
        "else",
        "dependentSchemas",
        "dependentRequired",
        "not",
        "$dynamicRef",
        "$dynamicAnchor",
        "$recursiveRef",
        "$recursiveAnchor",
    }
)


class _AlternativeBudget:
    """Mutable counter bounding total mixed-union branch expansions in one minimization."""

    __slots__ = ("_remaining",)

    def __init__(self, ceiling: int = _MAX_ALTERNATIVE_EXPANSIONS) -> None:
        self._remaining = ceiling

    def spend(self) -> None:
        self._remaining -= 1
        if self._remaining < 0:
            msg = (
                "source data expands past the mixed-union pruning budget of "
                f"{_MAX_ALTERNATIVE_EXPANSIONS} branch evaluations"
            )
            raise SourceSurfaceError(msg)


def _guard_traversal_depth(depth: int) -> None:
    if depth > _MAX_TRAVERSAL_DEPTH:
        msg = f"source schema traversal exceeds the maximum depth of {_MAX_TRAVERSAL_DEPTH}"
        raise SourceSurfaceError(msg)


def _check_source_bounds(schema: JsonValue, data: JsonValue) -> None:  # noqa: C901 - one explicit branch per bound
    """Reject depth, value-count, collection, string, and size-hostile input up front.

    Iterative by construction: this gate must never itself recurse on the untrusted
    structure it is guarding. It runs before the recursive freeze/minimization walks so
    those never see input that would overflow the interpreter stack, and it maps every
    breach to a :class:`SourceSurfaceError` rather than a bare ``RecursionError`` or an
    out-of-memory kill.
    """
    values = 0
    approx_bytes = 0
    stack: list[tuple[JsonValue, int]] = [(schema, 1), (data, 1)]
    while stack:
        current, depth = stack.pop()
        values += 1
        if values > _MAX_JSON_VALUES:
            msg = f"source exceeds the maximum of {_MAX_JSON_VALUES} JSON values"
            raise SourceSurfaceError(msg)
        if depth > _MAX_STRUCTURAL_DEPTH:
            msg = f"source exceeds the maximum structural depth of {_MAX_STRUCTURAL_DEPTH}"
            raise SourceSurfaceError(msg)
        approx_bytes += 2
        if approx_bytes > _MAX_ENCODED_BYTES:
            msg = f"source exceeds the maximum encoded size of {_MAX_ENCODED_BYTES} bytes"
            raise SourceSurfaceError(msg)
        if isinstance(current, str):
            if len(current) > _MAX_STRING_CHARS:
                msg = f"source string exceeds {_MAX_STRING_CHARS} characters"
                raise SourceSurfaceError(msg)
            approx_bytes += len(current.encode("utf-8"))
        elif isinstance(current, dict):
            if len(current) > _MAX_COLLECTION_ENTRIES:
                msg = f"source object exceeds {_MAX_COLLECTION_ENTRIES} properties"
                raise SourceSurfaceError(msg)
            for key, child in current.items():
                if len(key) > _MAX_STRING_CHARS:
                    msg = f"source key exceeds {_MAX_STRING_CHARS} characters"
                    raise SourceSurfaceError(msg)
                approx_bytes += len(key.encode("utf-8"))
                stack.append((child, depth + 1))
        elif isinstance(current, list):
            if len(current) > _MAX_COLLECTION_ENTRIES:
                msg = f"source array exceeds {_MAX_COLLECTION_ENTRIES} entries"
                raise SourceSurfaceError(msg)
            stack.extend((child, depth + 1) for child in current)


def _reject_unsupported_schema_keywords(schema: JsonObject) -> None:
    """Fail closed on applicator keywords the hidden-field walk does not interpret.

    Iterative walk over every subschema object; the first unsupported keyword raises.
    Keeping this separate from ``_validate_source_schema``'s Draft check lets the
    verifier apply the same posture to authenticated schemas.
    """
    pending: list[object] = [schema]
    seen: set[int] = set()
    while pending:
        current = pending.pop()
        if isinstance(current, list):
            pending.extend(current)
            continue
        if not isinstance(current, dict):
            continue
        identity = id(current)
        if identity in seen:
            continue
        seen.add(identity)
        for keyword in current:
            if keyword in _UNSUPPORTED_SCHEMA_KEYWORDS:
                msg = (
                    f"source schema uses unsupported applicator keyword {keyword!r}; "
                    "hidden-field minimization cannot prove it discloses nothing"
                )
                raise SourceSurfaceError(msg)
        pending.extend(cast("dict[str, object]", current).values())


class SourceSurfaceError(ValueError):
    """Base error for source-artifact preparation and verification."""


class HiddenDiagnosticError(SourceSurfaceError):
    """A producer diagnostic targets data removed by hidden-field minimization."""


class SourceVerificationError(SourceSurfaceError):
    """A source artifact fails an offline seal or attestation check."""


class WireModel(BaseModel):
    """Strict immutable outer contract for source testimony."""

    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        allow_inf_nan=False,
        validate_by_alias=True,
        validate_by_name=False,
    )


class _FrozenJsonDict(dict[str, JsonValue]):
    """Runtime-compatible JSON object that rejects post-admission mutation."""

    @staticmethod
    def _reject_mutation() -> Never:
        msg = "verified source JSON is immutable"
        raise TypeError(msg)

    def __delitem__(self, _key: str, /) -> Never:
        return self._reject_mutation()

    def __ior__(self, _value: object, /) -> Never:
        return self._reject_mutation()

    def __setitem__(self, _key: str, _value: JsonValue, /) -> Never:
        return self._reject_mutation()

    def clear(self) -> Never:
        return self._reject_mutation()

    def pop(self, _key: str, _default: object = None, /) -> Never:
        return self._reject_mutation()

    def popitem(self) -> Never:
        return self._reject_mutation()

    def setdefault(self, _key: str, _default: JsonValue = None, /) -> Never:
        return self._reject_mutation()

    def update(self, *_args: object, **_kwargs: JsonValue) -> Never:
        return self._reject_mutation()

    def __deepcopy__(self, _memo: dict[int, object]) -> Self:
        return self


class _FrozenJsonList(list[JsonValue]):
    """Runtime-compatible JSON array that rejects post-admission mutation."""

    @staticmethod
    def _reject_mutation() -> Never:
        msg = "verified source JSON is immutable"
        raise TypeError(msg)

    def __delitem__(self, _index: SupportsIndex | slice, /) -> Never:
        return self._reject_mutation()

    def __iadd__(self, _value: Iterable[JsonValue], /) -> Never:
        return self._reject_mutation()

    def __imul__(self, _value: SupportsIndex, /) -> Never:
        return self._reject_mutation()

    def __setitem__(
        self,
        _index: SupportsIndex | slice,
        _value: JsonValue | Iterable[JsonValue],
        /,
    ) -> Never:
        return self._reject_mutation()

    def append(self, _value: JsonValue, /) -> Never:
        return self._reject_mutation()

    def clear(self) -> Never:
        return self._reject_mutation()

    def extend(self, _values: Iterable[JsonValue], /) -> Never:
        return self._reject_mutation()

    def insert(self, _index: SupportsIndex, _value: JsonValue, /) -> Never:
        return self._reject_mutation()

    def pop(self, _index: SupportsIndex = -1, /) -> Never:
        return self._reject_mutation()

    def remove(self, _value: JsonValue, /) -> Never:
        return self._reject_mutation()

    def reverse(self) -> Never:
        return self._reject_mutation()

    def sort(
        self,
        *,
        key: Callable[[JsonValue], object] | None = None,
        reverse: bool = False,
    ) -> Never:
        del key, reverse
        return self._reject_mutation()

    def __deepcopy__(self, _memo: dict[int, object]) -> Self:
        return self


class _FrozenDiagnostic(Diagnostic):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, frozen=True)


class ViewModelContract(WireModel):
    id: str
    revision: int = Field(ge=1, strict=True)
    schema_dialect: Literal["https://json-schema.org/draft/2020-12/schema"]
    hint_vocabulary: str


class SourceSeals(WireModel):
    schema_sha256: Sha256
    content_sha256: Sha256
    testimony_sha256: Sha256


class Ed25519Attestation(WireModel):
    algorithm: Literal["Ed25519"]
    key_id: str
    signature: str = Field(pattern=_SIGNATURE_PATTERN.pattern)

    @field_validator("signature")
    @classmethod
    def require_unpadded_ed25519_signature(cls, value: str) -> str:
        if _SIGNATURE_PATTERN.fullmatch(value) is None:
            msg = "signature must be an unpadded base64url Ed25519 signature"
            raise ValueError(msg)
        try:
            decoded = _decode_base64url(value)
        except (ValueError, binascii.Error) as error:
            msg = "signature must be valid unpadded base64url"
            raise ValueError(msg) from error
        if len(decoded) != _ED25519_SIGNATURE_BYTES:
            msg = "Ed25519 signature must decode to 64 bytes"
            raise ValueError(msg)
        if _encode_base64url(decoded) != value:
            msg = "signature must use canonical unpadded base64url"
            raise ValueError(msg)
        return value


class SourceSurfaceArtifactV1(WireModel):
    kind: Literal["morphe.source-surface"]
    wire_version: Literal["1.0"]

    issuer: str
    surface_id: str
    source_revision: str
    produced_at: datetime = Field(
        json_schema_extra={"format": "date-time", "pattern": _TIMESTAMP_PATTERN.pattern}
    )
    valid_until: datetime | None = Field(
        default=None,
        json_schema_extra={"format": "date-time", "pattern": _TIMESTAMP_PATTERN.pattern},
    )

    view_model: ViewModelContract
    schema_: JsonObject = Field(alias="schema")
    data: JsonValue
    diagnostics: tuple[Diagnostic, ...] = ()
    required_capabilities: tuple[str, ...] = ()

    seals: SourceSeals
    attestation: Ed25519Attestation

    @field_validator("produced_at", "valid_until", mode="before")
    @classmethod
    def require_canonical_timestamp_input(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            if _TIMESTAMP_PATTERN.fullmatch(value) is None:
                msg = "timestamp strings must use canonical UTC RFC 3339 second precision"
                raise ValueError(msg)
            return value
        if isinstance(value, datetime):
            if value.tzinfo is None or value.utcoffset() is None:
                msg = "timestamps must be timezone-aware"
                raise ValueError(msg)
            normalized = value.astimezone(UTC)
            if normalized.microsecond != 0:
                msg = "timestamps must use whole-second precision"
                raise ValueError(msg)
            return normalized
        msg = "timestamp must be a datetime or canonical UTC RFC 3339 string"
        raise TypeError(msg)

    @field_serializer("produced_at", when_used="json")
    def serialize_produced_at(self, value: datetime) -> str:
        return _timestamp_text(value)

    @field_serializer("valid_until", when_used="json")
    def serialize_valid_until(self, value: datetime | None) -> str | None:
        return _timestamp_text(value) if value is not None else None

    @model_validator(mode="after")
    def freeze_nested_evidence(self) -> Self:
        """Make the admitted snapshot recursively immutable for downstream compilation.

        Model admission is the untrusted ingress: this runs on any wire document parsed
        into the artifact, before seals or signatures are checked. Bound depth and size
        here so the recursive freeze below (and every downstream walk) meets input that
        cannot overflow the interpreter stack, mapping a breach to a domain error.
        """
        _check_source_bounds(self.schema_, self.data)
        object.__setattr__(self, "schema_", _freeze_json_object(self.schema_))
        object.__setattr__(self, "data", _freeze_json(self.data))
        object.__setattr__(
            self,
            "diagnostics",
            tuple(
                _FrozenDiagnostic.model_validate(
                    diagnostic.model_dump(mode="json", by_alias=True, exclude_none=False)
                )
                for diagnostic in self.diagnostics
            ),
        )
        return self


def canonical_json_bytes(value: JsonValue) -> bytes:
    """Return RFC 8785 JSON Canonicalization Scheme bytes."""
    try:
        return rfc8785.dumps(value)
    except (rfc8785.CanonicalizationError, UnicodeError, TypeError) as error:
        msg = f"value is outside the RFC 8785 JSON domain: {error}"
        raise SourceSurfaceError(msg) from error


def _freeze_json(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        return _FrozenJsonDict({key: _freeze_json(child) for key, child in value.items()})
    if isinstance(value, list):
        return _FrozenJsonList(_freeze_json(child) for child in value)
    return value


def _freeze_json_object(value: JsonObject) -> JsonObject:
    frozen = _freeze_json(value)
    if not isinstance(frozen, dict):  # pragma: no cover - helper contract
        msg = "source schema must remain a JSON object"
        raise TypeError(msg)
    return frozen


def _thaw_json(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        return {key: _thaw_json(child) for key, child in value.items()}
    if isinstance(value, list):
        return [_thaw_json(child) for child in value]
    return value


def _thaw_json_object(value: JsonObject) -> JsonObject:
    thawed = _thaw_json(value)
    if not isinstance(thawed, dict):  # pragma: no cover - helper contract
        msg = "source schema must remain a JSON object"
        raise TypeError(msg)
    return thawed


def minimize_source_surface(
    schema: JsonObject,
    data: JsonValue,
    diagnostics: tuple[Diagnostic, ...] | list[Diagnostic] = (),
) -> tuple[JsonObject, JsonValue, tuple[Diagnostic, ...]]:
    """Remove hidden schema/data fields and reject diagnostics below them."""
    # Bound the raw input before any recursive thaw walk touches it: a producer handed a
    # hostile depth or size gets a domain error, never a bare RecursionError.
    _check_source_bounds(schema, data)
    original_schema = _thaw_json_object(schema)
    original_data = _thaw_json(data)
    minimized_schema = _thaw_json_object(schema)
    minimized_data = _thaw_json(data)
    validated_diagnostics = tuple(
        Diagnostic.model_validate(diagnostic.model_dump(mode="json", exclude_none=False))
        for diagnostic in diagnostics
    )

    _validate_source_schema(original_schema)
    _reject_nonlocal_refs(original_schema)
    _prune_schema_node(minimized_schema, minimized_schema, set())
    _prune_data_node(original_schema, minimized_data, original_schema, set(), _AlternativeBudget())
    _remove_unreachable_definitions(minimized_schema)
    _stamp_property_order(minimized_schema)
    _validate_minimized_pair(minimized_schema, minimized_data)

    for diagnostic in validated_diagnostics:
        tokens = _parse_diagnostic_path(diagnostic.path)
        if not _path_resolves_data(original_data, tokens):
            msg = (
                f"diagnostic {diagnostic.code!r} does not resolve against serialized data "
                f"at {diagnostic.path!r}"
            )
            raise SourceSurfaceError(msg)
        if _path_targets_hidden(
            original_schema,
            tokens,
            original_schema,
            original_data,
            0,
            set(),
        ):
            msg = f"diagnostic {diagnostic.code!r} targets pruned path {diagnostic.path!r}"
            raise HiddenDiagnosticError(msg)

    return minimized_schema, minimized_data, validated_diagnostics


def _stamp_property_order(schema: JsonObject) -> None:
    """Authenticate visible object-field order independently of JSON member order.

    RFC 8785 deliberately sorts object members, so a signature cannot make their
    transport insertion order authoritative.  The compiler does care about field
    order.  Stamp the post-minimization order as an array (whose order *is* covered
    by JCS) before seals are computed.  Existing x-morphe keys are preserved.
    """
    pending: list[object] = [schema]
    seen: set[int] = set()
    while pending:
        current = pending.pop()
        if isinstance(current, list):
            pending.extend(current)
            continue
        if not isinstance(current, dict):
            continue
        identity = id(current)
        if identity in seen:
            continue
        seen.add(identity)

        record = cast("dict[str, JsonValue]", current)
        properties = record.get("properties")
        # Draft 2020-12 permits `properties` without an explicit `type: object`
        # (notably beside allOf/if/then composition). Such a schema still has
        # presentation-bearing fields and must authenticate their order.
        if isinstance(properties, dict):
            raw_hint = record.get("x-morphe")
            hint = dict(raw_hint) if isinstance(raw_hint, dict) else {}
            hint["order"] = list(properties)
            record["x-morphe"] = cast("JsonValue", hint)

        pending.extend(record.values())


def prepare_source_surface(  # noqa: PLR0913 - the signed envelope fields stay explicit
    model: BaseModel,
    *,
    issuer: str,
    surface_id: str,
    source_revision: str,
    produced_at: datetime,
    view_model: ViewModelContract,
    signing_key: Ed25519PrivateKey,
    key_id: str,
    valid_until: datetime | None = None,
    diagnostics: tuple[Diagnostic, ...] | list[Diagnostic] = (),
    required_capabilities: tuple[str, ...] = (),
) -> SourceSurfaceArtifactV1:
    """Serialize, minimize, seal, and sign one validated Pydantic view model."""
    raw_schema = type(model).model_json_schema(
        mode="serialization",
        by_alias=True,
        ref_template="#/$defs/{model}",
    )
    try:
        raw_data = model.model_dump(
            mode="json",
            by_alias=True,
            exclude_none=False,
            warnings="error",
        )
    except PydanticSerializationError as error:
        msg = "view model is no longer valid for its serialization schema"
        raise SourceSurfaceError(msg) from error
    schema, data, minimized_diagnostics = minimize_source_surface(
        cast("JsonObject", raw_schema),
        cast("JsonValue", raw_data),
        diagnostics,
    )

    canonical_produced_at = _canonical_datetime(produced_at)
    canonical_valid_until = _canonical_datetime(valid_until) if valid_until is not None else None
    canonical_view_model = ViewModelContract.model_validate(
        view_model.model_dump(mode="json", by_alias=True, exclude_none=False)
    )
    capabilities = tuple(required_capabilities)

    schema_sha256 = _sha256(canonical_json_bytes(schema))
    content_sha256 = _sha256(
        canonical_json_bytes(
            _content_document(data=data, diagnostics=minimized_diagnostics),
        )
    )
    testimony_sha256 = _sha256(
        canonical_json_bytes(
            _testimony_document(
                kind=SOURCE_SURFACE_KIND,
                wire_version=SOURCE_SURFACE_WIRE_VERSION,
                issuer=issuer,
                surface_id=surface_id,
                source_revision=source_revision,
                produced_at=canonical_produced_at,
                valid_until=canonical_valid_until,
                view_model=canonical_view_model,
                required_capabilities=capabilities,
                algorithm="Ed25519",
                key_id=key_id,
                schema_sha256=schema_sha256,
                content_sha256=content_sha256,
            )
        )
    )
    signature = _encode_base64url(
        signing_key.sign(_signature_message(testimony_sha256)),
    )

    return SourceSurfaceArtifactV1.model_validate(
        {
            "kind": SOURCE_SURFACE_KIND,
            "wire_version": SOURCE_SURFACE_WIRE_VERSION,
            "issuer": issuer,
            "surface_id": surface_id,
            "source_revision": source_revision,
            "produced_at": canonical_produced_at,
            "valid_until": canonical_valid_until,
            "view_model": canonical_view_model,
            "schema": schema,
            "data": data,
            "diagnostics": minimized_diagnostics,
            "required_capabilities": capabilities,
            "seals": SourceSeals(
                schema_sha256=schema_sha256,
                content_sha256=content_sha256,
                testimony_sha256=testimony_sha256,
            ),
            "attestation": Ed25519Attestation(
                algorithm="Ed25519",
                key_id=key_id,
                signature=signature,
            ),
        }
    )


def verify_source_surface(
    artifact: SourceSurfaceArtifactV1,
    *,
    public_keys: Mapping[tuple[str, str], Ed25519PublicKey],
    expected_issuer: str,
    expected_surface_id: str,
    now: datetime | None = None,
) -> SourceSurfaceArtifactV1:
    """Return the revalidated snapshot after offline identity, seal, and signature checks.

    Verification proves authenticity, not liveness: by default an expired
    artifact still verifies, because freshness/replay policy belongs to the
    host gate (design §3.2 step 7). Pass ``now`` to additionally enforce
    ``valid_until`` at this seam.
    """
    document = artifact.model_dump(mode="json", by_alias=True, exclude_none=False)
    admitted = SourceSurfaceArtifactV1.model_validate(document)

    if admitted.issuer != expected_issuer:
        msg = "source issuer does not match the expected issuer"
        raise SourceVerificationError(msg)
    if admitted.surface_id != expected_surface_id:
        msg = "surface_id does not match the requested surface"
        raise SourceVerificationError(msg)
    if (
        now is not None
        and admitted.valid_until is not None
        and _canonical_datetime(now) > admitted.valid_until
    ):
        msg = "source artifact is expired (valid_until has passed)"
        raise SourceVerificationError(msg)

    schema_sha256 = _sha256(canonical_json_bytes(admitted.schema_))
    content_sha256 = _sha256(
        canonical_json_bytes(
            _content_document(data=admitted.data, diagnostics=admitted.diagnostics),
        )
    )
    testimony_sha256 = _sha256(
        canonical_json_bytes(
            _testimony_document(
                kind=admitted.kind,
                wire_version=admitted.wire_version,
                issuer=admitted.issuer,
                surface_id=admitted.surface_id,
                source_revision=admitted.source_revision,
                produced_at=admitted.produced_at,
                valid_until=admitted.valid_until,
                view_model=admitted.view_model,
                required_capabilities=admitted.required_capabilities,
                algorithm=admitted.attestation.algorithm,
                key_id=admitted.attestation.key_id,
                schema_sha256=schema_sha256,
                content_sha256=content_sha256,
            )
        )
    )

    _require_matching_seal("schema", admitted.seals.schema_sha256, schema_sha256)
    _require_matching_seal("content", admitted.seals.content_sha256, content_sha256)
    _require_matching_seal("testimony", admitted.seals.testimony_sha256, testimony_sha256)

    key = public_keys.get((admitted.issuer, admitted.attestation.key_id))
    if key is None:
        msg = "no trusted public key matches issuer and key_id"
        raise SourceVerificationError(msg)
    try:
        signature = _decode_base64url(admitted.attestation.signature)
        key.verify(signature, _signature_message(testimony_sha256))
    except (InvalidSignature, ValueError, binascii.Error) as error:
        msg = "Ed25519 attestation verification failed"
        raise SourceVerificationError(msg) from error

    try:
        _reject_nonlocal_refs(admitted.schema_)
        _reject_unsupported_schema_keywords(admitted.schema_)
        _validate_minimized_pair(admitted.schema_, admitted.data)
    except SourceSurfaceError as error:
        msg = "authenticated source schema and data failed contract validation"
        raise SourceVerificationError(msg) from error
    return admitted


def source_testimony_document(artifact: SourceSurfaceArtifactV1) -> JsonObject:
    """Expose the exact signed testimony document for vector generation and audit."""
    return _testimony_document(
        kind=artifact.kind,
        wire_version=artifact.wire_version,
        issuer=artifact.issuer,
        surface_id=artifact.surface_id,
        source_revision=artifact.source_revision,
        produced_at=artifact.produced_at,
        valid_until=artifact.valid_until,
        view_model=artifact.view_model,
        required_capabilities=artifact.required_capabilities,
        algorithm=artifact.attestation.algorithm,
        key_id=artifact.attestation.key_id,
        schema_sha256=artifact.seals.schema_sha256,
        content_sha256=artifact.seals.content_sha256,
    )


def source_content_document(artifact: SourceSurfaceArtifactV1) -> JsonObject:
    """Expose the exact content-seal document for vector generation and audit."""
    return _content_document(data=artifact.data, diagnostics=artifact.diagnostics)


def source_signature_message(artifact: SourceSurfaceArtifactV1) -> bytes:
    """Expose the exact domain-separated attestation message."""
    return _signature_message(artifact.seals.testimony_sha256)


def _canonical_datetime(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        msg = "timestamps must be timezone-aware"
        raise SourceSurfaceError(msg)
    normalized = value.astimezone(UTC)
    if normalized.microsecond != 0:
        msg = "timestamps must use whole-second precision"
        raise SourceSurfaceError(msg)
    return normalized


def _timestamp_text(value: datetime) -> str:
    canonical = _canonical_datetime(value)
    return canonical.strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def _encode_base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode_base64url(value: str) -> bytes:
    if "=" in value:
        msg = "base64url value must be unpadded"
        raise ValueError(msg)
    padding = "=" * (-len(value) % 4)
    return base64.b64decode(value + padding, altchars=b"-_", validate=True)


def _signature_message(testimony_sha256: str) -> bytes:
    return f"{SOURCE_SIGNATURE_CONTEXT}{testimony_sha256}".encode()


def _content_document(*, data: JsonValue, diagnostics: tuple[Diagnostic, ...]) -> JsonObject:
    return {
        "data": deepcopy(data),
        "diagnostics": cast(
            "JsonValue",
            [
                diagnostic.model_dump(mode="json", by_alias=True, exclude_none=False)
                for diagnostic in diagnostics
            ],
        ),
    }


def _testimony_document(  # noqa: PLR0913 - mirrors the normative testimony object
    *,
    kind: str,
    wire_version: str,
    issuer: str,
    surface_id: str,
    source_revision: str,
    produced_at: datetime,
    valid_until: datetime | None,
    view_model: ViewModelContract,
    required_capabilities: tuple[str, ...],
    algorithm: str,
    key_id: str,
    schema_sha256: str,
    content_sha256: str,
) -> JsonObject:
    return {
        "kind": kind,
        "wire_version": wire_version,
        "issuer": issuer,
        "surface_id": surface_id,
        "source_revision": source_revision,
        "produced_at": _timestamp_text(produced_at),
        "valid_until": _timestamp_text(valid_until) if valid_until is not None else None,
        "view_model": cast(
            "JsonValue",
            view_model.model_dump(mode="json", by_alias=True, exclude_none=False),
        ),
        "required_capabilities": list(required_capabilities),
        "signing": {"algorithm": algorithm, "key_id": key_id},
        "schema_sha256": schema_sha256,
        "content_sha256": content_sha256,
    }


def _require_matching_seal(name: str, claimed: str, computed: str) -> None:
    if not hmac.compare_digest(claimed, computed):
        msg = f"{name} seal does not match the canonical content"
        raise SourceVerificationError(msg)


def _reject_nonlocal_refs(schema: JsonObject) -> None:
    for reference in _iter_refs(schema):
        if not reference.startswith("#/"):
            msg = f"source schema contains non-local reference {reference!r}"
            raise SourceSurfaceError(msg)
        _resolve_local_ref(reference, schema)


def _iter_refs(value: object) -> list[str]:
    refs: list[str] = []
    pending = [value]
    seen: set[int] = set()
    while pending:
        current = pending.pop()
        if isinstance(current, dict):
            record = cast("dict[str, object]", current)
            identity = id(current)
            if identity in seen:
                continue
            seen.add(identity)
            reference = record.get("$ref")
            if isinstance(reference, str):
                refs.append(reference)
            pending.extend(record.values())
        elif isinstance(current, list):
            pending.extend(current)
    return refs


def _resolve_local_ref(reference: str, root: JsonObject) -> dict[str, Any]:
    if not reference.startswith("#/"):
        msg = f"source schema contains non-local reference {reference!r}"
        raise SourceSurfaceError(msg)
    current: object = root
    for encoded in reference[2:].split("/"):
        token = encoded.replace("~1", "/").replace("~0", "~")
        if not isinstance(current, dict) or token not in current:
            msg = f"source schema contains unresolved reference {reference!r}"
            raise SourceSurfaceError(msg)
        current = current[token]
    if not isinstance(current, dict):
        msg = f"source schema reference is not an object {reference!r}"
        raise SourceSurfaceError(msg)
    return cast("dict[str, Any]", current)


def _hint_hidden(schema: dict[str, Any]) -> bool | None:
    """Return the explicit ``hidden`` value of a local ``x-morphe`` block, if any.

    Only an explicit ``hidden`` key counts: a local hint carrying just cosmetic
    fields (``label``, ``intents``…) must not shadow the ``$ref`` target's
    class-level ``hidden`` — local hints merge over the target, they do not
    replace it. An explicit local ``hidden: false`` is a deliberate override.
    """
    hint = schema.get("x-morphe")
    if isinstance(hint, dict) and isinstance(hint.get("hidden"), bool):
        return cast("bool", hint["hidden"])
    return None


def _effective_hidden(schema: dict[str, Any], root: JsonObject) -> bool:
    return _effective_hidden_impl(schema, root, set())


def _effective_hidden_impl(  # noqa: PLR0911 - each container shape is one explicit verdict
    schema: dict[str, Any], root: JsonObject, seen: set[int]
) -> bool:
    """Hiddenness of the value a schema position carries, container-aware.

    A position is hidden when its own merged hint says so, or when it can carry
    no visible content: an array whose ``items`` are hidden, a tuple with any
    hidden ``prefixItems`` slot (a slot cannot be dropped without changing
    arity), or a union whose every non-null branch is hidden. Mixed unions are
    NOT hidden here — their hidden branches are pruned from the schema and
    their values dropped at the data parent.
    """
    identity = id(schema)
    if identity in seen:
        return False
    seen.add(identity)

    local = _hint_hidden(schema)
    if local is not None:
        return local
    target = _semantic_target(schema, root, set())
    if target is not schema:
        target_local = _hint_hidden(target)
        if target_local is not None:
            return target_local
        schema = target

    items = schema.get("items")
    if isinstance(items, dict) and _effective_hidden_impl(
        cast("dict[str, Any]", items), root, seen
    ):
        return True
    prefix_items = schema.get("prefixItems")
    if isinstance(prefix_items, list) and any(
        isinstance(item, dict) and _effective_hidden_impl(cast("dict[str, Any]", item), root, seen)
        for item in prefix_items
    ):
        return True
    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if not isinstance(branches, list):
            continue
        non_null = [
            cast("dict[str, Any]", branch)
            for branch in branches
            if isinstance(branch, dict) and branch.get("type") != "null"
        ]
        if non_null and all(_effective_hidden_impl(branch, root, seen) for branch in non_null):
            return True
    return False


def _union_has_hidden_branch(schema: dict[str, Any], root: JsonObject) -> bool:
    """Report whether a visible union position carries at least one hidden branch."""
    reference = schema.get("$ref")
    if isinstance(reference, str):
        return _union_has_hidden_branch(_resolve_local_ref(reference, root), root)
    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if not isinstance(branches, list):
            continue
        if any(
            isinstance(branch, dict)
            and branch.get("type") != "null"
            and _effective_hidden(cast("dict[str, Any]", branch), root)
            for branch in branches
        ):
            return True
    return False


def _value_hidden_by_union(schema: dict[str, Any], value: JsonValue, root: JsonObject) -> bool:
    """Report whether a mixed-union value matches any hidden branch.

    The union itself stays visible (some branch is not hidden), but this
    particular value validates as an instance of a hidden variant — it must be
    removed from its parent exactly like a hidden property's value. ANY hidden
    match suffices: when a value satisfies both a hidden branch and an
    overlapping permissive branch (``Secret | dict[str, object]``), the wire
    cannot distinguish the two, so disclosure fails hidden rather than
    shipping the value under its visible reading.
    """
    reference = schema.get("$ref")
    if isinstance(reference, str):
        return _value_hidden_by_union(_resolve_local_ref(reference, root), value, root)
    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if not isinstance(branches, list):
            continue
        applicable = _applicable_alternatives(branches, value, root)
        if any(_effective_hidden(branch, root) for branch in applicable):
            return True
    return False


def _semantic_target(schema: dict[str, Any], root: JsonObject, seen: set[int]) -> dict[str, Any]:
    identity = id(schema)
    if identity in seen:
        return schema
    seen.add(identity)
    reference = schema.get("$ref")
    if isinstance(reference, str):
        return _semantic_target(_resolve_local_ref(reference, root), root, seen)
    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if not isinstance(branches, list):
            continue
        non_null = [
            branch
            for branch in branches
            if isinstance(branch, dict) and branch.get("type") != "null"
        ]
        if len(non_null) == 1:
            return _semantic_target(cast("dict[str, Any]", non_null[0]), root, seen)
    return schema


def _prune_schema_node(  # noqa: C901, PLR0912, PLR0915 - recursive schema keywords are explicit
    schema: dict[str, Any], root: JsonObject, seen: set[int], _depth: int = 0
) -> None:
    _guard_traversal_depth(_depth)
    identity = id(schema)
    if identity in seen:
        return
    seen.add(identity)

    reference = schema.get("$ref")
    if isinstance(reference, str):
        _prune_schema_node(_resolve_local_ref(reference, root), root, seen, _depth + 1)

    properties = schema.get("properties")
    if isinstance(properties, dict):
        required = schema.get("required")
        for name, raw_child in list(properties.items()):
            if not isinstance(raw_child, dict):
                continue
            child = cast("dict[str, Any]", raw_child)
            if _effective_hidden(child, root):
                del properties[name]
                if isinstance(required, list):
                    required[:] = [entry for entry in required if entry != name]
                continue
            # A mixed union keeps its visible branches, but an instance whose
            # value matches a hidden branch has that value removed from data —
            # so the property cannot stay required in the minimized testimony
            # (§1.4 rule 2 applies to the suppressed value).
            if _union_has_hidden_branch(child, root) and isinstance(required, list):
                required[:] = [entry for entry in required if entry != name]
            _prune_schema_node(child, root, seen, _depth + 1)

    pattern_properties = schema.get("patternProperties")
    if isinstance(pattern_properties, dict):
        for pattern, raw_child in list(pattern_properties.items()):
            if not isinstance(raw_child, dict):
                continue
            child = cast("dict[str, Any]", raw_child)
            if _effective_hidden(child, root):
                pattern_properties[pattern] = False
            else:
                _prune_schema_node(child, root, seen, _depth + 1)
    additional_properties = schema.get("additionalProperties")
    if isinstance(additional_properties, dict):
        child = cast("dict[str, Any]", additional_properties)
        if _effective_hidden(child, root):
            schema["additionalProperties"] = False
        else:
            _prune_schema_node(child, root, seen, _depth + 1)

    items = schema.get("items")
    if isinstance(items, dict):
        _prune_schema_node(cast("dict[str, Any]", items), root, seen, _depth + 1)
    prefix_items = schema.get("prefixItems")
    if isinstance(prefix_items, list):
        for item in prefix_items:
            if isinstance(item, dict):
                _prune_schema_node(cast("dict[str, Any]", item), root, seen, _depth + 1)
    # Mixed unions: drop the hidden branches from the effective schema. An
    # all-hidden union never reaches here — the enclosing position is itself
    # effectively hidden and was removed by its parent.
    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if isinstance(branches, list):
            visible: list[object] = []
            for branch in branches:
                if isinstance(branch, dict):
                    child = cast("dict[str, Any]", branch)
                    if _effective_hidden(child, root):
                        continue
                    _prune_schema_node(child, root, seen, _depth + 1)
                visible.append(branch)
            branches[:] = visible
    branches = schema.get("allOf")
    if isinstance(branches, list):
        for branch in branches:
            if isinstance(branch, dict):
                _prune_schema_node(cast("dict[str, Any]", branch), root, seen, _depth + 1)


def _prune_data_node(  # noqa: C901, PLR0912 - mirrors the schema traversal above
    schema: dict[str, Any],
    data: JsonValue,
    root: JsonObject,
    seen: set[tuple[int, int]],
    budget: _AlternativeBudget,
    _depth: int = 0,
) -> None:
    _guard_traversal_depth(_depth)
    pair = (id(schema), id(data))
    if pair in seen:
        return
    seen.add(pair)

    reference = schema.get("$ref")
    if isinstance(reference, str):
        _prune_data_node(_resolve_local_ref(reference, root), data, root, seen, budget, _depth + 1)

    if isinstance(data, dict):
        properties = schema.get("properties")
        if isinstance(properties, dict):
            for name, raw_child in properties.items():
                if not isinstance(name, str) or not isinstance(raw_child, dict):
                    continue
                child = cast("dict[str, Any]", raw_child)
                hide_value = _effective_hidden(child, root) or (
                    name in data and _value_hidden_by_union(child, data[name], root)
                )
                if hide_value:
                    data.pop(name, None)
                elif name in data:
                    _prune_data_node(child, data[name], root, seen, budget, _depth + 1)
        for name, value in list(data.items()):
            dynamic_schemas = _dynamic_value_schemas(schema, name)
            if any(_effective_hidden(child, root) for child in dynamic_schemas):
                data.pop(name, None)
                continue
            if any(_value_hidden_by_union(child, value, root) for child in dynamic_schemas):
                data.pop(name, None)
                continue
            for child in dynamic_schemas:
                _prune_data_node(child, value, root, seen, budget, _depth + 1)

    if isinstance(data, list):
        items = schema.get("items")
        if isinstance(items, dict):
            child = cast("dict[str, Any]", items)
            data[:] = [item for item in data if not _value_hidden_by_union(child, item, root)]
            for item in data:
                _prune_data_node(child, item, root, seen, budget, _depth + 1)
        prefix_items = schema.get("prefixItems")
        if isinstance(prefix_items, list):
            for index, raw_child in enumerate(prefix_items):
                if index >= len(data) or not isinstance(raw_child, dict):
                    continue
                _prune_data_node(
                    cast("dict[str, Any]", raw_child), data[index], root, seen, budget, _depth + 1
                )

    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if isinstance(branches, list):
            _prune_alternative_data(keyword, branches, data, root, seen, budget, _depth)
    branches = schema.get("allOf")
    if isinstance(branches, list):
        for branch in branches:
            if isinstance(branch, dict):
                _prune_data_node(
                    cast("dict[str, Any]", branch), data, root, seen, budget, _depth + 1
                )


def _prune_alternative_data(  # noqa: PLR0913 - mirrors the data-node traversal state
    keyword: str,
    branches: list[object],
    data: JsonValue,
    root: JsonObject,
    seen: set[tuple[int, int]],
    budget: _AlternativeBudget,
    _depth: int = 0,
) -> None:
    applicable = _applicable_alternatives(branches, data, root)
    if not applicable:
        msg = f"serialized data does not match any {keyword} branch during minimization"
        raise SourceSurfaceError(msg)

    candidates: list[JsonValue] = []
    for branch in applicable:
        # Each applicable branch is a full re-prune over a copy: charge the shared
        # budget so nested unions cannot fan out to O(branches^depth) unbounded.
        budget.spend()
        candidate = deepcopy(data)
        _prune_data_node(branch, candidate, root, set(seen), budget, _depth + 1)
        candidates.append(candidate)
    first = candidates[0]
    if any(candidate != first for candidate in candidates[1:]):
        msg = f"applicable {keyword} branches have conflicting hidden-field policy"
        raise SourceSurfaceError(msg)
    _replace_json_container(data, first)


def _applicable_alternatives(
    branches: list[object],
    data: JsonValue,
    root: JsonObject,
) -> tuple[dict[str, Any], ...]:
    return tuple(
        cast("dict[str, Any]", branch)
        for branch in branches
        if isinstance(branch, dict) and _schema_matches(cast("dict[str, Any]", branch), data, root)
    )


def _replace_json_container(target: JsonValue, replacement: JsonValue) -> None:
    if isinstance(target, dict) and isinstance(replacement, dict):
        target.clear()
        target.update(replacement)
    elif isinstance(target, list) and isinstance(replacement, list):
        target[:] = replacement


def _schema_matches(schema: dict[str, Any], data: JsonValue, root: JsonObject) -> bool:
    """Evaluate one alternative with the normative Draft 2020-12 semantics."""
    return Draft202012Validator(root).evolve(schema=schema).is_valid(data)


def _dynamic_value_schemas(schema: dict[str, Any], key: str) -> tuple[dict[str, Any], ...]:
    matched: list[dict[str, Any]] = []
    pattern_properties = schema.get("patternProperties")
    if isinstance(pattern_properties, dict):
        for pattern, raw_child in pattern_properties.items():
            if not isinstance(pattern, str) or not isinstance(raw_child, dict):
                continue
            try:
                applies = re.search(pattern, key) is not None
            except re.error as error:
                msg = f"source schema contains invalid patternProperties regex {pattern!r}"
                raise SourceSurfaceError(msg) from error
            if applies:
                matched.append(cast("dict[str, Any]", raw_child))

    properties = schema.get("properties")
    is_declared = isinstance(properties, dict) and key in properties
    if not is_declared and not matched:
        additional = schema.get("additionalProperties")
        if isinstance(additional, dict):
            matched.append(cast("dict[str, Any]", additional))
    return tuple(matched)


def _remove_unreachable_definitions(schema: JsonObject) -> None:
    definitions = schema.get("$defs")
    if not isinstance(definitions, dict):
        return

    visible_root = {key: value for key, value in schema.items() if key != "$defs"}
    reachable: set[str] = set()
    pending = _definition_names(_iter_refs(visible_root))
    while pending:
        name = pending.pop()
        if name in reachable:
            continue
        target = definitions.get(name)
        if not isinstance(target, dict):
            msg = f"source schema references missing definition {name!r}"
            raise SourceSurfaceError(msg)
        reachable.add(name)
        pending.update(_definition_names(_iter_refs(target)) - reachable)

    for name in list(definitions):
        if name not in reachable:
            del definitions[name]
    if not definitions:
        del schema["$defs"]


def _validate_minimized_pair(schema: JsonObject, data: JsonValue) -> None:
    try:
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(data)
    except (SchemaError, JsonSchemaValidationError) as error:
        msg = f"minimized data does not satisfy the minimized serialization schema: {error.message}"
        raise SourceSurfaceError(msg) from error


def _validate_source_schema(schema: JsonObject) -> None:
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as error:
        msg = f"source serialization schema is not valid Draft 2020-12: {error.message}"
        raise SourceSurfaceError(msg) from error
    _reject_unsupported_schema_keywords(schema)


def _definition_names(references: list[str]) -> set[str]:
    names: set[str] = set()
    for reference in references:
        parts = reference[2:].split("/") if reference.startswith("#/") else []
        if len(parts) >= _DEFINITION_REF_PARTS and parts[0] == "$defs":
            names.add(parts[1].replace("~1", "/").replace("~0", "~"))
    return names


def _parse_diagnostic_path(path: str) -> tuple[DiagnosticPathToken, ...]:
    if path == "$":
        return ()
    if not path.startswith("$"):
        msg = f"diagnostic path must start at '$': {path!r}"
        raise SourceSurfaceError(msg)
    tokens: list[DiagnosticPathToken] = []
    cursor = 1
    while cursor < len(path):
        match = _PATH_SEGMENT_PATTERN.match(path, cursor)
        if match is None:
            msg = f"diagnostic path has invalid syntax: {path!r}"
            raise SourceSurfaceError(msg)
        field, index = match.groups()
        tokens.append(field if field is not None else int(cast("str", index)))
        cursor = match.end()
    return tuple(tokens)


def _path_resolves_data(
    data: JsonValue,
    tokens: tuple[DiagnosticPathToken, ...],
) -> bool:
    current = data
    for token in tokens:
        if isinstance(token, str):
            if not isinstance(current, dict) or token not in current:
                return False
            current = current[token]
            continue
        if not isinstance(current, list) or token < 0 or token >= len(current):
            return False
        current = current[token]
    return True


def _path_targets_hidden(  # noqa: C901, PLR0911, PLR0912, PLR0913 - explicit traversal state
    schema: dict[str, Any],
    tokens: tuple[DiagnosticPathToken, ...],
    root: JsonObject,
    data: JsonValue,
    position: int,
    seen: set[tuple[int, int, int]],
    _depth: int = 0,
) -> bool:
    _guard_traversal_depth(_depth)
    state = (id(schema), position, id(data))
    if state in seen:
        return False
    seen.add(state)

    reference = schema.get("$ref")
    if isinstance(reference, str) and _path_targets_hidden(
        _resolve_local_ref(reference, root), tokens, root, data, position, seen, _depth + 1
    ):
        return True

    if position >= len(tokens):
        return False
    token = tokens[position]
    if isinstance(token, str):
        child_data = data.get(token) if isinstance(data, dict) else None
        properties = schema.get("properties")
        if isinstance(properties, dict):
            raw_child = properties.get(token)
            if isinstance(raw_child, dict):
                child = cast("dict[str, Any]", raw_child)
                if _effective_hidden(child, root):
                    return True
                if _path_targets_hidden(
                    child,
                    tokens,
                    root,
                    child_data,
                    position + 1,
                    seen,
                    _depth + 1,
                ):
                    return True
        for child in _dynamic_value_schemas(schema, token):
            if _effective_hidden(child, root):
                return True
            if _path_targets_hidden(
                child,
                tokens,
                root,
                child_data,
                position + 1,
                seen,
                _depth + 1,
            ):
                return True
    else:
        child_data = data[token] if isinstance(data, list) and 0 <= token < len(data) else None
        items = schema.get("items")
        if isinstance(items, dict) and _path_targets_hidden(
            cast("dict[str, Any]", items),
            tokens,
            root,
            child_data,
            position + 1,
            seen,
            _depth + 1,
        ):
            return True
        prefix_items = schema.get("prefixItems")
        if (
            isinstance(prefix_items, list)
            and token < len(prefix_items)
            and isinstance(prefix_items[token], dict)
            and _path_targets_hidden(
                cast("dict[str, Any]", prefix_items[token]),
                tokens,
                root,
                child_data,
                position + 1,
                seen,
                _depth + 1,
            )
        ):
            return True

    for keyword in ("anyOf", "oneOf"):
        branches = schema.get(keyword)
        if isinstance(branches, list):
            for branch in _applicable_alternatives(branches, data, root):
                # A value carried by a hidden branch of a mixed union is
                # removed by minimization, so a diagnostic passing through
                # it targets pruned content.
                if _effective_hidden(branch, root):
                    return True
                if _path_targets_hidden(
                    branch,
                    tokens,
                    root,
                    data,
                    position,
                    seen,
                    _depth + 1,
                ):
                    return True
    branches = schema.get("allOf")
    if isinstance(branches, list):
        for branch in branches:
            if isinstance(branch, dict) and _path_targets_hidden(
                cast("dict[str, Any]", branch),
                tokens,
                root,
                data,
                position,
                seen,
                _depth + 1,
            ):
                return True
    return False


__all__ = [
    "JSON_SCHEMA_2020_12",
    "SOURCE_SIGNATURE_CONTEXT",
    "SOURCE_SURFACE_KIND",
    "SOURCE_SURFACE_WIRE_VERSION",
    "Ed25519Attestation",
    "HiddenDiagnosticError",
    "JsonObject",
    "JsonValue",
    "Sha256",
    "SourceSeals",
    "SourceSurfaceArtifactV1",
    "SourceSurfaceError",
    "SourceVerificationError",
    "ViewModelContract",
    "WireModel",
    "canonical_json_bytes",
    "minimize_source_surface",
    "prepare_source_surface",
    "source_content_document",
    "source_signature_message",
    "source_testimony_document",
    "verify_source_surface",
]

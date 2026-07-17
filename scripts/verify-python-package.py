from __future__ import annotations

# This is an executable repository verifier, not an importable Python package module.
# ruff: noqa: INP001
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass
from hashlib import sha256
from hmac import compare_digest
from pathlib import Path, PurePosixPath
from typing import cast

type JsonValue = None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]
type JsonObject = dict[str, JsonValue]

REPO_ROOT = Path(__file__).resolve().parents[1]
RESOURCE_ROOT = REPO_ROOT / "py" / "morphe_grammar" / "schemas" / "masks"
MANIFEST_PATH = RESOURCE_ROOT / "manifest.json"
WHEEL_RESOURCE_PREFIX = PurePosixPath("morphe_grammar/schemas/masks")
SDIST_RESOURCE_PREFIX = PurePosixPath("py/morphe_grammar/schemas/masks")
SHA256_HEX_LENGTH = sha256().digest_size * 2


@dataclass(frozen=True, slots=True)
class Resource:
    relative_path: PurePosixPath
    contents: bytes


def _object(value: JsonValue, label: str) -> JsonObject:
    if not isinstance(value, dict):
        msg = f"expected {label} to be a JSON object"
        raise TypeError(msg)
    return value


def _string(value: JsonValue | None, label: str) -> str:
    if not isinstance(value, str) or not value:
        msg = f"expected {label} to be a non-empty string"
        raise TypeError(msg)
    return value


def _sha256_string(value: JsonValue | None, label: str) -> str:
    digest = _string(value, label)
    if len(digest) != SHA256_HEX_LENGTH or any(
        character not in "0123456789abcdef" for character in digest
    ):
        msg = f"{label} must be a lowercase SHA-256 digest"
        raise ValueError(msg)
    return digest


def _verify_resource_digest(path: Path, expected: str, relative_path: PurePosixPath) -> None:
    actual = sha256(path.read_bytes()).hexdigest()
    if not compare_digest(actual, expected):
        msg = f"mask resource {relative_path} disagrees with its manifest SHA-256"
        raise ValueError(msg)


def _read_json_object(path: Path) -> JsonObject:
    value = cast("JsonValue", json.loads(path.read_text(encoding="utf-8")))
    return _object(value, str(path))


def _manifest_resources() -> tuple[Resource, ...]:
    if not MANIFEST_PATH.is_file():
        msg = f"missing committed mask manifest: {MANIFEST_PATH}"
        raise FileNotFoundError(msg)

    manifest = _read_json_object(MANIFEST_PATH)
    if manifest.get("format_version") != 1:
        msg = "mask manifest format_version must be 1"
        raise ValueError(msg)
    _string(manifest.get("grammar_version"), "manifest.grammar_version")

    dialects = _object(manifest.get("dialects"), "manifest.dialects")
    if not dialects:
        msg = "mask manifest must name at least one dialect"
        raise ValueError(msg)

    declared_paths: set[PurePosixPath] = {PurePosixPath("manifest.json")}
    for dialect_id, raw_entry in dialects.items():
        entry = _object(raw_entry, f"manifest.dialects.{dialect_id}")
        relative_path = PurePosixPath(
            _string(entry.get("schema"), f"manifest.dialects.{dialect_id}.schema")
        )
        if relative_path.is_absolute() or ".." in relative_path.parts:
            msg = f"mask manifest path escapes its resource root: {relative_path}"
            raise ValueError(msg)
        if relative_path in declared_paths:
            msg = f"mask manifest repeats a resource path: {relative_path}"
            raise ValueError(msg)
        declared_paths.add(relative_path)

        resource_path = RESOURCE_ROOT.joinpath(*relative_path.parts)
        if not resource_path.is_file():
            msg = f"mask manifest points to a missing committed resource: {resource_path}"
            raise FileNotFoundError(msg)

        expected_digest = _sha256_string(
            entry.get("sha256"),
            f"manifest.dialects.{dialect_id}.sha256",
        )
        _verify_resource_digest(resource_path, expected_digest, relative_path)

        document = _read_json_object(resource_path)
        if document.get("x-morphe-dialect") != dialect_id:
            msg = f"mask resource {relative_path} does not declare dialect {dialect_id!r}"
            raise ValueError(msg)

    committed_paths = {
        PurePosixPath(path.relative_to(RESOURCE_ROOT).as_posix())
        for path in RESOURCE_ROOT.rglob("*.json")
        if path.is_file()
    }
    if committed_paths != declared_paths:
        missing = sorted(str(path) for path in declared_paths - committed_paths)
        undeclared = sorted(str(path) for path in committed_paths - declared_paths)
        details = [
            *(f"missing committed resource: {path}" for path in missing),
            *(f"undeclared committed resource: {path}" for path in undeclared),
        ]
        raise ValueError("mask resource set disagrees with manifest:\n" + "\n".join(details))

    return tuple(
        Resource(
            relative_path=relative_path,
            contents=RESOURCE_ROOT.joinpath(*relative_path.parts).read_bytes(),
        )
        for relative_path in sorted(declared_paths, key=str)
    )


def _run(command: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    return subprocess.run(  # noqa: S603 - fixed executables and arguments, never a shell
        command,
        cwd=cwd,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )


def _only_artifact(directory: Path, pattern: str) -> Path:
    matches = tuple(directory.glob(pattern))
    if len(matches) != 1:
        rendered = ", ".join(path.name for path in matches) or "none"
        msg = f"expected exactly one {pattern} artifact, found: {rendered}"
        raise RuntimeError(msg)
    return matches[0]


def _verify_wheel(wheel_path: Path, resources: tuple[Resource, ...]) -> None:
    with zipfile.ZipFile(wheel_path) as archive:
        members = set(archive.namelist())
        for resource in resources:
            member = str(WHEEL_RESOURCE_PREFIX / resource.relative_path)
            if member not in members:
                msg = f"wheel omits mask resource: {member}"
                raise RuntimeError(msg)
            if archive.read(member) != resource.contents:
                msg = f"wheel mask resource differs from committed bytes: {member}"
                raise RuntimeError(msg)


def _sdist_member(
    members: tuple[str, ...],
    relative_path: PurePosixPath,
) -> str:
    suffix = str(SDIST_RESOURCE_PREFIX / relative_path)
    matches = tuple(member for member in members if member.endswith(f"/{suffix}"))
    if len(matches) != 1:
        rendered = ", ".join(matches) or "none"
        msg = f"expected one sdist member ending in {suffix!r}, found: {rendered}"
        raise RuntimeError(msg)
    return matches[0]


def _verify_sdist(sdist_path: Path, resources: tuple[Resource, ...]) -> None:
    with tarfile.open(sdist_path, mode="r:gz") as archive:
        members = tuple(archive.getnames())
        for resource in resources:
            member_name = _sdist_member(members, resource.relative_path)
            extracted = archive.extractfile(member_name)
            if extracted is None:
                msg = f"sdist mask member is not a regular file: {member_name}"
                raise RuntimeError(msg)
            if extracted.read() != resource.contents:
                msg = f"sdist mask resource differs from committed bytes: {member_name}"
                raise RuntimeError(msg)


_ISOLATED_IMPORT_PROOF = r"""
from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from importlib.resources import files

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from pydantic import BaseModel

wheel_path = sys.argv[1]
sys.path.insert(0, wheel_path)

import morphe_grammar
import morphe_surface
import morphe_surface.source as morphe_source
from morphe_surface import (
    JSON_SCHEMA_2020_12,
    Sha256,
    SourceSurfaceArtifactV1,
    ViewModelContract,
    canonical_json_bytes,
    prepare_source_surface,
    verify_source_surface,
)

module_path = str(morphe_grammar.__file__)
if not module_path.startswith(f"{wheel_path}/"):
    raise RuntimeError(f"morphe_grammar imported outside the wheel: {module_path}")
surface_module_path = str(morphe_surface.__file__)
source_module_path = str(morphe_source.__file__)
if not surface_module_path.startswith(f"{wheel_path}/"):
    raise RuntimeError(f"morphe_surface imported outside the wheel: {surface_module_path}")
if not source_module_path.startswith(f"{wheel_path}/"):
    raise RuntimeError(f"morphe_surface.source imported outside the wheel: {source_module_path}")

resource_root = files("morphe_grammar").joinpath("schemas", "masks")
manifest = json.loads(resource_root.joinpath("manifest.json").read_text(encoding="utf-8"))
dialects = manifest["dialects"]
if manifest.get("format_version") != 1:
    raise RuntimeError("installed manifest has an unsupported format version")
if manifest.get("grammar_version") != morphe_grammar.GRAMMAR_VERSION:
    raise RuntimeError("installed manifest and GRAMMAR_VERSION disagree")
if set(dialects) != set(morphe_grammar.DIALECT_IDS):
    raise RuntimeError("installed manifest and DIALECT_IDS disagree")

for dialect_id, entry in dialects.items():
    expected = json.loads(resource_root.joinpath(entry["schema"]).read_text(encoding="utf-8"))
    actual = morphe_grammar.load_dialect_mask(dialect_id)
    if actual != expected:
        raise RuntimeError(f"public accessor returned different mask bytes for {dialect_id}")
    if actual.get("x-morphe-dialect") != dialect_id:
        raise RuntimeError(f"public accessor returned the wrong mask for {dialect_id}")


class PackageProofModel(BaseModel):
    value: str


signing_key = Ed25519PrivateKey.from_private_bytes(bytes(range(32)))
source_artifact = prepare_source_surface(
    PackageProofModel(value="installed source contract"),
    issuer="package-proof",
    surface_id="package-proof:source-v1",
    source_revision="package-proof-revision",
    produced_at=datetime(2026, 7, 17, 12, 0, 0, tzinfo=UTC),
    view_model=ViewModelContract(
        id="package-proof.source",
        revision=1,
        schema_dialect=JSON_SCHEMA_2020_12,
        hint_vocabulary="package-proof",
    ),
    signing_key=signing_key,
    key_id="package-proof-key",
)
if not isinstance(source_artifact, SourceSurfaceArtifactV1):
    raise RuntimeError("installed prepare_source_surface returned the wrong contract type")
if source_artifact.data != {"value": "installed source contract"}:
    raise RuntimeError("installed source artifact changed the package proof payload")
verify_source_surface(
    source_artifact,
    public_keys={
        (source_artifact.issuer, source_artifact.attestation.key_id): signing_key.public_key()
    },
    expected_issuer="package-proof",
    expected_surface_id="package-proof:source-v1",
)
if canonical_json_bytes({"z": 1, "a": 2}) != b'{"a":2,"z":1}':
    raise RuntimeError("installed RFC 8785 canonicalizer returned unexpected bytes")
if getattr(Sha256, "__name__", None) != "Sha256":
    raise RuntimeError("installed morphe_surface root does not export Sha256")

print(
    f"loaded {len(dialects)} dialect masks from {module_path}; "
    f"verified SourceSurfaceArtifactV1 from {source_module_path}"
)
"""


def _verify_isolated_import(wheel_path: Path) -> str:
    result = _run(
        [sys.executable, "-I", "-c", _ISOLATED_IMPORT_PROOF, str(wheel_path)],
        cwd=wheel_path.parent,
    )
    return result.stdout.strip()


def main() -> None:
    resources = _manifest_resources()
    with tempfile.TemporaryDirectory(prefix="morphe-python-package-") as temporary:
        output_directory = Path(temporary) / "dist"
        build = _run(
            [
                "uv",
                "build",
                "--offline",
                "--no-sources",
                "--clear",
                "--out-dir",
                str(output_directory),
            ],
            cwd=REPO_ROOT,
        )
        wheel_path = _only_artifact(output_directory, "*.whl")
        sdist_path = _only_artifact(output_directory, "*.tar.gz")
        _verify_wheel(wheel_path, resources)
        _verify_sdist(sdist_path, resources)
        import_proof = _verify_isolated_import(wheel_path)

    build_summary = build.stdout.strip() or build.stderr.strip()
    if build_summary:
        sys.stdout.write(f"{build_summary}\n")
    sys.stdout.write(
        f"verified {len(resources)} mask resources in wheel and sdist; {import_proof}\n",
    )


if __name__ == "__main__":
    main()

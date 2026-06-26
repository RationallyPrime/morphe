from __future__ import annotations

from typing import TYPE_CHECKING, Any

from morphe_contracts import Diagnostic

from .compile import compile_surface

if TYPE_CHECKING:
    from pydantic import BaseModel

    from .artifact import CompiledSurface


def from_pydantic(model: BaseModel) -> tuple[dict[str, Any], dict[str, Any]]:
    """Pydantic is one input adapter (ADR-0014 D1): (model_json_schema(), model_dump())."""
    return type(model).model_json_schema(), model.model_dump(mode="json")


def from_envelope(envelope: dict[str, Any]) -> tuple[object, dict[str, list[Diagnostic]]]:
    """Unwrap a `{data, meta, links, diagnostics}` operation-result envelope (D6).

    Returns the data instance and its diagnostics keyed by JSON path.
    """
    data = envelope.get("data")
    raw = envelope.get("diagnostics") or []
    by_path: dict[str, list[Diagnostic]] = {}
    for item in raw:
        diag = Diagnostic.model_validate(item)
        by_path.setdefault(diag.path, []).append(diag)
    return data, by_path


def surface_from_model(model: BaseModel, *, compiled_at: str = "") -> CompiledSurface:
    """Compile a Pydantic instance directly into a CompiledSurface."""
    schema, data = from_pydantic(model)
    return compile_surface(schema, data, compiled_at=compiled_at)

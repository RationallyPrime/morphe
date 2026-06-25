from __future__ import annotations

from morphe_contracts import ContractModel, IntentRef

from .strategies import Priority, Strategy


class MorpheHint(ContractModel):
    """Parsed ``x-morphe`` co-authoring block (ADR-0014 D1'): hints select; structure is floor."""

    strategy: Strategy | None = None
    section: str | None = None
    priority: Priority = "primary"
    label: str | None = None
    role: IntentRef | None = None
    collapse: bool | None = None


def parse_hint(schema: dict[str, object]) -> MorpheHint:
    raw = schema.get("x-morphe")
    if not isinstance(raw, dict):
        raw = {}
    return MorpheHint.model_validate(raw)

from __future__ import annotations

from pydantic import ConfigDict, ValidationError

from morphe_contracts import ContractModel, IntentRef

from .strategies import Strategy


class MorpheHint(ContractModel):
    """Parsed ``x-morphe`` co-authoring block (ADR-0014 D1'): hints select; structure is floor."""

    # Hints cross pinned repo revs, so the vocabulary is forward-open: a producer annotated
    # for a newer (or older) compiler must degrade to the hint-free floor, never crash (D8).
    model_config = ConfigDict(extra="ignore")

    strategy: Strategy | None = None
    label: str | None = None
    role: IntentRef | None = None
    collapse: bool | None = None
    hidden: bool = False
    heading: bool = True


def parse_hint(schema: dict[str, object]) -> MorpheHint:
    raw = schema.get("x-morphe")
    if not isinstance(raw, dict):
        raw = {}
    try:
        return MorpheHint.model_validate(raw)
    except ValidationError:
        # Totality (D8): a malformed hint block selects nothing.
        return MorpheHint()

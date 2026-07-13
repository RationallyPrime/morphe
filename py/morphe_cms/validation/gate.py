from __future__ import annotations

from typing import TYPE_CHECKING

from morphe_cms.contracts.artifact import CompiledTree
from morphe_cms.contracts.shared import Diagnostic, RenderHints
from morphe_cms.presenter.capability_page import PRESENTER_VERSION, present_capability_page
from morphe_cms.validation.diagnostics import validation_error_to_diagnostics
from morphe_cms.validation.policy import policy_diagnostics
from morphe_grammar import GRAMMAR_VERSION, validate_node

if TYPE_CHECKING:
    from morphe_cms.contracts.capability_page import CapabilityPageDraft


def compile_and_gate(
    draft: CapabilityPageDraft,
    *,
    artifact_id: str = "",
    revision_id: str = "",
    compiled_at: str = "",
) -> tuple[CompiledTree | None, list[Diagnostic]]:
    """Run policy -> presenter -> validate_node. Returns (compiled | None, diagnostics).

    Fail-closed: any error-severity diagnostic yields a None compiled tree.
    """
    diagnostics = policy_diagnostics(draft)
    if any(d.severity == "error" for d in diagnostics):
        return None, diagnostics

    tree = present_capability_page(draft)
    try:
        validated_tree = validate_node(tree)
    except Exception as exc:  # noqa: BLE001 - convert any grammar failure to diagnostics
        diagnostics.extend(validation_error_to_diagnostics(exc))
        return None, diagnostics

    compiled = CompiledTree(
        artifact_id=artifact_id,
        revision_id=revision_id,
        grammar_version=GRAMMAR_VERSION,
        producer_version=PRESENTER_VERSION,
        presenter_version=PRESENTER_VERSION,
        tree=validated_tree,
        render_hints=RenderHints(dialect=draft.morphe.dialect),
        diagnostics=diagnostics,
        produced_at=compiled_at,
    )
    return compiled, diagnostics

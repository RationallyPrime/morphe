from __future__ import annotations

from typing import TYPE_CHECKING

from morphe_cms.contracts.shared import Diagnostic

if TYPE_CHECKING:
    from morphe_cms.contracts.capability_page import CapabilityPageDraft


def policy_diagnostics(draft: CapabilityPageDraft) -> list[Diagnostic]:
    """Policy rules the pydantic shape can't express.

    Most PRD §13 forbidden classes (raw css/hex/class/DOM/unknown intent/dialect)
    are already unrepresentable via `extra="forbid"` + closed Literals, so v0 policy
    is thin. The one real cross-field rule: section ids must be unique within a page.
    """
    diagnostics: list[Diagnostic] = []
    seen: set[str] = set()
    for i, section in enumerate(draft.sections):
        sid = section.id
        if sid is None:
            continue
        if sid in seen:
            diagnostics.append(
                Diagnostic(
                    code="DUPLICATE_SECTION_ID",
                    severity="error",
                    path=f"sections[{i}].id",
                    message=f"Section id '{sid}' is used more than once.",
                    repair_hint="Give each section a unique id, or omit it.",
                )
            )
        seen.add(sid)
    return diagnostics

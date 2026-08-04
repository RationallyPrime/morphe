from __future__ import annotations

from pydantic import ValidationError

from morphe_cms.contracts.shared import Diagnostic


def validation_error_to_diagnostics(exc: Exception) -> list[Diagnostic]:
    if not isinstance(exc, ValidationError):
        code = getattr(exc, "code", None)
        path = getattr(exc, "path", None)
        if isinstance(code, str) and isinstance(path, str):
            return [
                Diagnostic(
                    code=code,
                    severity="error",
                    path=path,
                    message=str(exc),
                    repair_hint=(
                        "Repair this reference against the promoted catalog, then resubmit."
                    ),
                )
            ]
        return [Diagnostic(code="UNEXPECTED_ERROR", severity="error", path="", message=str(exc))]
    diagnostics: list[Diagnostic] = []
    for err in exc.errors():
        path = ".".join(str(p) for p in err["loc"])
        diagnostics.append(
            Diagnostic(
                code=err["type"].upper().replace(".", "_"),
                severity="error",
                path=path,
                message=err["msg"],
                repair_hint="Adjust this field to satisfy the contract, then resubmit.",
            )
        )
    return diagnostics

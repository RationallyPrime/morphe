from __future__ import annotations


class MorpheGrammarError(ValueError):
    """Typed grammar failure with a stable code, path, and structured metadata."""

    code: str
    path: str
    metadata: dict[str, object]

    def __init__(
        self,
        *,
        code: str,
        path: str,
        message: str,
        metadata: dict[str, object] | None = None,
    ) -> None:
        self.code = code
        self.path = path
        self.metadata = dict(metadata or {})
        super().__init__(message)


class DialectNodeValidationError(MorpheGrammarError):
    dialect_id: str

    def __init__(self, *, code: str, dialect_id: str, path: str, message: str) -> None:
        self.dialect_id = dialect_id
        super().__init__(
            code=code,
            path=path,
            message=f"{code} at {path} for dialect {dialect_id!r}: {message}",
            metadata={"dialect_id": dialect_id},
        )


class PromotedCompoundReferenceError(MorpheGrammarError):
    """A package-authored tree references the promoted catalog incorrectly."""

    def __init__(self, *, code: str, path: str, message: str) -> None:
        super().__init__(
            code=code,
            path=path,
            message=f"{code} at {path}: {message}",
        )


__all__ = [
    "DialectNodeValidationError",
    "MorpheGrammarError",
    "PromotedCompoundReferenceError",
]

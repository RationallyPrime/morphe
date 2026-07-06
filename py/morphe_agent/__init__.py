from __future__ import annotations

import importlib
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .app import app, create_app
    from .decision import decide
    from .settings import AgentSettings

__all__ = ["AgentSettings", "app", "create_app", "decide"]

# The service deps (fastapi, pydantic_ai, pydantic_settings, ...) live behind the
# `service` extra; a base install ships this module without them, so submodules
# load lazily on first attribute access (PEP 562).
_EXPORTS: dict[str, str] = {
    "app": ".app",
    "create_app": ".app",
    "decide": ".decision",
    "AgentSettings": ".settings",
}


def __getattr__(name: str) -> object:
    source = _EXPORTS.get(name)
    if source is None:
        msg = f"module {__name__!r} has no attribute {name!r}"
        raise AttributeError(msg)
    module = importlib.import_module(source, __name__)
    # Rebind every export of this submodule onto the package: importing `.app` binds
    # the submodule itself as the package attribute `app`, which would shadow the
    # FastAPI `app` export and stop __getattr__ from ever firing for it.
    for export, export_source in _EXPORTS.items():
        if export_source == source:
            globals()[export] = getattr(module, export)
    return globals()[name]


def __dir__() -> list[str]:
    return sorted(__all__)

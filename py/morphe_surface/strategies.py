from __future__ import annotations

from typing import Literal

# Closed render-strategy vocabulary (ADR-0014 D3). A bounded, enumerable space IS the
# inspectability feature; hints select among this set, never below it. Whole-type bespoke
# Node presenters and an open registry are deferred — they land behind resolve_strategy.
Strategy = Literal[
    "scalar",
    "badge",
    "record-card",
    "collapsed-section",
    "linked-ref",
    "table",
    "card-stack",
    "diagnostic-node",
]

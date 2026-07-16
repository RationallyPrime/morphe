from __future__ import annotations

from typing import Literal

# Closed render-strategy vocabulary (ADR-0014 D3). A bounded, enumerable space IS the
# inspectability feature; hints select among this set, never below it. Whole-type bespoke
# Node presenters and an open registry are deferred — they land behind resolve_strategy.
#
# The 0.3.0 additions are hint-selected ONLY — structural inference never picks them, so
# the hint-free floor is unchanged and every pre-0.3.0 surface compiles byte-identically:
#   number    -> NumberNode (Intl-formatted; format/currency ride the hint)
#   status    -> Status chip (tone resolved per-VALUE via the hint's intents map)
#   progress  -> Progress bar (0..1 fraction; non-numeric data degrades to indeterminate)
#   kpi-row   -> grid of promoted SignalCard compounds (one per KpiCell-shaped row)
Strategy = Literal[
    "scalar",
    "badge",
    "record-card",
    "collapsed-section",
    "linked-ref",
    "table",
    "card-stack",
    "diagnostic-node",
    "number",
    "status",
    "progress",
    "kpi-row",
]

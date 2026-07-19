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
#
# The 0.5.0 addition follows the same 0.3.0 precedent — hint-selected ONLY, so the
# hint-free floor stays byte-identical and resolve_strategy never returns it structurally:
#   entity-header -> one promoted EntityHeader compound (the detail-pane lede), composed
#                    from the hinted object's own children (kicker/title/keyFigure + slots)
#   breakdown -> one promoted Breakdown compound (labeled proportion rows); each numeric
#                child is a row (fraction = value / sum(positive numeric values); a
#                non-numeric child or a zero/empty sum degrades that row's progress to
#                indeterminate, mirroring how the `progress` strategy degrades)
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
    "entity-header",
    "breakdown",
]

from __future__ import annotations

from typing import TYPE_CHECKING

from morphe_grammar.models import Node, validate_node

if TYPE_CHECKING:
    from morphe_grammar.wire import DecisionRequest


def fallback_tree(request: DecisionRequest) -> Node:
    goal = request.task_state.get("goal")
    title = goal if isinstance(goal, str) and goal else "Adaptive surface ready"
    digest = request.digest.summary or "Morphe kept the render inside its deterministic grammar."
    payload = {
        "kind": "frame",
        "role": "panel",
        "surface": "raised",
        "children": [
            {
                "kind": "stack",
                "role": "section",
                "children": [
                    {
                        "kind": "cluster",
                        "role": "inline",
                        "align": "center",
                        "children": [
                            {"kind": "badge", "label": request.dialect_id, "intent": "provenance"},
                            {"kind": "badge", "label": request.surface_id, "intent": "evidence"},
                        ],
                    },
                    {
                        "kind": "text",
                        "value": title,
                        "as": "heading",
                        "emphasis": "strong",
                    },
                    {
                        "kind": "text",
                        "value": digest,
                        "as": "body",
                        "emphasis": "muted",
                    },
                    {
                        "kind": "status",
                        "tone": "info",
                        "signal": {"text": "Rendered by deterministic fallback"},
                    },
                ],
            },
        ],
    }
    return validate_node(payload)

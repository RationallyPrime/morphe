from __future__ import annotations

from typing import Any

# A canonical, valid CapabilityPageDraft payload (kebab-correct intents/dialects).
VALID_DRAFT: dict[str, Any] = {
    "slug": "workflow-automation",
    "audience": "operations_lead",
    "morphe": {
        "dialect": "gallery",
        "primary_intent": "evidence",
        "surface": "base",
        "emphasis": "normal",
    },
    "hero": {
        "kicker": "Capability",
        "title": "Workflow automation that stays accountable",
        "thesis": "Morphe encodes operational workflows as adaptive, auditable interfaces.",
        "supporting_claim": (
            "The interface changes register and emphasis without escaping the grammar."
        ),
    },
    "proof_points": [
        {
            "label": "Typed",
            "claim": "Every artifact is validated before it reaches the renderer.",
            "intent": "evidence",
        },
        {
            "label": "Adaptive",
            "claim": "Variation happens inside authorized Morphe envelopes.",
            "intent": "info",
        },
    ],
    "sections": [
        {
            "kind": "problemFrame",
            "id": "problem",
            "title": "The problem",
            "claim": "Most workflow UIs collapse when operational context changes.",
            "evidence": [
                "Different roles need different levels of detail.",
                "Operational states change faster than static frontend releases.",
            ],
            "intent": "caution",
        },
        {
            "kind": "workflowMap",
            "id": "how-it-works",
            "title": "How it works",
            "steps": [
                {
                    "label": "Model the operation",
                    "description": "Define the domain objects, actions, and transitions.",
                },
                {
                    "label": "Compile the interface",
                    "description": "Render the workflow through grammar + dialect.",
                },
            ],
            "intent": "info",
        },
    ],
    "cta": {"label": "See the workflow", "action_id": "open_composer", "intent": "primary-action"},
    "source_ids": [],
}

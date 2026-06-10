from __future__ import annotations

type NodeFixture = dict[str, object]


VALID_TREES: tuple[NodeFixture, ...] = (
    {
        "kind": "frame",
        "role": "page",
        "surface": "base",
        "budget": 4,
        "children": [
            {
                "kind": "stack",
                "role": "section",
                "direction": "block",
                "emphasis": "strong",
                "children": [
                    {
                        "kind": "cluster",
                        "role": "toolbar",
                        "justify": "between",
                        "align": "baseline",
                        "children": [
                            {
                                "kind": "text",
                                "value": "Skjalasafn",
                                "as": "caption",
                                "intent": "accession",
                            },
                            {
                                "kind": "text",
                                "value": "Fol. MMXXVI - 07",
                                "as": "caption",
                                "emphasis": "muted",
                            },
                        ],
                    },
                    {
                        "kind": "text",
                        "value": "The Accession Sheet",
                        "as": "display",
                        "emphasis": "strong",
                    },
                    {
                        "kind": "cluster",
                        "role": "inline",
                        "align": "center",
                        "children": [
                            {
                                "kind": "badge",
                                "label": "Svelte 5",
                                "intent": "provenance",
                                "icon": "bolt",
                            },
                            {
                                "kind": "badge",
                                "label": "Hand-authored",
                                "intent": "accession",
                                "icon": "edit_note",
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        "kind": "frame",
        "role": "panel",
        "surface": "sunken",
        "children": [
            {
                "kind": "stack",
                "role": "form",
                "direction": "block",
                "children": [
                    {"kind": "text", "value": "Request access", "as": "subheading"},
                    {
                        "kind": "field",
                        "a11y": {
                            "id": "intake-name",
                            "label": {"mode": "visible", "text": "Researcher name"},
                            "required": True,
                        },
                        "inputType": "text",
                        "placeholder": "e.g. Hakon Freyr",
                        "hint": "As it appears on your institutional credential.",
                        "multiline": True,
                        "rows": 3,
                        "resizable": True,
                    },
                    {
                        "kind": "select",
                        "a11y": {
                            "id": "intake-collection",
                            "label": {"mode": "visible", "text": "Collection"},
                            "required": True,
                        },
                        "options": [
                            {"value": "manuscripts", "label": "Manuscripts (fol.)"},
                            {
                                "value": "restricted",
                                "label": "Restricted - registrar approval",
                                "disabled": True,
                            },
                        ],
                        "variant": "radiogroup",
                        "hint": "Restricted holdings require separate clearance.",
                    },
                    {
                        "kind": "range",
                        "a11y": {
                            "id": "intake-days",
                            "label": {"mode": "visible", "text": "Requested reading days"},
                        },
                        "min": 1,
                        "max": 14,
                        "step": 1,
                        "hint": "Reading-room sittings, 1-14 days.",
                    },
                    {
                        "kind": "toggle",
                        "a11y": {
                            "id": "intake-handling",
                            "label": {
                                "mode": "visible",
                                "text": "I have completed handling training",
                            },
                            "required": True,
                        },
                        "variant": "checkbox",
                        "indeterminate": True,
                    },
                ],
            },
        ],
    },
    {
        "kind": "stack",
        "role": "section",
        "direction": "block",
        "children": [
            {
                "kind": "compound",
                "name": "CatalogueEntry",
                "args": {
                    "folio": "AM 132 fol.",
                    "title": {
                        "kind": "text",
                        "value": "Modruvallabok",
                        "as": "subheading",
                        "intent": "accession",
                    },
                },
                "slots": {
                    "body": [
                        {
                            "kind": "text",
                            "value": "The largest surviving medieval compendium.",
                            "as": "body",
                        },
                        {
                            "kind": "status",
                            "tone": "info",
                            "signal": {"text": "Digitisation pending"},
                        },
                    ],
                },
            },
            {
                "kind": "slot",
                "name": "body",
                "fallback": [{"kind": "text", "value": "No notes on file.", "as": "caption"}],
            },
            {"kind": "param-ref", "param": "title"},
            {
                "kind": "vary",
                "id": "proof-density",
                "options": [
                    {"kind": "text", "value": "Compact proof", "as": "caption"},
                    {"kind": "text", "value": "Expanded proof", "as": "body"},
                ],
                "default": 0,
                "objective": "density",
            },
            {
                "kind": "within",
                "id": "proof-emphasis",
                "dimension": "emphasis",
                "range": [0, 3],
                "default": 1,
            },
        ],
    },
    {
        "kind": "stack",
        "role": "section",
        "direction": "block",
        "children": [
            {
                "kind": "button",
                "label": "Request access",
                "variant": "solid",
                "intent": "primary-action",
                "type": "button",
                "action": "request-access",
                "icon": "arrow_forward",
            },
            {
                "kind": "button",
                "variant": "ghost",
                "icon": "close",
                "a11y": {"mode": "aria-label", "text": "Dismiss panel"},
            },
            {
                "kind": "link",
                "href": "/architecture",
                "label": "Read the architecture",
                "intent": "provenance",
                "external": "auto",
            },
            {"kind": "media", "src": "/images/the-box.png", "alt": "The Sokrates appliance."},
            {"kind": "number", "value": 0.62, "format": "percent", "intent": "evidence"},
            {"kind": "icon", "name": "folder_open", "a11y": {"role": "decorative"}},
            {
                "kind": "icon",
                "name": "verified",
                "a11y": {"role": "img", "label": "Verified"},
                "intent": "success",
            },
            {"kind": "progress", "value": 0.62, "label": "Digitisation progress"},
            {
                "kind": "inline-alert",
                "tone": "info",
                "title": "Climate hold in effect",
                "detail": "Digital surrogates remain available.",
                "live": "polite",
            },
            {
                "kind": "dialog",
                "title": "Review request",
                "description": "Confirm the reading-room request before sending.",
                "open": False,
                "bind": "ui.reviewRequestOpen",
                "dismissable": True,
                "children": [{"kind": "text", "value": "Ready to send.", "as": "body"}],
            },
            {
                "kind": "popover",
                "anchor": "request-access",
                "id": "request-access-help",
                "placement": "bottom",
                "role": "tooltip",
                "open": False,
                "children": [
                    {"kind": "text", "value": "Registrar review required.", "as": "caption"}
                ],
            },
            {
                "kind": "disclosure",
                "summary": "Why this is restricted",
                "group": "request-help",
                "children": [
                    {"kind": "text", "value": "Vellum handling rules apply.", "as": "body"}
                ],
            },
            {"kind": "spacer", "size": "sm"},
        ],
    },
)

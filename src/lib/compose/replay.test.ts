import { describe, expect, it } from "vitest";
import type { ContextDigest, Node } from "$morphe";
import { CAPABILITIES } from "./corpus.js";
import type { ComposeQuery } from "./input.js";
import { offDomainState, thinMatchState } from "./present.js";

interface RecordedPresenterInput<Input> {
	readonly digest: ContextDigest;
	readonly presenterInput: Input;
}

function replay<Input>(
	recording: RecordedPresenterInput<Input>,
	presenter: (input: Input, digest: ContextDigest) => Node,
): Node {
	return presenter(recording.presenterInput, recording.digest);
}

function expectDeterministicReplay<Input>(
	recording: RecordedPresenterInput<Input>,
	presenter: (input: Input, digest: ContextDigest) => Node,
): Node {
	const first = replay(recording, presenter);
	const second = replay(recording, presenter);
	expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	return first;
}

describe("ContextDigest replay harness — compose presenters", () => {
	const digest: ContextDigest = {
		digestVersion: 1,
		state: {
			"compose.systems": ["humanity", "dkplus"],
			"compose.pain": "shift planning is slow and error prone",
		},
		recentEvents: [
			{
				tier: 1,
				kind: "filter-edit",
				path: "compose.pain",
				value: "shift planning is slow and error prone",
				at: 1000,
			},
			{
				tier: 1,
				kind: "selection",
				path: "compose.systems",
				value: ["humanity", "dkplus"],
				at: 1100,
			},
		],
	};

	it("replays a thin-match presenter from a recorded digest/input pair", () => {
		const query: ComposeQuery = {
			pain: "shift planning is slow and error prone",
			systems: ["humanity", "dkplus"],
		};
		const recording: RecordedPresenterInput<{
			readonly caps: typeof CAPABILITIES;
			readonly query: ComposeQuery;
		}> = {
			digest,
			presenterInput: { caps: CAPABILITIES.slice(1, 2), query },
		};

		const tree = expectDeterministicReplay(recording, ({ caps, query }) =>
			thinMatchState(caps, query),
		);

		expect(JSON.stringify(tree, null, 2)).toMatchInlineSnapshot(`
			"{
			  "kind": "frame",
			  "role": "page",
			  "surface": "base",
			  "budget": 4,
			  "children": [
			    {
			      "kind": "compound",
			      "name": "ComposePainPrompt",
			      "emphasis": "strong",
			      "args": {
			        "heading": {
			          "kind": "text",
			          "value": "A loose match so far",
			          "as": "heading",
			          "emphasis": "strong"
			        },
			        "sub": {
			          "kind": "text",
			          "value": "These sit near your situation rather than squarely on it. Name the systems you run and where the work piles up, and the fit sharpens.",
			          "as": "body",
			          "emphasis": "muted"
			        }
			      },
			      "slots": {
			        "summary": [
			          {
			            "kind": "text",
			            "value": "Showing the closest matches. Add the systems you run to narrow this to your operation.",
			            "as": "caption",
			            "emphasis": "muted"
			          }
			        ]
			      }
			    },
			    {
			      "kind": "spacer",
			      "size": "md"
			    },
			    {
			      "kind": "compound",
			      "name": "ComposeCapabilityCard",
			      "args": {
			        "value": {
			          "kind": "text",
			          "value": "A live answer to 'what will this schedule cost?' before any labor is committed.",
			          "as": "subheading",
			          "emphasis": "strong"
			        },
			        "title": {
			          "kind": "text",
			          "value": "Schedule to labor cost forecast",
			          "as": "caption",
			          "emphasis": "muted"
			        },
			        "transform": {
			          "kind": "text",
			          "value": "Take future Humanity shifts, enrich them with dkPlus employee cost rates and dimensions, then project labor cost by day, project, location and GL dimension.",
			          "as": "caption",
			          "emphasis": "muted"
			        },
			        "tier": {
			          "kind": "status",
			          "tone": "info",
			          "signal": {
			            "text": "Read-only",
			            "icon": "visibility"
			          }
			        },
			        "pairing": {
			          "kind": "text",
			          "value": "Labor cost",
			          "as": "caption",
			          "emphasis": "muted"
			        }
			      },
			      "slots": {
			        "flow": [
			          {
			            "kind": "compound",
			            "name": "ComposeFlowArrow",
			            "args": {
			              "source": {
			                "kind": "text",
			                "value": "Humanity",
			                "as": "caption",
			                "intent": "accession"
			              },
			              "target": {
			                "kind": "text",
			                "value": "dkPlus",
			                "as": "caption",
			                "intent": "accession"
			              },
			              "label": "reads"
			            }
			          }
			        ],
			        "evidence": [
			          {
			            "kind": "stack",
			            "role": "list",
			            "direction": "block",
			            "emphasis": "muted",
			            "children": [
			              {
			                "kind": "text",
			                "value": "Grounded in 3 real endpoints",
			                "as": "caption",
			                "emphasis": "muted"
			              },
			              {
			                "kind": "compound",
			                "name": "ComposeSurfaceEvidence",
			                "args": {
			                  "method": {
			                    "kind": "badge",
			                    "label": "GET",
			                    "intent": "evidence",
			                    "icon": "api"
			                  },
			                  "path": {
			                    "kind": "text",
			                    "value": "/shifts",
			                    "as": "caption",
			                    "intent": "evidence"
			                  },
			                  "summary": {
			                    "kind": "text",
			                    "value": "GET Shifts",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  },
			                  "system": {
			                    "kind": "text",
			                    "value": "Humanity",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  },
			                  "direction": {
			                    "kind": "text",
			                    "value": "Reads",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  }
			                }
			              },
			              {
			                "kind": "compound",
			                "name": "ComposeSurfaceEvidence",
			                "args": {
			                  "method": {
			                    "kind": "badge",
			                    "label": "GET",
			                    "intent": "evidence",
			                    "icon": "api"
			                  },
			                  "path": {
			                    "kind": "text",
			                    "value": "/api/v1/general/employee",
			                    "as": "caption",
			                    "intent": "evidence"
			                  },
			                  "summary": {
			                    "kind": "text",
			                    "value": "Using this method you can get all employee´s from the system",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  },
			                  "system": {
			                    "kind": "text",
			                    "value": "dkPlus",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  },
			                  "direction": {
			                    "kind": "text",
			                    "value": "Reads",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  }
			                }
			              },
			              {
			                "kind": "compound",
			                "name": "ComposeSurfaceEvidence",
			                "args": {
			                  "method": {
			                    "kind": "badge",
			                    "label": "GET",
			                    "intent": "evidence",
			                    "icon": "api"
			                  },
			                  "path": {
			                    "kind": "text",
			                    "value": "/api/v1/general/dimension2/{page}/{size}",
			                    "as": "caption",
			                    "intent": "evidence"
			                  },
			                  "summary": {
			                    "kind": "text",
			                    "value": "Get dimensions 2 - Cost Centre",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  },
			                  "system": {
			                    "kind": "text",
			                    "value": "dkPlus",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  },
			                  "direction": {
			                    "kind": "text",
			                    "value": "Reads",
			                    "as": "caption",
			                    "emphasis": "muted"
			                  }
			                }
			              }
			            ]
			          }
			        ],
			        "models": [
			          {
			            "kind": "cluster",
			            "role": "inline",
			            "align": "center",
			            "children": [
			              {
			                "kind": "compound",
			                "name": "ComposeModelView",
			                "args": {
			                  "name": {
			                    "kind": "text",
			                    "value": "Shift",
			                    "as": "caption",
			                    "intent": "accession"
			                  }
			                }
			              },
			              {
			                "kind": "compound",
			                "name": "ComposeModelView",
			                "args": {
			                  "name": {
			                    "kind": "text",
			                    "value": "EmployeeModel",
			                    "as": "caption",
			                    "intent": "accession"
			                  }
			                }
			              },
			              {
			                "kind": "compound",
			                "name": "ComposeModelView",
			                "args": {
			                  "name": {
			                    "kind": "text",
			                    "value": "Dim2Model",
			                    "as": "caption",
			                    "intent": "accession"
			                  }
			                }
			              }
			            ]
			          }
			        ]
			      }
			    }
			  ]
			}"
		`);
	});

	it("replays an off-domain presenter from a recorded digest/input pair", () => {
		const recording: RecordedPresenterInput<{ readonly reason: string }> = {
			digest,
			presenterInput: { reason: "outside-operational-domain" },
		};

		const tree = expectDeterministicReplay(recording, () => offDomainState());

		expect(JSON.stringify(tree, null, 2)).toMatchInlineSnapshot(`
			"{
			  "kind": "frame",
			  "role": "page",
			  "surface": "base",
			  "budget": 4,
			  "children": [
			    {
			      "kind": "compound",
			      "name": "ComposePainPrompt",
			      "emphasis": "strong",
			      "args": {
			        "heading": {
			          "kind": "text",
			          "value": "That sits outside what Sókrates works on",
			          "as": "heading",
			          "emphasis": "strong"
			        },
			        "sub": {
			          "kind": "text",
			          "value": "It runs the operations between the systems you already use: finance, scheduling, CRM, and the spreadsheets in between. Name the systems you run and the friction between them, and it shows what it can take on.",
			          "as": "body",
			          "emphasis": "muted"
			        }
			      },
			      "slots": {
			        "summary": [
			          {
			            "kind": "text",
			            "value": "No close match in the operational domain.",
			            "as": "caption",
			            "emphasis": "muted"
			          }
			        ]
			      }
			    }
			  ]
			}"
		`);
	});
});

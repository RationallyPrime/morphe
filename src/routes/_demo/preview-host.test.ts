import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import { inspectPreviewHost } from "./preview-host.js";

describe("CMS preview host inspection", () => {
	it("discovers actions and choices after promoted compound expansion", () => {
		const tree: Node = {
			kind: "compound",
			name: "ActionSummary",
			args: {
				eyebrow: { kind: "text", value: "Preview", as: "caption" },
				title: { kind: "text", value: "Runtime sockets", as: "heading" },
				summary: { kind: "text", value: "The host owns them.", as: "body" },
			},
			slots: {
				action: [{ kind: "button", label: "Record", action: "preview_record" }],
				detail: [
					{
						kind: "vary",
						id: "preview.mode",
						default: 1,
						options: [
							{ kind: "text", value: "One" },
							{ kind: "text", value: "Two" },
						],
					},
				],
			},
		};

		expect(inspectPreviewHost(tree)).toEqual({
			actionIds: ["preview_record"],
			variations: [{ id: "preview.mode", defaultChoice: 1, optionCount: 2 }],
		});
	});

	it("stays total for an unknown consumer compound and inspects its fills", () => {
		const tree: Node = {
			kind: "compound",
			name: "consumer-only",
			args: {},
			slots: {
				body: [{ kind: "button", label: "Receipt", action: "consumer_receipt" }],
			},
		};

		expect(inspectPreviewHost(tree).actionIds).toEqual(["consumer_receipt"]);
	});
});

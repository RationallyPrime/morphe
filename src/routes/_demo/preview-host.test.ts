import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import { getDialect, registry, restrictCompounds } from "$lib";
import { inspectPreviewHost } from "./preview-host.js";

const galleryResolver = () =>
	restrictCompounds(registry, { allow: getDialect("gallery").compounds });

function actionSummary(detail: readonly Node[] = []): Extract<Node, { readonly kind: "compound" }> {
	return {
		kind: "compound",
		name: "ActionSummary",
		args: {
			eyebrow: { kind: "text", value: "Preview", as: "caption" },
			title: { kind: "text", value: "Runtime sockets", as: "heading" },
			summary: { kind: "text", value: "The host owns them.", as: "body" },
		},
		slots: {
			action: [{ kind: "button", label: "Record", action: "preview_record" }],
			detail,
		},
	};
}

describe("CMS preview host inspection", () => {
	it("discovers actions and Vary choices after exact resolver-authorized expansion", () => {
		const tree = actionSummary([
			{
				kind: "vary",
				id: "preview.mode",
				default: 1,
				options: [
					{ kind: "text", value: "One", as: "body" },
					{ kind: "text", value: "Two", as: "body" },
				],
			},
		]);

		expect(inspectPreviewHost(tree, { resolver: galleryResolver() })).toEqual({
			actionIds: ["preview_record"],
			variations: [
				{
					id: "preview.mode",
					kind: "vary",
					defaultChoice: 1,
					range: [0, 1],
					options: [
						{ value: 0, label: "Branch 1" },
						{ value: 1, label: "Branch 2" },
					],
				},
			],
		});
	});

	it("preserves a targeted Within integer range as a numeric control, not branches", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{
					kind: "within",
					id: "preview.density",
					dimension: "density",
					range: [2, 4],
					default: 3,
					target: { kind: "text", value: "Density target", as: "body" },
				},
			],
		};

		expect(inspectPreviewHost(tree, { resolver: galleryResolver() }).variations).toEqual([
			{
				id: "preview.density",
				kind: "within",
				defaultChoice: 3,
				range: [2, 4],
			},
		]);
	});

	it("stays total for huge, fractional, reversed, and empty Within ranges", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{
					kind: "within",
					id: "preview.huge",
					dimension: "density",
					range: [0, 1_000_000_000],
					default: 7,
					target: { kind: "text", value: "Huge but bounded", as: "body" },
				},
				{
					kind: "within",
					id: "preview.fractional",
					dimension: "emphasis",
					range: [2.2, 4.8],
					default: 3.9,
					target: { kind: "text", value: "Fractional", as: "body" },
				},
				{
					kind: "within",
					id: "preview.reversed",
					dimension: "collapse",
					range: [4.8, 1.2],
					default: 3.9,
					summary: "Reversed range",
					target: { kind: "text", value: "Reversed", as: "body" },
				},
				{
					kind: "within",
					id: "preview.empty",
					dimension: "density",
					range: [1.2, 1.8],
					default: 1.5,
					target: { kind: "text", value: "No integer", as: "body" },
				},
			],
		};

		const variations = inspectPreviewHost(tree, { resolver: galleryResolver() }).variations;
		expect(variations).toEqual([
			{ id: "preview.huge", kind: "within", defaultChoice: 7, range: [0, 1_000_000_000] },
			{ id: "preview.fractional", kind: "within", defaultChoice: 3, range: [3, 4] },
			{ id: "preview.reversed", kind: "within", defaultChoice: 3, range: [2, 4] },
		]);
		for (const variation of variations) expect("options" in variation).toBe(false);
	});

	it("grants no action or choice authority to unknown, invisible, or invalid compounds", () => {
		const hiddenSocket: Node = {
			kind: "compound",
			name: "consumer-only",
			args: {},
			slots: {
				body: [
					{ kind: "button", label: "Receipt", action: "consumer_receipt" },
					{
						kind: "vary",
						id: "consumer.mode",
						options: [{ kind: "text", value: "Invisible", as: "body" }],
					},
				],
			},
		};
		const invisible = actionSummary([
			{
				kind: "vary",
				id: "hidden.mode",
				options: [{ kind: "text", value: "Hidden", as: "body" }],
			},
		]);
		const invalid: Node = {
			...actionSummary([
				{
					kind: "vary",
					id: "invalid.mode",
					options: [{ kind: "text", value: "Invalid", as: "body" }],
				},
			]),
			args: {
				...actionSummary().args,
				unexpected: { kind: "text", value: "Corrupt reference", as: "body" },
			},
		};

		expect(inspectPreviewHost(hiddenSocket, { resolver: galleryResolver() })).toEqual({
			actionIds: [],
			variations: [],
		});
		expect(
			inspectPreviewHost(invisible, {
				resolver: restrictCompounds(registry, { allow: ["ProvenanceFooter"] }),
			}),
		).toEqual({ actionIds: [], variations: [] });
		expect(inspectPreviewHost(invalid, { resolver: galleryResolver() })).toEqual({
			actionIds: [],
			variations: [],
		});
	});
});

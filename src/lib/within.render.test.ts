import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { CompoundRegistry } from "./compounds/factory.js";
import type { ChoiceMap } from "./delegation/envelope.js";
import type { Node } from "./grammar/types.js";
import { GRAMMAR_VERSION } from "./grammar/version.js";
import MorpheRoot from "./render/MorpheRoot.svelte";
import RenderNode from "./render/Node.svelte";

function ssr(tree: Node, choices?: ChoiceMap): string {
	return render(MorpheRoot, { props: { tree, choices } }).body;
}

describe("targeted Within rendering", () => {
	it("carries density context to a direct control without adding a layout box", () => {
		const tree: Node = {
			kind: "within",
			id: "density-target",
			dimension: "density",
			range: [0, 2],
			default: 1,
			target: {
				kind: "field",
				a11y: {
					id: "density-field",
					label: { mode: "visible", text: "Density field" },
				},
			},
		};

		const compact = ssr(tree, { "density-target": 0 });
		const spacious = ssr(tree, { "density-target": 2 });
		expect(compact).toContain("mo-within-context");
		expect(compact).toContain("--mo-ctx-space:var(--mo-space-3)");
		expect(compact).toContain("<input");
		expect(spacious).toContain("--mo-ctx-space:var(--mo-space-7)");
	});

	it("turns collapse into a labelled native disclosure with controlled authored state", () => {
		const tree: Node = {
			kind: "within",
			id: "collapse-target",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary: "Supporting evidence",
			target: { kind: "text", value: "Visible body", as: "body" },
		};

		const collapsed = ssr(tree, { "collapse-target": 1 });
		expect(collapsed).toContain("<details");
		expect(collapsed).toContain("<summary");
		expect(collapsed).toContain("Supporting evidence");
		expect(collapsed).toContain("Visible body");
		expect(collapsed).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);

		const expanded = ssr(tree, { "collapse-target": 0 });
		expect(expanded).toMatch(/<details[^>]*\sopen(?:[\s=>])/);
	});

	it.each([
		["U+0085 NEXT LINE", "\u0085"],
		["U+FEFF ZERO WIDTH NO-BREAK SPACE", "\uFEFF"],
		["U+200B ZERO WIDTH SPACE", "\u200B"],
	])("fails open for an invisible collapse summary (%s)", (_name, summary) => {
		const tree: Node = {
			kind: "within",
			id: "invisible-summary",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary,
			target: { kind: "text", value: "Fail-open body", as: "body" },
		};

		const html = ssr(tree);
		expect(html).toContain("Fail-open body");
		expect(html).not.toContain("<details");
		expect(html).not.toContain("<summary");
	});

	it.each([
		"Skýring",
		"普通話",
		"🧭",
	])("keeps an ordinary Unicode collapse summary as a native disclosure (%s)", (summary) => {
		const tree: Node = {
			kind: "within",
			id: "unicode-summary",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary,
			target: { kind: "text", value: "Disclosure body", as: "body" },
		};

		const html = ssr(tree);
		expect(html).toContain("<details");
		expect(html).toContain("<summary");
		expect(html).toContain(summary);
	});

	it("makes emphasis a parent-budgeted claim rather than a target escape hatch", () => {
		const wrapped = (id: string): Node => ({
			kind: "within",
			id,
			dimension: "emphasis",
			range: [0, 3],
			default: 3,
			target: {
				kind: "stack",
				role: "list",
				children: [{ kind: "text", value: id, as: "body" }],
			},
		});
		const tree: Node = {
			kind: "frame",
			role: "page",
			budget: 2,
			children: [wrapped("first"), wrapped("second")],
		};

		const html = ssr(tree, { first: 3, second: 3 });
		const emphases = [...html.matchAll(/class="mo-stack[^"]*"[^>]*?data-emphasis="(\w+)"/g)].map(
			(match) => match[1],
		);
		expect(emphases, html).toEqual(["strong", "muted"]);
	});

	it("budgets direct children locally under every overlay container", () => {
		const children: readonly Node[] = [
			{
				kind: "stack",
				role: "list",
				emphasis: "critical",
				children: [{ kind: "text", value: "first" }],
			},
			{
				kind: "stack",
				role: "list",
				emphasis: "critical",
				children: [{ kind: "text", value: "second" }],
			},
		];
		const overlays: readonly Node[] = [
			{ kind: "dialog", title: "Budget probe", children },
			{ kind: "popover", anchor: "budget-anchor", id: "budget-popover", children },
			{ kind: "disclosure", summary: "Budget probe", children },
		];

		for (const overlay of overlays) {
			const tree: Node = { kind: "frame", role: "page", budget: 2, children: [overlay] };
			const html = ssr(tree);
			const emphases = [...html.matchAll(/class="mo-stack[^"]*"[^>]*?data-emphasis="(\w+)"/g)].map(
				(match) => match[1],
			);
			expect(emphases, `${overlay.kind}: ${html}`).toEqual(["strong", "muted"]);
		}
	});

	it("starts a fresh disclosure budget without consuming the outer sibling budget", () => {
		const tree: Node = {
			kind: "frame",
			role: "page",
			budget: 2,
			children: [
				{
					kind: "within",
					id: "collapse-budget",
					dimension: "collapse",
					range: [0, 1],
					default: 0,
					summary: "Local economy",
					target: {
						kind: "stack",
						role: "list",
						emphasis: "critical",
						children: [{ kind: "text", value: "inside" }],
					},
				},
				{
					kind: "stack",
					role: "list",
					emphasis: "strong",
					children: [{ kind: "text", value: "outside" }],
				},
			],
		};

		const html = ssr(tree);
		const emphases = [...html.matchAll(/class="mo-stack[^"]*"[^>]*?data-emphasis="(\w+)"/g)].map(
			(match) => match[1],
		);
		expect(emphases, html).toEqual(["strong", "strong"]);
	});

	it("grants root emphasis to a direct control through the no-box context carrier", () => {
		const tree: Node = {
			kind: "within",
			id: "root-emphasis",
			dimension: "emphasis",
			range: [0, 3],
			default: 0,
			target: {
				kind: "field",
				a11y: {
					id: "root-emphasis-field",
					label: { mode: "visible", text: "Root target" },
				},
			},
		};

		const html = ssr(tree, { "root-emphasis": 3 });
		expect(html).toContain("<input");
		expect(html).toMatch(
			/class="mo-within-context[^"]*"[^>]*--mo-ctx-stroke:\s*var\(--mo-border-width-strong\)/,
		);
	});

	it("emits the granted emphasis stroke on an overlay target", () => {
		const tree: Node = {
			kind: "frame",
			role: "page",
			budget: 3,
			children: [
				{
					kind: "within",
					id: "overlay-emphasis",
					dimension: "emphasis",
					range: [0, 3],
					default: 0,
					target: {
						kind: "disclosure",
						summary: "Overlay target",
						children: [{ kind: "text", value: "Body" }],
					},
				},
			],
		};

		const html = ssr(tree, { "overlay-emphasis": 3 });
		expect(html).toMatch(/<details[^>]*--mo-ctx-stroke:\s*var\(--mo-border-width-strong\)/);
	});

	it("keeps a standalone resolver through synthetic collapse and recursive containers", () => {
		const registry = new CompoundRegistry();
		expect(
			registry.register({
				name: "within-resolver-proof",
				version: "1.0.0",
				grammarVersion: GRAMMAR_VERSION,
				params: { type: "object", properties: {} },
				template: { kind: "text", value: "Resolved through target", as: "body" },
			}).ok,
		).toBe(true);

		const tree: Node = {
			kind: "within",
			id: "resolver-target",
			dimension: "collapse",
			range: [0, 1],
			default: 0,
			summary: "Resolver proof",
			target: {
				kind: "stack",
				role: "section",
				children: [{ kind: "compound", name: "within-resolver-proof", args: {} }],
			},
		};
		const html = render(RenderNode, { props: { node: tree, registry } }).body;
		expect(html).toContain("<details");
		expect(html).toContain("Resolved through target");
	});
});

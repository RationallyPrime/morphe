// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Node } from "../../lib/grammar/types.js";
import MorpheRoot from "../../lib/render/MorpheRoot.svelte";

describe("targeted Within DOM reactivity", () => {
	it("updates density context in place when the choice changes", async () => {
		const tree: Node = {
			kind: "within",
			id: "density",
			dimension: "density",
			range: [0, 2],
			default: 0,
			target: {
				kind: "field",
				a11y: {
					id: "density-field",
					label: { mode: "visible", text: "Density target" },
				},
			},
		};
		const view = render(MorpheRoot, { props: { tree, choices: { density: 0 } } });
		const initial = view.container.querySelector<HTMLElement>(".mo-within-context");
		expect(initial).not.toBeNull();
		expect(initial?.style.getPropertyValue("--mo-ctx-space")).toBe("var(--mo-space-3)");
		expect(view.container.querySelector("input#density-field")).not.toBeNull();

		await view.rerender({ choices: { density: 2 } });
		const updated = view.container.querySelector<HTMLElement>(".mo-within-context");
		expect(updated).toBe(initial);
		expect(updated?.style.getPropertyValue("--mo-ctx-space")).toBe("var(--mo-space-7)");
	});

	it("updates a native disclosure's open property from the current choice", async () => {
		const tree: Node = {
			kind: "within",
			id: "collapse",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary: "Evidence",
			target: { kind: "text", value: "Disclosure body" },
		};
		const view = render(MorpheRoot, { props: { tree, choices: { collapse: 1 } } });
		const initial = view.container.querySelector<HTMLDetailsElement>("details");
		expect(initial).not.toBeNull();
		expect(initial?.open).toBe(false);

		await view.rerender({ choices: { collapse: 0 } });
		const expanded = view.container.querySelector<HTMLDetailsElement>("details");
		expect(expanded).toBe(initial);
		expect(expanded?.open).toBe(true);

		await view.rerender({ choices: { collapse: 1 } });
		expect(initial?.open).toBe(false);
	});

	it("recomputes sibling budget grants when emphasis choices change", async () => {
		const wrapped = (id: string): Node => ({
			kind: "within",
			id,
			dimension: "emphasis",
			range: [0, 3],
			default: 0,
			target: {
				kind: "stack",
				role: "list",
				children: [{ kind: "text", value: id }],
			},
		});
		const tree: Node = {
			kind: "frame",
			role: "page",
			budget: 3,
			children: [wrapped("first"), wrapped("second")],
		};
		const view = render(MorpheRoot, {
			props: { tree, choices: { first: 0, second: 2 } },
		});
		const initial = [...view.container.querySelectorAll<HTMLElement>(".mo-stack")];
		expect(initial.map((element) => element.dataset.emphasis)).toEqual(["muted", "strong"]);

		await view.rerender({ choices: { first: 3, second: 3 } });
		const updated = [...view.container.querySelectorAll<HTMLElement>(".mo-stack")];
		expect(updated[0]).toBe(initial[0]);
		expect(updated[1]).toBe(initial[1]);
		expect(updated.map((element) => element.dataset.emphasis)).toEqual(["critical", "muted"]);
	});

	it("updates a root-level emphasis grant without remounting its target", async () => {
		const tree: Node = {
			kind: "within",
			id: "root-emphasis",
			dimension: "emphasis",
			range: [0, 3],
			default: 0,
			target: {
				kind: "stack",
				role: "section",
				children: [{ kind: "text", value: "Root target" }],
			},
		};
		const view = render(MorpheRoot, {
			props: { tree, choices: { "root-emphasis": 0 } },
		});
		const initial = view.container.querySelector<HTMLElement>(".mo-stack");
		expect(initial?.dataset.emphasis).toBe("muted");

		await view.rerender({ choices: { "root-emphasis": 3 } });
		const updated = view.container.querySelector<HTMLElement>(".mo-stack");
		expect(updated).toBe(initial);
		// Gallery's root budget is 2, so the requested critical claim is lawfully
		// normalized to strong rather than escaping the root economy.
		expect(updated?.dataset.emphasis).toBe("strong");
	});

	const overlayCases: readonly [name: string, build: (children: readonly Node[]) => Node][] = [
		["dialog", (children) => ({ kind: "dialog", title: "Budget probe", children })],
		[
			"popover",
			(children) => ({ kind: "popover", anchor: "budget-anchor", id: "budget-popover", children }),
		],
		["disclosure", (children) => ({ kind: "disclosure", summary: "Budget probe", children })],
	];

	it.each(
		overlayCases,
	)("recomputes choice-aware child grants inside %s", async (_name, buildOverlay) => {
		const wrapped = (id: string): Node => ({
			kind: "within",
			id,
			dimension: "emphasis",
			range: [0, 3],
			default: 0,
			target: {
				kind: "stack",
				role: "list",
				children: [{ kind: "text", value: id }],
			},
		});
		const tree: Node = {
			kind: "frame",
			role: "page",
			budget: 3,
			children: [buildOverlay([wrapped("first"), wrapped("second")])],
		};
		const view = render(MorpheRoot, {
			props: { tree, choices: { first: 0, second: 2 } },
		});
		const initial = [...view.container.querySelectorAll<HTMLElement>(".mo-stack")];
		expect(initial.map((element) => element.dataset.emphasis)).toEqual(["muted", "strong"]);

		await view.rerender({ choices: { first: 3, second: 3 } });
		const updated = [...view.container.querySelectorAll<HTMLElement>(".mo-stack")];
		expect(updated[0]).toBe(initial[0]);
		expect(updated[1]).toBe(initial[1]);
		expect(updated.map((element) => element.dataset.emphasis)).toEqual(["critical", "muted"]);
	});
});

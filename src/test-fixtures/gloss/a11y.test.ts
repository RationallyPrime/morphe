// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Node } from "../../lib/grammar/types.js";
import MorpheRoot from "../../lib/render/MorpheRoot.svelte";

const TREE: Node = {
	kind: "stack",
	role: "section",
	children: [
		{
			kind: "link",
			href: "/records/1",
			label: "Open record",
			gloss: "Open the authoritative record.",
		},
		{
			kind: "status",
			tone: "caution",
			signal: { text: "Pending evidence" },
			href: "/records/1/evidence",
			gloss: "Evidence has not yet been received.",
		},
		{ kind: "badge", label: "core", gloss: "The review tier." },
	],
};

describe("Gloss disclosure accessibility (KRA-804)", () => {
	it("uses one native-button disclosure for click, keyboard focus, and screen readers", async () => {
		render(MorpheRoot, { props: { tree: TREE } });

		const trigger = screen.getByRole("button", { name: "Explain Open record" });
		expect(trigger).toHaveAttribute("type", "button");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		trigger.focus();
		expect(trigger).toHaveFocus();

		await fireEvent.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		const panel = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
		expect(panel).toHaveAttribute("role", "tooltip");
		expect(panel).toHaveAttribute("aria-label", "Explanation for Open record");
		expect(panel).not.toHaveAttribute("hidden");
		expect(panel).toHaveTextContent("Open the authoritative record.");
	});

	it("keeps interactive painted terms and their Gloss buttons as siblings", () => {
		render(MorpheRoot, { props: { tree: TREE } });

		for (const [linkName, triggerName] of [
			["Open record", "Explain Open record"],
			["Pending evidence", "Explain Pending evidence"],
		] as const) {
			const link = screen.getByRole("link", { name: linkName });
			const trigger = screen.getByRole("button", { name: triggerName });
			expect(link.querySelector("button")).toBeNull();
			expect(link.nextElementSibling).toBe(trigger);
			expect(trigger.style.color).not.toBe("");
		}
	});

	it("reveals every definition through the same pane-level state", async () => {
		const view = render(MorpheRoot, { props: { tree: TREE, explainGlosses: false } });
		expect(screen.getAllByRole("button", { name: /^Explain / })).toHaveLength(3);

		await view.rerender({ tree: TREE, explainGlosses: true });
		expect(screen.queryByRole("button", { name: /^Explain / })).toBeNull();
		expect(screen.getAllByRole("note")).toHaveLength(3);
		expect(screen.getByText("Open the authoritative record.")).toBeVisible();
		expect(screen.getByText("Evidence has not yet been received.")).toBeVisible();
		expect(screen.getByText("The review tier.")).toBeVisible();
	});
});

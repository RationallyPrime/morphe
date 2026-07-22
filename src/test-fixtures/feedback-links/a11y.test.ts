// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Node } from "../../lib/grammar/types.js";
import MorpheRoot from "../../lib/render/MorpheRoot.svelte";

describe("feedback drill-through accessibility (KRA-805)", () => {
	it("keeps an href-bearing status a keyboard-focusable link with a ring token", () => {
		const tree: Node = {
			kind: "status",
			tone: "caution",
			signal: { text: "1 live violation" },
			href: "/workers/w-1/rest-debts",
		};
		render(MorpheRoot, { props: { tree } });

		const link = screen.getByRole("link", { name: "1 live violation" });
		expect(link).toHaveAttribute("href", "/workers/w-1/rest-debts");
		link.focus();
		expect(link).toHaveFocus();
		expect(link.style.getPropertyValue("--mo-status-ring")).toBe("var(--mo-intent-caution-ring)");
	});

	it("keeps href-less alerts inert while linked alerts retain the native link role", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{ kind: "inline-alert", tone: "info", title: "Inert notice" },
				{
					kind: "inline-alert",
					tone: "caution",
					title: "Open evidence",
					href: "/seals/s-1",
				},
			],
		};
		render(MorpheRoot, { props: { tree } });

		expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Inert notice");
		const link = screen.getByRole("link", { name: "Open evidence" });
		expect(link).toHaveAttribute("href", "/seals/s-1");
		expect(link).not.toHaveAttribute("role");
		expect(link.style.getPropertyValue("--mo-alert-ring")).toBe("var(--mo-intent-caution-ring)");
	});
});

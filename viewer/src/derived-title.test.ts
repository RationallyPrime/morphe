import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import { derivedSurfaceTitle } from "./derived-title.js";

// A family-mode drill-through renders a param-scoped instance; its crumb/title
// must come from the artifact's own leading heading, not the pinned
// representative's declared title. See +page.server.ts for the wiring.
describe("derivedSurfaceTitle", () => {
	const text = (value: string, as?: "display" | "heading" | "body"): Node =>
		({ kind: "text", value, ...(as === undefined ? {} : { as }) }) as unknown as Node;
	const stack = (...children: Node[]): Node => ({ kind: "stack", children }) as unknown as Node;

	it("finds the first display text in document order", () => {
		const tree = stack(text("breadcrumb noise", "body"), text("Hákon Freyr", "display"));
		expect(derivedSurfaceTitle(tree)).toBe("Hákon Freyr");
	});

	it("accepts a heading when no display text precedes it", () => {
		const tree = stack(stack(text("Aðalbók", "heading")), text("later display", "display"));
		expect(derivedSurfaceTitle(tree)).toBe("Aðalbók");
	});

	it("ignores body/caption text entirely", () => {
		const tree = stack(text("just prose", "body"), text("untyped"));
		expect(derivedSurfaceTitle(tree)).toBeUndefined();
	});

	it("skips blank titles rather than returning empty crumbs", () => {
		const tree = stack(text("   ", "display"), text("Real title", "heading"));
		expect(derivedSurfaceTitle(tree)).toBe("Real title");
	});

	it("descends into slots", () => {
		const framed = {
			kind: "frame",
			args: {},
			slots: { body: [text("Slotted title", "display")] },
		} as unknown as Node;
		expect(derivedSurfaceTitle(framed)).toBe("Slotted title");
	});
});

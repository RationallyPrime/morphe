import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import type { Node } from "../grammar/types.js";
import { GOLD_STANDARD_COMPOUND, PROMOTED_COMPOUNDS } from "./catalog.generated.js";
import { CompoundReferenceError, registry } from "./factory.js";

const action: Node = {
	kind: "compound",
	name: "ActionSummary",
	args: {
		eyebrow: { kind: "text", value: "Payroll", as: "caption" },
		title: { kind: "text", value: "Close July payroll", as: "subheading" },
		summary: {
			kind: "text",
			value: "One workforce compliance gate remains open.",
			as: "body",
		},
	},
	slots: {
		signal: [{ kind: "status", tone: "caution", signal: { text: "Needs review" } }],
		action: [{ kind: "link", href: "/payroll/july", label: "Review payroll" }],
	},
};

describe("ActionSummary promoted compound", () => {
	it("expands every authored lane without baking in a card surface", () => {
		expect(GOLD_STANDARD_COMPOUND).toBe("ActionSummary");
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("ActionSummary");
		expect(registry.has("ActionSummary")).toBe(true);

		const expanded = registry.expand(action as Extract<Node, { readonly kind: "compound" }>);
		const encoded = JSON.stringify(expanded);
		expect(encoded).not.toContain("param-ref");
		expect(encoded).not.toContain('"kind":"slot"');
		expect(encoded).toContain("One workforce compliance gate remains open.");
		expect(encoded).toContain("Review payroll");
		expect(expanded.kind).toBe("stack");
		expect(validateNodeDocument(expanded).ok).toBe(true);
	});

	it("rejects a call without its required human context", () => {
		expect(() => registry.expand({ kind: "compound", name: "ActionSummary", args: {} })).toThrow(
			CompoundReferenceError,
		);
	});
});

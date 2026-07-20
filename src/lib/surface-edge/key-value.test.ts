import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import { PROMOTED_COMPOUNDS } from "../compounds/catalog.generated.js";
import { CompoundReferenceError, registry } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { buildSurface } from "./build.js";
import { emitNode } from "./emit.js";
import { EMPTY_HINT, parseHint } from "./hints.js";
import { resolveStrategy } from "./resolve.js";
import type { JsonSchema } from "./spec.js";

const PANEL_SCHEMA: JsonSchema = {
	type: "object",
	title: "Panel",
	"x-morphe": { strategy: "key-value", order: ["name", "dept", "id"] },
	properties: {
		name: { type: "string", title: "Name", "x-morphe": { emphasis: "strong" } },
		dept: { type: "string", title: "Dept" },
		id: { type: "string", title: "Id", "x-morphe": { role: "provenance" } },
	},
};
const PANEL_DATA = { name: "Sok", dept: "Treasury", id: "emp-1" };

function grid(...children: Node[]): Node {
	return { kind: "grid", role: "field-group", columns: ["content", "flexible"], children };
}
function caption(value: string): Node {
	return { kind: "text", value, as: "caption", intent: "neutral" };
}

// The SAME expected tree the Python twin asserts verbatim
// (py/tests/test_surface_key_value.py::EXPECTED_PANEL).
const EXPECTED_PANEL: Node = {
	kind: "compound",
	name: "KeyValuePanel",
	args: {},
	slots: {
		primary: [
			grid(caption("Name"), { kind: "text", value: "Sok", as: "body", emphasis: "strong" }),
		],
		secondary: [grid(caption("Dept"), { kind: "text", value: "Treasury", as: "body" })],
		provenance: [
			{
				kind: "compound",
				name: "ProvenanceFooter",
				args: {},
				slots: {
					facts: [
						{
							kind: "stack",
							role: "field-group",
							children: [
								caption("Id"),
								{ kind: "text", value: "emp-1", as: "body", intent: "provenance" },
							],
						},
					],
					seals: [],
					links: [],
				},
			},
		],
	},
};

function panelPayload(node: Node): Node {
	if (node.kind !== "stack" || node.role !== "section") throw new Error("expected root task stack");
	expect(node.children[0]).toEqual({
		kind: "text",
		value: "Panel",
		as: "heading",
		level: 1,
	});
	const panel = node.children[1];
	if (panel === undefined) throw new Error("expected KeyValuePanel payload");
	return panel;
}

describe("key-value lowering (KRA-787)", () => {
	it("is hint-selected only — structural inference never returns it", () => {
		const obj: JsonSchema = { type: "object", properties: { a: { type: "string" } } };
		expect(resolveStrategy(obj, EMPTY_HINT)).toBe("record-card");
		expect(resolveStrategy(obj, parseHint({ "x-morphe": { strategy: "key-value" } }).hint)).toBe(
			"key-value",
		);
	});

	it("leaves the hint-free floor unchanged — an object without the hint is a record-card", () => {
		const { "x-morphe": _hint, ...floor } = PANEL_SCHEMA;
		expect(buildSurface(floor, PANEL_DATA, { root: floor }).strategy).toBe("record-card");
	});

	it("tiers fields into the promoted KeyValuePanel — byte-identical to the Python oracle", () => {
		const node = emitNode(buildSurface(PANEL_SCHEMA, PANEL_DATA, { root: PANEL_SCHEMA }));
		expect(panelPayload(node)).toEqual(EXPECTED_PANEL);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("reuses the definition-grid idiom the hint-free floor uses", () => {
		const { "x-morphe": _hint, ...floor } = PANEL_SCHEMA;
		const floorNode = buildSurface(floor, PANEL_DATA, { root: floor });
		const floorEmitted = emitNode(floorNode);
		if (floorEmitted.kind !== "frame") throw new Error("expected a frame");
		const section = floorEmitted.children[0];
		if (section?.kind !== "stack") throw new Error("expected a section");
		const floorGrid = section.children.find((child) => child.kind === "grid");
		const panel = panelPayload(
			emitNode(buildSurface(PANEL_SCHEMA, PANEL_DATA, { root: PANEL_SCHEMA })),
		);
		if (panel.kind !== "compound") throw new Error("expected a panel");
		const secondaryGrid = panel.slots?.secondary?.[0];
		if (floorGrid?.kind !== "grid" || secondaryGrid?.kind !== "grid") {
			throw new Error("expected grids");
		}
		expect(secondaryGrid.role).toBe(floorGrid.role);
		expect(secondaryGrid.columns).toEqual(floorGrid.columns);
	});
});

describe("KeyValuePanel factory gate", () => {
	it("registers the generated KeyValuePanel and expands its tier slots hygienically", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("KeyValuePanel");
		expect(registry.has("KeyValuePanel")).toBe(true);
		const json = JSON.stringify(registry.expand(EXPECTED_PANEL as never));
		expect(json).not.toContain('"kind":"slot"');
		expect(json).not.toContain("param-ref");
		expect(json).toContain("emp-1");
	});

	it("rejects an invalid call (unknown argument) through the gate", () => {
		expect(() =>
			registry.expand({
				kind: "compound",
				name: "KeyValuePanel",
				args: { bogus: { kind: "text", value: "x" } },
			}),
		).toThrow(CompoundReferenceError);
	});
});

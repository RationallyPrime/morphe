import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import { PROMOTED_COMPOUNDS } from "../compounds/catalog.generated.js";
import { CompoundReferenceError, registry } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { buildSurface } from "./build.js";
import { emitNode } from "./emit.js";
import type { JsonSchema } from "./spec.js";

const FIGURES_SCHEMA: JsonSchema = {
	type: "array",
	title: "Figures",
	"x-morphe": { strategy: "kpi-row", heading: false },
};
const FIGURES_DATA = [
	{ label: "Net", value: 7, kicker: "Q4" },
	// The corner-signal lever (KRA-757 §3.2): signal text + tone ride the cell.
	{ label: "Rail", value: "bank_batch", kicker: "Route", signal: "Queued", signal_intent: "info" },
];

// The SAME expected tree the Python twin asserts verbatim
// (py/tests/test_surface_stat_band.py::EXPECTED_BAND).
const EXPECTED_BAND: Node = {
	kind: "stack",
	role: "section",
	children: [
		{
			kind: "compound",
			name: "StatBand",
			args: {},
			slots: {
				tiles: [
					{
						kind: "compound",
						name: "SignalCard",
						args: {
							kicker: { kind: "text", value: "Q4", as: "caption", intent: "folio" },
							title: { kind: "text", value: "Net", as: "subheading" },
							measure: { kind: "number", value: 7, emphasis: "strong" },
						},
						slots: { signal: [], body: [] },
					},
					{
						kind: "compound",
						name: "SignalCard",
						args: {
							kicker: { kind: "text", value: "Route", as: "caption", intent: "folio" },
							title: { kind: "text", value: "Rail", as: "subheading" },
							measure: { kind: "text", value: "bank_batch", as: "body", emphasis: "strong" },
						},
						slots: {
							signal: [{ kind: "status", tone: "info", signal: { text: "Queued" } }],
							body: [],
						},
					},
				],
			},
		},
	],
};

describe("StatBand lowering (KRA-784)", () => {
	it("lowers a kpi-row to a promoted StatBand of SignalCards — byte-identical to the Python oracle", () => {
		const node = emitNode(buildSurface(FIGURES_SCHEMA, FIGURES_DATA, { root: FIGURES_SCHEMA }));
		expect(node).toEqual(EXPECTED_BAND);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("keeps the empty-collection floor for an empty kpi-row", () => {
		const node = emitNode(buildSurface(FIGURES_SCHEMA, [], { root: FIGURES_SCHEMA }));
		expect(validateNodeDocument(node).ok).toBe(true);
		expect(node).toEqual({
			kind: "stack",
			role: "section",
			children: [{ kind: "text", value: "No figures.", as: "caption", intent: "neutral" }],
		});
	});
});

describe("StatBand factory gate", () => {
	it("registers the generated StatBand and expands its tiles slot hygienically", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("StatBand");
		expect(registry.has("StatBand")).toBe(true);
		const band = EXPECTED_BAND.kind === "stack" ? EXPECTED_BAND.children[0] : undefined;
		if (band === undefined || band.kind !== "compound") throw new Error("expected a StatBand");
		const expanded = registry.expand(band);
		const json = JSON.stringify(expanded);
		// The tiles slot spliced inline as the grid's children; expansion is hygienic
		// and recursive, so the nested SignalCards are themselves fully expanded — no
		// slot or param-ref leaf remains, and the two tiles land as the grid children.
		expect(json).not.toContain('"kind":"slot"');
		expect(json).not.toContain("param-ref");
		expect(expanded.kind).toBe("grid");
		if (expanded.kind !== "grid") throw new Error("expected a grid");
		expect(expanded.children).toHaveLength(2);
		// SignalCard 2.0.0: framing is composition, not signal identity — tiles are panel stacks.
		expect(expanded.children.every((child) => child.kind === "stack")).toBe(true);
		expect(json).toContain("bank_batch");
	});

	it("rejects an invalid call (unknown argument) through the gate", () => {
		expect(() =>
			registry.expand({
				kind: "compound",
				name: "StatBand",
				args: { bogus: { kind: "text", value: "x" } },
			}),
		).toThrow(CompoundReferenceError);
	});
});

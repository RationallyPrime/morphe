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

const SPLIT_SCHEMA: JsonSchema = {
	type: "object",
	title: "Split",
	"x-morphe": { strategy: "breakdown", order: ["a", "b", "c"] },
	properties: {
		a: { type: "integer", title: "Alpha" },
		b: { type: "integer", title: "Beta" },
		c: { type: "integer", title: "Gamma" },
	},
};
const SPLIT_DATA = { a: 1, b: 2, c: 1 };

function row(label: string, value: number, fraction: number | null): Node {
	return {
		kind: "cluster",
		role: "inline",
		align: "baseline",
		children: [
			{ kind: "text", value: label, as: "caption", intent: "neutral" },
			{ kind: "progress", label, ...(fraction === null ? {} : { value: fraction }) },
			{ kind: "number", value },
		],
	};
}

// The SAME expected tree the Python twin asserts verbatim
// (py/tests/test_surface_breakdown.py::EXPECTED_BREAKDOWN).
const EXPECTED_BREAKDOWN: Node = {
	kind: "compound",
	name: "Breakdown",
	args: { title: { kind: "text", value: "Split", as: "heading" } },
	slots: { rows: [row("Alpha", 1, 0.25), row("Beta", 2, 0.5), row("Gamma", 1, 0.25)] },
};

describe("breakdown lowering (KRA-785)", () => {
	it("is hint-selected only — structural inference never returns it", () => {
		const obj: JsonSchema = { type: "object", properties: { a: { type: "integer" } } };
		expect(resolveStrategy(obj, EMPTY_HINT)).toBe("record-card");
		expect(resolveStrategy(obj, parseHint({ "x-morphe": { strategy: "breakdown" } }).hint)).toBe(
			"breakdown",
		);
	});

	it("leaves the hint-free floor unchanged — an object without the hint is a record-card", () => {
		const { "x-morphe": _hint, ...floor } = SPLIT_SCHEMA;
		expect(buildSurface(floor, SPLIT_DATA, { root: floor }).strategy).toBe("record-card");
	});

	it("lowers to the promoted Breakdown compound — byte-identical to the Python oracle", () => {
		const node = emitNode(buildSurface(SPLIT_SCHEMA, SPLIT_DATA, { root: SPLIT_SCHEMA }));
		expect(node).toEqual(EXPECTED_BREAKDOWN);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("pins a non-trivial repeating IEEE-754 fraction identically to Python", () => {
		const schema: JsonSchema = {
			type: "object",
			"x-morphe": { strategy: "breakdown", heading: false, order: ["r", "o"] },
			properties: { r: { type: "integer", title: "R" }, o: { type: "integer", title: "O" } },
		};
		const node = emitNode(buildSurface(schema, { r: 100_000, o: 250_000 }, { root: schema }));
		expect(validateNodeDocument(node).ok).toBe(true);
		if (node.kind !== "compound") throw new Error("expected a compound");
		const fractions = (node.slots?.rows ?? []).map((r) =>
			r.kind === "cluster" && r.children[1]?.kind === "progress" ? r.children[1].value : undefined,
		);
		expect(fractions).toEqual([0.2857142857142857, 0.7142857142857143]);
	});

	it("degrades a non-numeric child and a zero sum to indeterminate progress", () => {
		const schema: JsonSchema = {
			type: "object",
			"x-morphe": { strategy: "breakdown", heading: false, order: ["a", "b"] },
			properties: { a: { type: "string", title: "Alpha" }, b: { type: "integer", title: "Beta" } },
		};
		const node = emitNode(buildSurface(schema, { a: "hello", b: 0 }, { root: schema }));
		expect(validateNodeDocument(node).ok).toBe(true);
		if (node.kind !== "compound") throw new Error("expected a compound");
		const rows = node.slots?.rows ?? [];
		const first = rows[0];
		const second = rows[1];
		if (first?.kind !== "cluster" || second?.kind !== "cluster") throw new Error("expected rows");
		expect(first.children[1]).toEqual({ kind: "progress", label: "Alpha" });
		expect(first.children[2]).toEqual({ kind: "text", value: "hello", as: "body" });
		expect(second.children[1]).toEqual({ kind: "progress", label: "Beta" });
	});
});

describe("Breakdown factory gate", () => {
	it("registers the generated Breakdown and expands its rows slot hygienically", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("Breakdown");
		expect(registry.has("Breakdown")).toBe(true);
		const expanded = registry.expand(EXPECTED_BREAKDOWN as never);
		const json = JSON.stringify(expanded);
		expect(json).not.toContain('"kind":"slot"');
		expect(json).not.toContain("param-ref");
		expect(json).toContain("Alpha");
	});

	it("rejects an invalid call (unknown argument) through the gate", () => {
		expect(() =>
			registry.expand({
				kind: "compound",
				name: "Breakdown",
				args: { bogus: { kind: "text", value: "x" } },
			}),
		).toThrow(CompoundReferenceError);
	});
});

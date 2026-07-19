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

const VENDOR_SCHEMA: JsonSchema = {
	type: "object",
	title: "Vendor",
	// Real source-v1 testimony always carries a signed property order (stamped at
	// sign time); pin it so both compilers key on the same order. Without a signed
	// order the two engines follow different legacy tie-breaks (Python keeps
	// insertion order, TypeScript sorts) — a pre-existing, out-of-scope asymmetry.
	"x-morphe": {
		strategy: "entity-header",
		order: ["name", "exposure", "standing", "contact", "ledgerRef"],
	},
	properties: {
		name: { type: "string", title: "Name" },
		exposure: {
			type: "integer",
			title: "Exposure",
			"x-morphe": { strategy: "number", format: "currency", currency: "ISK" },
		},
		standing: {
			type: "string",
			title: "Standing",
			"x-morphe": { strategy: "status", intents: { active: "success" } },
		},
		contact: { type: "string", title: "Primary contact" },
		ledgerRef: { type: "string", title: "Ledger id", "x-morphe": { role: "provenance" } },
	},
};
const VENDOR_DATA = {
	name: "Krates ehf",
	exposure: 2_450_000,
	standing: "active",
	contact: "Sok",
	ledgerRef: "vnd-001",
};

// The SAME expected tree the Python twin asserts verbatim
// (py/tests/test_surface_entity_header.py::EXPECTED_COMPOUND). Cross-language parity
// by hand, plus the mechanical conformance vector (krates-vendor) in oracles.test.ts.
const EXPECTED_COMPOUND: Node = {
	kind: "compound",
	name: "EntityHeader",
	args: {
		kicker: { kind: "text", value: "Vendor", as: "caption", intent: "folio" },
		title: { kind: "text", value: "Krates ehf", as: "heading" },
		keyFigure: {
			kind: "number",
			value: 2_450_000,
			format: "currency",
			currency: "ISK",
			emphasis: "strong",
		},
	},
	slots: {
		signal: [{ kind: "status", tone: "success", signal: { text: "active" } }],
		meta: [
			{
				kind: "grid",
				role: "field-group",
				columns: ["content", "flexible"],
				children: [
					{ kind: "text", value: "Primary contact", as: "caption", intent: "neutral" },
					{ kind: "text", value: "Sok", as: "body" },
				],
			},
		],
		provenance: [{ kind: "text", value: "vnd-001", as: "body", intent: "provenance" }],
	},
};

describe("entity-header lowering (0.5.0)", () => {
	it("is hint-selected only — structural inference never returns it", () => {
		const obj: JsonSchema = { type: "object", properties: { name: { type: "string" } } };
		expect(resolveStrategy(obj, EMPTY_HINT)).toBe("record-card");
		expect(
			resolveStrategy(obj, parseHint({ "x-morphe": { strategy: "entity-header" } }).hint),
		).toBe("entity-header");
	});

	it("leaves the hint-free floor unchanged — an object without the hint is a record-card", () => {
		const { "x-morphe": _hint, ...floor } = VENDOR_SCHEMA;
		const spec = buildSurface(floor, VENDOR_DATA, { root: floor });
		expect(spec.strategy).toBe("record-card");
	});

	it("builds children plainly, with no identity promotion", () => {
		const spec = buildSurface(VENDOR_SCHEMA, VENDOR_DATA, { root: VENDOR_SCHEMA });
		expect(spec.strategy).toBe("entity-header");
		expect(spec.children.map((child) => child.strategy)).toEqual([
			"scalar",
			"number",
			"status",
			"scalar",
			"scalar",
		]);
		expect(spec.children.every((child) => child.text_as === undefined)).toBe(true);
	});

	it("lowers to the promoted EntityHeader compound — byte-identical to the Python oracle", () => {
		const node = emitNode(buildSurface(VENDOR_SCHEMA, VENDOR_DATA, { root: VENDOR_SCHEMA }));
		expect(node).toEqual(EXPECTED_COMPOUND);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("omits keyFigure when there is no number child, letting the default apply", () => {
		const schema: JsonSchema = {
			type: "object",
			title: "Person",
			"x-morphe": { strategy: "entity-header" },
			properties: { name: { type: "string", title: "Name" } },
		};
		const node = emitNode(buildSurface(schema, { name: "Ada" }, { root: schema }));
		expect(validateNodeDocument(node).ok).toBe(true);
		if (node.kind !== "compound") throw new Error("expected a compound");
		expect(Object.hasOwn(node.args, "keyFigure")).toBe(false);
	});

	it("surfaces node-level and promoted-arg diagnostics at the head of the meta row", () => {
		const node = emitNode(
			buildSurface(VENDOR_SCHEMA, VENDOR_DATA, {
				root: VENDOR_SCHEMA,
				diagnostics: [
					{ code: "OWN", severity: "warning", path: "$", message: "node level" },
					{ code: "KEYFIG", severity: "info", path: "$.exposure", message: "promoted arg" },
				],
			}),
		);
		if (node.kind !== "compound") throw new Error("expected a compound");
		const meta = node.slots?.meta ?? [];
		const head = meta.filter((item) => item.kind === "inline-alert");
		expect(head.map((alert) => (alert.kind === "inline-alert" ? alert.title : ""))).toEqual([
			"OWN",
			"KEYFIG",
		]);
	});
});

describe("EntityHeader factory gate", () => {
	it("registers the generated EntityHeader and expands it hygienically", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("EntityHeader");
		expect(registry.has("EntityHeader")).toBe(true);
		const expanded = registry.expand(EXPECTED_COMPOUND);
		const json = JSON.stringify(expanded);
		// Every ParamRef and Slot leaf resolved — expansion, acyclicity and depth pass.
		expect(json).not.toContain("param-ref");
		expect(json).not.toContain('"kind":"slot"');
		expect(json).toContain("Krates ehf");
		expect(json).toContain("vnd-001");
	});

	it("rejects an invalid call (missing required args) through the gate", () => {
		expect(() => registry.expand({ kind: "compound", name: "EntityHeader", args: {} })).toThrow(
			CompoundReferenceError,
		);
	});
});

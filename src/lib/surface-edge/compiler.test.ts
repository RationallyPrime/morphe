import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import { buildSurface } from "./build.js";
import { COMPILER_BUILD_SHA256 } from "./build-id.generated.js";
import { compileSourceSurface } from "./compile.js";
import { emitNode, SurfaceEmitLimitError } from "./emit.js";
import { parseHint } from "./hints.js";
import { resolveRef } from "./refs.js";
import type { TrustedSourceSurface } from "./source.js";
import { surfaceNode } from "./spec.js";

const HASH = `sha256:${"0".repeat(64)}` as const;

describe("surface-edge compiler adjudications", () => {
	it("retains known hint fields and reports unknown fields", () => {
		const parsed = parseHint({
			"x-morphe": { strategy: "status", heading: false, future_register: "probe" },
		});
		expect(parsed.hint.strategy).toBe("status");
		expect(parsed.hint.heading).toBe(false);
		expect(parsed.unknownKeys).toEqual(["future_register"]);
	});

	it("preserves the Python floor when a known hint value is malformed", () => {
		const parsed = parseHint({
			"x-morphe": {
				strategy: "number",
				format: "bogus",
				heading: false,
				order: ["second", "first"],
			},
		});
		expect(parsed.hint).toEqual({
			hidden: false,
			heading: true,
			order: ["second", "first"],
		});
		const spec = buildSurface(
			{
				type: "object",
				"x-morphe": { format: "bogus", order: ["second", "first"] },
				properties: { first: { type: "string" }, second: { type: "string" } },
			},
			{ first: "1", second: "2" },
		);
		expect(spec.children.map((child) => child.path)).toEqual(["$.second", "$.first"]);
	});

	it("emits UNKNOWN_HINT as the reviewed KRA-762 parity exception", () => {
		const spec = buildSurface(
			{
				type: "object",
				"x-morphe": { order: ["state"] },
				properties: {
					state: {
						type: "string",
						"x-morphe": { strategy: "status", future_register: "probe" },
					},
				},
			},
			{ state: "ready" },
		);
		const state = spec.children[0];
		expect(state?.strategy).toBe("status");
		expect(state?.diagnostics).toEqual([
			expect.objectContaining({ code: "UNKNOWN_HINT", path: "$.state" }),
		]);
		expect(JSON.stringify(emitNode(spec))).toContain("UNKNOWN_HINT");
	});

	it("uses signed order once, then deterministically sorts the remainder", () => {
		const spec = buildSurface(
			{
				type: "object",
				"x-morphe": { order: ["b", "b", "missing"] },
				properties: {
					c: { type: "string" },
					a: { type: "string" },
					b: { type: "string" },
				},
			},
			{ a: "A", b: "B", c: "C" },
		);
		expect(spec.children.map((child) => child.path)).toEqual(["$.b", "$.a", "$.c"]);
	});

	it("uses the sorted floor for malformed order without losing valid sibling hints", () => {
		const spec = buildSurface(
			{
				type: "object",
				"x-morphe": { strategy: "record-card", order: "not-an-array" },
				properties: { zeta: { type: "string" }, alpha: { type: "string" } },
			},
			{ zeta: "Z", alpha: "A" },
		);
		expect(spec.strategy).toBe("record-card");
		expect(spec.children.map((child) => child.path)).toEqual(["$.alpha", "$.zeta"]);
	});

	it("matches Python null semantics for defaulted booleans and local ref order", () => {
		expect(
			parseHint({
				"x-morphe": { strategy: "badge", heading: null, order: ["second", "first"] },
			}).hint,
		).toEqual({ hidden: false, heading: true, order: ["second", "first"] });
		expect(parseHint({ "x-morphe": { order: null } }).hint.order).toEqual([]);

		const root = {
			$defs: {
				Record: {
					type: "object",
					"x-morphe": { order: ["second", "first"] },
					properties: { first: { type: "string" }, second: { type: "string" } },
				},
			},
		};
		const spec = buildSurface(
			{ $ref: "#/$defs/Record", "x-morphe": { format: "bogus", order: null } },
			{ first: "1", second: "2" },
			{ root },
		);
		expect(spec.children.map((child) => child.path)).toEqual(["$.first", "$.second"]);
	});

	it("inherits signed order and fail-hidden policy through a cosmetic local ref hint", () => {
		const spec = buildSurface(
			{
				type: "object",
				properties: {
					ordered: { $ref: "#/$defs/Ordered", "x-morphe": { label: "Local label" } },
					secret: { $ref: "#/$defs/Secret", "x-morphe": { label: "Cosmetic override" } },
				},
				$defs: {
					Ordered: {
						type: "object",
						"x-morphe": { order: ["second", "first"] },
						properties: { first: { type: "string" }, second: { type: "string" } },
					},
					Secret: {
						type: "object",
						"x-morphe": { hidden: true },
						properties: { value: { type: "string" } },
					},
				},
			},
			{ ordered: { first: "1", second: "2" }, secret: { value: "never" } },
		);
		expect(spec.children.map((child) => child.path)).toEqual(["$.ordered"]);
		expect(spec.children[0]?.children.map((child) => child.path)).toEqual([
			"$.ordered.second",
			"$.ordered.first",
		]);
	});

	it("does not resolve percent-encoded definition refs outside the Stage 1 subset", () => {
		const reference = { $ref: "#/$defs/A%20B" } as const;
		const root = {
			$defs: {
				"A B": { type: "string" },
				"A%20B": { type: "integer" },
			},
		};
		expect(resolveRef(reference, root)).toBe(reference);
	});

	it("resolves bounded chained RFC 6901 pointers with escaped tokens", () => {
		const root = {
			$defs: {
				"A/B": { $ref: "#/$defs/T~0arget" },
				"T~arget": { type: "string", title: "Resolved" },
			},
		};
		expect(resolveRef({ $ref: "#/$defs/A~1B" }, root)).toEqual({
			type: "string",
			title: "Resolved",
		});
		const cycle = { $defs: { A: { $ref: "#/$defs/B" }, B: { $ref: "#/$defs/A" } } };
		expect(() => resolveRef({ $ref: "#/$defs/A" }, cycle, 4)).not.toThrow();
	});

	it.each([
		"Infinity",
		"-Infinity",
		"NaN",
		"1e9999",
		"9007199254740993",
		"9007199254740993.0",
		"9.007199254740993e15",
		"90071992547409930e-1",
		"-9007199254740993.0",
		"9007199254740991.5",
		"1e16",
		"١٢",
	])("degrades unsafe numeric text %s to scalar instead of throwing", (value) => {
		const spec = buildSurface(
			{ type: "string", title: "Measure", "x-morphe": { strategy: "number" } },
			value,
		);
		expect(spec.strategy).toBe("scalar");
		expect(spec.value).toBe(value);
		expect(validateNodeDocument(emitNode(spec)).ok).toBe(true);
	});

	it.each([
		["9007199254740991.0", 9007199254740991],
		["9.007199254740991e15", 9007199254740991],
		["1.25e2", 125],
		["1.25e-2", 0.0125],
	] as const)("retains safely representable numeric text %s", (value, expected) => {
		const spec = buildSurface(
			{ type: "string", title: "Measure", "x-morphe": { strategy: "number" } },
			value,
		);
		expect(spec).toMatchObject({ strategy: "number", value: expected });
	});

	it.each([
		"\u00851\u0085",
		"\u001c1\u001f",
	])("uses Python whitespace semantics for numeric text %s", (value) => {
		const spec = buildSurface({ type: "string", "x-morphe": { strategy: "number" } }, value);
		expect(spec).toMatchObject({ strategy: "number", value: 1 });
	});

	it("uses ASCII digits and Python strip for scalar numeric presentation", () => {
		const arabic = buildSurface({ type: "string" }, "١٢");
		const wrapped = buildSurface({ type: "string" }, "\u0085-12\u0085");
		expect(arabic.numeric).toBeUndefined();
		expect(arabic.polarity).toBeUndefined();
		expect(wrapped).toMatchObject({ numeric: true, polarity: "negative" });
	});

	it("retains producer diagnostics attached directly to KPI cells", () => {
		const spec = buildSurface(
			{
				type: "array",
				title: "Figures",
				"x-morphe": { strategy: "kpi-row" },
			},
			[{ label: "Net", value: 7 }],
			{
				diagnostics: [
					{
						code: "KPI_SOURCE",
						severity: "info",
						path: "$[0]",
						message: "Signed KPI provenance.",
					},
				],
			},
		);
		expect(spec.items[0]?.diagnostics[0]?.code).toBe("KPI_SOURCE");
		expect(JSON.stringify(emitNode(spec))).toContain("KPI_SOURCE");
	});

	it("uses generated labels when KPI or linked-ref data labels are empty", () => {
		const kpis = buildSurface(
			{ type: "array", title: "Figures", "x-morphe": { strategy: "kpi-row" } },
			[{ label: "", value: 7 }],
		);
		expect(kpis.items[0]?.label).toBe("Figures 0");

		const linked = emitNode(
			buildSurface(
				{ type: "object", title: "Receipt", "x-morphe": { strategy: "linked-ref" } },
				{ label: "", href: "/receipts/r-1" },
			),
		);
		expect(linked).toMatchObject({ kind: "link", label: "Receipt", href: "/receipts/r-1" });
	});

	it("uses own-property semantics for intent maps and optional prototype-named fields", () => {
		const badgeSpec = buildSurface(
			{
				type: "object",
				"x-morphe": { order: ["state"] },
				properties: {
					state: {
						type: "string",
						enum: ["active", "toString", "__proto__"],
						"x-morphe": { intents: { active: "success" } },
					},
				},
			},
			{ state: "toString" },
		);
		expect(badgeSpec.children[0]?.intent).toBeUndefined();
		expect(validateNodeDocument(emitNode(badgeSpec)).ok).toBe(true);

		const fields = buildSurface(
			{
				type: "object",
				"x-morphe": { order: ["toString", "constructor", "__proto__"] },
				properties: {
					toString: { type: "string" },
					constructor: { type: "string" },
					["__proto__"]: { type: "string" },
				},
			},
			{},
		);
		expect(fields.children.map((child) => child.value)).toEqual([undefined, undefined, undefined]);
	});

	it("matches Python float spelling and numeric intent keys", () => {
		for (const [value, expected] of [
			[1e-5, "1e-05"],
			[1e-6, "1e-06"],
			[1e21, "1e+21"],
		] as const) {
			expect(emitNode(buildSurface({ type: "number" }, value))).toMatchObject({
				kind: "text",
				value: expected,
			});
		}

		const badge = emitNode(
			buildSurface({ type: "number", enum: [1], "x-morphe": { intents: { "1.0": "success" } } }, 1),
		);
		expect(badge).toMatchObject({ kind: "badge", label: "1.0", intent: "success" });
		const status = emitNode(
			buildSurface(
				{
					type: "number",
					"x-morphe": { strategy: "status", intents: { "1.0": "success" } },
				},
				1,
			),
		);
		expect(status).toMatchObject({ kind: "status", tone: "success", signal: { text: "1.0" } });
	});

	it.each([
		[{ type: "integer", enum: [1] }, 1, "1"],
		[{ enum: [1] }, 1, "1"],
		[{ type: "number", enum: [1] }, 1, "1.0"],
		[{ enum: [0.00001] }, 0.00001, "1e-05"],
	] as const)("normalizes badge numeric spelling by schema", (schema, value, label) => {
		expect(emitNode(buildSurface(schema, value))).toMatchObject({ kind: "badge", label });
	});

	it("canonicalizes explicitly scalarized containers independently of transport order", () => {
		const schema = { type: "object", "x-morphe": { strategy: "scalar" } } as const;
		const first = emitNode(buildSurface(schema, { a: "A", b: "B" }));
		const second = emitNode(buildSurface(schema, { b: "B", a: "A" }));
		expect(first).toEqual(second);
		expect(first).toMatchObject({ kind: "text", value: '{"a":"A","b":"B"}' });
	});

	it("uses one deterministic sentinel for scalarized values outside the JCS domain", () => {
		const schema = { type: "object", "x-morphe": { strategy: "scalar" } } as const;
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const expected = {
			kind: "text",
			value: "unrenderable: scalarized value is outside the RFC 8785 domain",
		};

		expect(emitNode(buildSurface(schema, { value: 1n }))).toMatchObject(expected);
		expect(emitNode(buildSurface(schema, cyclic))).toMatchObject(expected);
		expect(emitNode(buildSurface(schema, { value: undefined }))).toMatchObject(expected);
		expect(emitNode(buildSurface(schema, { value: "\ud800" }))).toMatchObject(expected);
		expect(emitNode(buildSurface({ type: "number" }, Number.NaN))).toMatchObject(expected);
		expect(
			emitNode(
				buildSurface(
					{ type: "number", "x-morphe": { strategy: "number" } },
					Number.POSITIVE_INFINITY,
				),
			),
		).toMatchObject(expected);
	});

	it("uses exact Python whitespace for empty states and visible status text", () => {
		const empty = emitNode(buildSurface({ type: "array", title: "\u0085", items: {} }, []));
		expect(JSON.stringify(empty)).toContain("No items.");
		const status = emitNode(
			buildSurface({ type: "string", "x-morphe": { strategy: "status" } }, "\ufeffready\ufeff"),
		);
		expect(status).toMatchObject({ signal: { text: "\ufeffready\ufeff" } });
	});

	it("degrades compiler recursion exhaustion to a bounded diagnostic node", () => {
		const schema = {
			type: "array",
			items: { type: "array", items: { type: "array", items: { type: "string" } } },
		};
		const spec = buildSurface(schema, [[[["too deep"]]]], {
			limits: { maxRecursionDepth: 1 },
		});
		expect(spec.strategy).toBe("diagnostic-node");
		expect(spec.diagnostics[0]?.code).toBe("COMPILER_DEPTH_LIMIT");
	});

	it("fails closed when mechanical emission exceeds its node budget", () => {
		const spec = surfaceNode({
			path: "$",
			label: "Root",
			strategy: "record-card",
			children: [surfaceNode({ path: "$.name", label: "Name", strategy: "scalar", value: "Ada" })],
		});
		expect(() => emitNode(spec, { maxEmittedNodes: 1 })).toThrow(SurfaceEmitLimitError);
	});

	it("keeps Python scalar spelling for booleans and schema-number integral floats", () => {
		const boolean = buildSurface({ type: "boolean" }, true);
		const floating = buildSurface({ type: "number" }, 100);
		expect(emitNode(boolean)).toMatchObject({ kind: "text", value: "True" });
		expect(emitNode(floating)).toMatchObject({ kind: "text", value: "100.0" });
	});

	it("retains a grid item for a nullable table cell without inventing data", () => {
		const spec = buildSurface(
			{
				type: "array",
				title: "Roster",
				"x-morphe": { strategy: "table" },
				items: {
					type: "object",
					"x-morphe": { order: ["name", "rate", "profile"] },
					properties: {
						name: { type: "string", title: "Name" },
						rate: {
							title: "Rate",
							anyOf: [{ type: "number" }, { type: "null" }],
						},
						profile: {
							type: "object",
							title: "Profile",
							"x-morphe": { strategy: "linked-ref" },
						},
					},
				},
			},
			[{ name: "Ada", rate: null, profile: { label: "Open Ada", href: "/workers/ada" } }],
		);
		expect(emitNode(spec)).toMatchObject({
			kind: "stack",
			children: [
				{ kind: "text", value: "Roster" },
				{
					kind: "grid",
					children: [
						{ kind: "grid" },
						{
							kind: "grid",
							children: [
								{ kind: "text", value: "Ada" },
								{ kind: "spacer", size: "xs" },
								{ kind: "link", href: "/workers/ada", label: "Open Ada" },
							],
						},
					],
				},
			],
		});
		expect(validateNodeDocument(emitNode(spec)).ok).toBe(true);
	});

	it("returns a dialect-free deterministic compilation receipt", () => {
		const source = {
			schema: {
				type: "object",
				"x-morphe": { order: ["name"] },
				properties: { name: { type: "string", title: "Name" } },
			},
			data: { name: "Ada" },
			diagnostics: [],
			sourceTestimonySha256: HASH,
		} as unknown as TrustedSourceSurface;
		const first = compileSourceSurface(source);
		const second = compileSourceSurface(source);
		expect(first).toEqual(second);
		expect(first.receipt).not.toHaveProperty("dialectId");
		expect(first.receipt).not.toHaveProperty("dialectPolicySha256");
		expect(first.receipt.treeSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
		expect(first.receipt.diagnosticsSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
		expect(first.receipt.compilerBuildSha256).toBe(COMPILER_BUILD_SHA256);
	});
});

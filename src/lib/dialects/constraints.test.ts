import { describe, expect, it } from "vitest";
import { PROMOTED_COMPOUNDS } from "../compounds/catalog.generated.js";
import { registry } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { DIALECT_COMPOUND_CONSTRAINTS } from "./constraints.generated.js";
import { validateNodeForDialect } from "./constraints.js";
import { DIALECTS } from "./registry.js";

const signalCard = (body: readonly Node[] = []): Node => ({
	kind: "compound",
	name: "SignalCard",
	args: {
		kicker: { kind: "text", value: "Signal", as: "caption" },
		title: { kind: "text", value: "Validated", as: "heading" },
	},
	slots: { body },
});

describe("generated dialect constraints", () => {
	it("keeps the Python-owned catalog, registry, and shipped dialects in parity", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toEqual([
			"SignalCard",
			"EntityHeader",
			"StatBand",
			"Breakdown",
			"TrailEntry",
			"KeyValuePanel",
		]);
		expect(registry.has("SignalCard")).toBe(true);
		expect(registry.has("EntityHeader")).toBe(true);
		expect(registry.has("StatBand")).toBe(true);
		expect(registry.has("Breakdown")).toBe(true);
		expect(registry.has("TrailEntry")).toBe(true);
		expect(registry.has("KeyValuePanel")).toBe(true);
		expect(Object.keys(DIALECT_COMPOUND_CONSTRAINTS)).toEqual(Object.keys(DIALECTS));
		for (const [id, dialect] of Object.entries(DIALECTS)) {
			expect(dialect.compounds).toEqual(
				DIALECT_COMPOUND_CONSTRAINTS[id as keyof typeof DIALECT_COMPOUND_CONSTRAINTS].compounds,
			);
		}
	});

	it("accepts the exact promoted SignalCard under the restricted clinical dialect", () => {
		expect(validateNodeForDialect(signalCard(), "clinical")).toEqual({ ok: true });
	});

	it("rejects disallowed compounds anywhere in a restricted tree", () => {
		const tree = signalCard([
			{
				kind: "compound",
				name: "consumer-private-card",
				args: {},
			},
		]);
		const result = validateNodeForDialect(tree, "clinical");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				code: "compound-policy",
				message: 'compound "consumer-private-card" is not permitted by dialect "clinical"',
			}),
		);
	});

	it("recurses through node-valued compound arguments", () => {
		const tree = signalCard();
		if (tree.kind !== "compound") throw new Error("test fixture must be a compound");
		const result = validateNodeForDialect(
			{
				...tree,
				args: {
					...tree.args,
					kicker: {
						kind: "frame",
						role: "panel",
						children: [{ kind: "compound", name: "consumer-private-card", args: {} }],
					},
				},
			},
			"clinical",
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				code: "compound-policy",
				path: ["args", "kicker", "children", 0, "name"],
			}),
		);
	});

	it("enforces the dialect policy inside a targeted Within", () => {
		const result = validateNodeForDialect(
			{
				kind: "within",
				id: "bounded-region",
				dimension: "density",
				range: [0, 2],
				default: 1,
				target: { kind: "compound", name: "consumer-private-card", args: {} },
			},
			"clinical",
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				code: "compound-policy",
				path: ["target", "name"],
			}),
		);
	});

	it("keeps a targetless Within as a policy-neutral leaf", () => {
		const targetless: Node = {
			kind: "within",
			id: "legacy-density-leaf",
			dimension: "density",
			range: [0, 2],
			default: 1,
		};

		expect(validateNodeForDialect(targetless, "clinical")).toEqual({ ok: true });
	});

	it("rejects malformed promoted calls even when the name is permitted", () => {
		const result = validateNodeForDialect(
			{ kind: "compound", name: "SignalCard", args: {} },
			"clinical",
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues.map((issue) => issue.message)).toEqual([
			'missing required argument "kicker"',
			'missing required argument "title"',
		]);
	});

	it("rejects inherited object-property names as unknown compound arguments", () => {
		const tree = signalCard();
		if (tree.kind !== "compound") throw new Error("test fixture must be a compound");
		const result = validateNodeForDialect(
			{ ...tree, args: { ...tree.args, toString: true } },
			"clinical",
		);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues.map((issue) => issue.message)).toContain('unknown argument "toString"');
	});

	it("accepts an ingress validator for complete node-valued argument checks", () => {
		const malformed: Node = {
			kind: "compound",
			name: "SignalCard",
			args: {
				kicker: { kind: "text" },
				title: { kind: "text", value: "Valid" },
			},
		};
		const result = validateNodeForDialect(malformed, "clinical", {
			validateNodeValue: (value) =>
				typeof value === "object" &&
				value !== null &&
				Reflect.get(value, "kind") === "text" &&
				typeof Reflect.get(value, "value") === "string",
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues[0]?.message).toBe('argument "kicker" must contain schema-valid nodes');
	});

	it.each([
		["frame", { kind: "frame" }],
		["vary", { kind: "vary" }],
		["allowed compound", { kind: "compound", name: "SignalCard" }],
	] as const)("fails structurally for malformed recursive %s args without throwing", (_label, arg) => {
		const malformed: Node = {
			kind: "compound",
			name: "SignalCard",
			args: {
				kicker: arg,
				title: { kind: "text", value: "Valid" },
			},
		};
		const result = validateNodeForDialect(malformed, "clinical", {
			validateNodeValue: (value) =>
				typeof value === "object" &&
				value !== null &&
				Reflect.get(value, "kind") === "text" &&
				typeof Reflect.get(value, "value") === "string",
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues).toContainEqual(
			expect.objectContaining({
				code: "compound-reference",
				path: ["args", "kicker"],
			}),
		);
	});

	it("preserves explicit unrestricted compatibility for existing dialects", () => {
		const consumerCompound: Node = {
			kind: "compound",
			name: "consumer-private-card",
			args: { arbitrary: { nested: true } },
		};
		for (const id of Object.keys(DIALECTS)) {
			if (id === "clinical") continue;
			expect(validateNodeForDialect(consumerCompound, id)).toEqual({ ok: true });
		}
	});

	it("validates package-known compound calls under unrestricted dialects", () => {
		const malformed: Node = {
			kind: "compound",
			name: "SignalCard",
			args: {
				kicker: { kind: "text" },
				title: { kind: "text", value: "Valid" },
			},
		};
		const result = validateNodeForDialect(malformed, "gallery", {
			validateNodeValue: (value) =>
				typeof value === "object" &&
				value !== null &&
				Reflect.get(value, "kind") === "text" &&
				typeof Reflect.get(value, "value") === "string",
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues[0]?.message).toBe('argument "kicker" must contain schema-valid nodes');
	});

	it("fails closed for an unknown dialect", () => {
		const result = validateNodeForDialect({ kind: "text", value: "safe" }, "invented");
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues[0]?.code).toBe("unknown-dialect");
	});

	it.each([
		"toString",
		"__proto__",
		"constructor",
	])("does not treat inherited object property %s as a dialect", (id) => {
		const result = validateNodeForDialect({ kind: "text", value: "safe" }, id);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected dialect validation to fail");
		expect(result.issues[0]?.code).toBe("unknown-dialect");
	});
});

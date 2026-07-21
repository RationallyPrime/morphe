import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import { buildSurface } from "./build.js";
import { emitNode } from "./emit.js";
import type { JsonSchema } from "./spec.js";

function generator(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

function schemaOf(random: () => number, depth = 0): JsonSchema {
	if (depth >= 4 || random() < 0.42) {
		const leaves: readonly JsonSchema[] = [
			{ type: "string" },
			{ type: "integer" },
			{ type: "boolean" },
			{ enum: ["a", "b"] },
			{},
		];
		return leaves[Math.floor(random() * leaves.length)] ?? {};
	}
	if (random() < 0.58) {
		const count = 1 + Math.floor(random() * 3);
		const properties: Record<string, JsonSchema> = {};
		const order: string[] = [];
		for (let index = 0; index < count; index += 1) {
			const key = `f${depth}_${index}`;
			properties[key] = schemaOf(random, depth + 1);
			order.push(key);
		}
		return { type: "object", "x-morphe": { order }, properties };
	}
	return { type: "array", items: schemaOf(random, depth + 1) };
}

function dataOf(random: () => number, depth = 0): unknown {
	if (depth >= 4) return random() < 0.5 ? null : Math.floor(random() * 20) - 10;
	const choice = Math.floor(random() * 6);
	if (choice === 0) return null;
	if (choice === 1) return random() < 0.5;
	if (choice === 2) return Math.floor(random() * 200) - 100;
	if (choice === 3) return `value-${Math.floor(random() * 20)}`;
	if (choice === 4) return [dataOf(random, depth + 1), dataOf(random, depth + 1)];
	return { a: dataOf(random, depth + 1), b: dataOf(random, depth + 1) };
}

describe("surface compiler bounded totality", () => {
	it("always emits a grammar-valid Node over a deterministic schema/data corpus", () => {
		const random = generator(0x762c0de);
		for (let index = 0; index < 250; index += 1) {
			const schema = schemaOf(random);
			const data = dataOf(random);
			const node = emitNode(buildSurface(schema, data));
			const validation = validateNodeDocument(node);
			expect(validation.ok, `case ${index}: ${JSON.stringify({ schema, data })}`).toBe(true);
		}
	});
});

// KRA-765 F3: the corpus above only generates well-formed schemas and never
// carries a hidden marker. Adversarial totality drives a coordinated schema+data
// generator that injects the failure shapes an attacker actually reaches for —
// hidden markers (inline, via $ref, and via a hint that shadows the $ref target),
// malformed hints, cyclic $refs, and shuffled/duplicate/partial/ghost order arrays
// — and proves the compiler still emits a grammar-valid Node whose bytes carry no
// hidden sentinel. Sentinels sit ONLY where the compiler contractually prunes them:
// as hidden properties of an object the compiler builds as a record. Minimization
// removes hidden classes at other positions upstream, so the compiler is not
// contracted to defend them and this generator does not plant sentinels there.

interface AdversarialCase {
	readonly root: JsonSchema;
	readonly data: unknown;
	readonly sentinels: readonly string[];
}

function adversarialCase(random: () => number): AdversarialCase {
	const defs: Record<string, JsonSchema> = {};
	const sentinels: string[] = [];
	let counter = 0;
	const nextId = (): number => {
		counter += 1;
		return counter;
	};

	function ensureCycleDef(): string {
		const name = "Cycle";
		if (!(name in defs)) {
			defs[name] = {
				type: "object",
				"x-morphe": { order: ["leaf", "next"] },
				properties: { leaf: { type: "string" }, next: { $ref: "#/$defs/Cycle" } },
			};
		}
		return name;
	}

	function hiddenObjectSchema(): JsonSchema {
		return {
			type: "object",
			"x-morphe": { hidden: true, order: ["s"] },
			properties: { s: { type: "string" } },
		};
	}

	function hiddenProperty(): { readonly schema: JsonSchema; readonly data: unknown } {
		const sentinel = `MORPHE-ADVERSARIAL-SENTINEL-${nextId()}`;
		sentinels.push(sentinel);
		const data = { s: sentinel };
		if (random() < 0.5) {
			// Hidden via $ref, half the time behind a call-site hint that carries no
			// `hidden` key — the shadowing attack that must NOT re-expose the class.
			const name = `Hidden${nextId()}`;
			defs[name] = hiddenObjectSchema();
			const schema: JsonSchema =
				random() < 0.5
					? { $ref: `#/$defs/${name}`, "x-morphe": { label: "Card" } }
					: { $ref: `#/$defs/${name}` };
			return { schema, data };
		}
		return { schema: hiddenObjectSchema(), data };
	}

	function malformedLeaf(): { readonly schema: JsonSchema; readonly data: unknown } {
		return {
			schema: {
				type: "string",
				"x-morphe": { role: 123, format: "bogus", order: "not-an-array", weird: true },
			},
			data: `visible-${nextId()}`,
		};
	}

	function cyclicProperty(): { readonly schema: JsonSchema; readonly data: unknown } {
		const name = ensureCycleDef();
		return {
			schema: { $ref: `#/$defs/${name}` },
			data: { leaf: `leaf-${nextId()}`, next: { leaf: `leaf-${nextId()}`, next: null } },
		};
	}

	function scalarLeaf(): { readonly schema: JsonSchema; readonly data: unknown } {
		return random() < 0.5
			? { schema: { type: "string" }, data: `visible-${nextId()}` }
			: { schema: { type: "integer" }, data: Math.floor(random() * 200) - 100 };
	}

	function property(depth: number): { readonly schema: JsonSchema; readonly data: unknown } {
		const roll = random();
		if (roll < 0.28) return hiddenProperty();
		if (roll < 0.42) return malformedLeaf();
		if (roll < 0.52) return cyclicProperty();
		if (roll < 0.68 && depth < 3) return objectSchema(random, depth + 1);
		return scalarLeaf();
	}

	function adversarialOrder(keys: readonly string[]): string[] {
		const order = [...keys];
		for (let index = order.length - 1; index > 0; index -= 1) {
			const swap = Math.floor(random() * (index + 1));
			const held = order[index] as string;
			order[index] = order[swap] as string;
			order[swap] = held;
		}
		if (order.length > 0 && random() < 0.5) order.push(order[0] as string);
		if (random() < 0.4) order.push(`ghost-${nextId()}`);
		if (order.length > 1 && random() < 0.3) order.pop();
		return order;
	}

	function objectSchema(
		rng: () => number,
		depth: number,
	): { readonly schema: JsonSchema; readonly data: unknown } {
		const count = 1 + Math.floor(rng() * 3);
		const properties: Record<string, JsonSchema> = {};
		const data: Record<string, unknown> = {};
		const keys: string[] = [];
		for (let index = 0; index < count; index += 1) {
			const key = `p${depth}_${index}`;
			const built = property(depth);
			properties[key] = built.schema;
			data[key] = built.data;
			keys.push(key);
		}
		return {
			schema: { type: "object", "x-morphe": { order: adversarialOrder(keys) }, properties },
			data,
		};
	}

	const top = objectSchema(random, 0);
	const root: JsonSchema =
		Object.keys(defs).length > 0
			? { ...(top.schema as Record<string, unknown>), $defs: defs }
			: top.schema;
	return { root, data: top.data, sentinels };
}

describe("surface compiler adversarial totality", () => {
	it("never leaks a hidden sentinel and stays grammar-valid under adversarial input", () => {
		const random = generator(0x5a17_c0de);
		let plantedSentinels = 0;
		for (let index = 0; index < 200; index += 1) {
			const { root, data, sentinels } = adversarialCase(random);
			plantedSentinels += sentinels.length;
			const node = emitNode(buildSurface(root, data));

			const validation = validateNodeDocument(node);
			expect(validation.ok, `case ${index}: ${JSON.stringify({ root, data })}`).toBe(true);

			const serialized = JSON.stringify(node);
			for (const sentinel of sentinels) {
				expect(
					serialized.includes(sentinel),
					`case ${index} leaked hidden sentinel ${sentinel}`,
				).toBe(false);
			}
		}
		// Guard against a generator regression that stops planting hidden markers,
		// which would turn the leak assertion into theatre.
		expect(plantedSentinels).toBeGreaterThan(0);
	});
});

// KRA-767: the temporal policy is a compiler option over instant-typed scalars.
// Totality over the policy enum: every policy emits a grammar-valid Node and never
// crashes, and the exact value is always recoverable by compiling under `exact`.

const TEMPORAL_POLICIES = ["exact", "minute", "date", "relative"] as const;

/** A random, well-formed RFC 3339 instant (UTC), deterministic in `random`. */
function instantOf(random: () => number): string {
	const pad = (n: number, width: number): string => String(n).padStart(width, "0");
	const year = 2000 + Math.floor(random() * 60);
	const month = 1 + Math.floor(random() * 12);
	const day = 1 + Math.floor(random() * 28);
	const hour = Math.floor(random() * 24);
	const minute = Math.floor(random() * 60);
	const second = Math.floor(random() * 60);
	const micros = Math.floor(random() * 1_000_000);
	const fraction = random() < 0.5 ? `.${pad(micros, 6)}` : "";
	return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}${fraction}Z`;
}

describe("surface compiler temporal-policy totality", () => {
	it("emits a grammar-valid Node for every policy and keeps exact recoverable", () => {
		const random = generator(0x7e_46_70_11);
		const now = (): Date => new Date("2030-01-01T00:00:00Z");
		for (let index = 0; index < 250; index += 1) {
			const instant = instantOf(random);
			const spec = buildSurface({ type: "string", title: "Instant" }, instant);
			// The intermediate IR keeps the exact value beneath any display policy.
			expect(spec.value, `case ${index}`).toBe(instant);

			let exactText: string | undefined;
			for (const temporalPolicy of TEMPORAL_POLICIES) {
				const node = emitNode(spec, undefined, { temporalPolicy, now });
				expect(
					validateNodeDocument(node).ok,
					`case ${index} under ${temporalPolicy}: ${instant}`,
				).toBe(true);
				if (node.kind !== "stack" || node.role !== "section")
					throw new Error("expected root task stack");
				const valueNode = node.children[1];
				if (valueNode?.kind !== "text") throw new Error("expected temporal text payload");
				expect(typeof valueNode.value, `case ${index} under ${temporalPolicy}`).toBe("string");
				// Determinism: identical (spec, policy, now) yields identical text.
				const again = emitNode(spec, undefined, { temporalPolicy, now });
				if (again.kind !== "stack" || again.children[1]?.kind !== "text") {
					throw new Error("expected deterministic temporal text payload");
				}
				expect(again.children[1].value).toBe(valueNode.value);
				if (temporalPolicy === "exact") exactText = valueNode.value;
			}
			// Exact is always recoverable: `exact` renders the instant verbatim.
			expect(exactText, `case ${index}`).toBe(instant);
		}
	});
});

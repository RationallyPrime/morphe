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

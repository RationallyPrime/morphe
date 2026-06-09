import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	createInMemoryMorpheStore,
	resolveMorpheStore,
	type JsonValue,
} from "./store.svelte.js";

describe("Morphe client store — ADR-0003 contract", () => {
	it("resolves ownership as prop > context > per-root default", () => {
		const prop = createInMemoryMorpheStore();
		const context = createInMemoryMorpheStore();
		const fallback = createInMemoryMorpheStore();

		expect(resolveMorpheStore(undefined, context, fallback)).toBe(context);
		expect(resolveMorpheStore(prop, context, fallback)).toBe(prop);
		expect(resolveMorpheStore(undefined, undefined, fallback)).toBe(fallback);
	});

	it("stores full JSON values and returns JSON-round-trippable snapshots", () => {
		const store = createInMemoryMorpheStore();
		const cases: readonly JsonValue[] = [
			null,
			true,
			42,
			"folio",
			["a", 1, false, null],
			{ filters: ["open", "late"], range: { min: 3, max: 9 }, visible: true },
		];

		for (let i = 0; i < cases.length; i++) {
			const value = cases[i] as JsonValue;
			store.set(`case.${i}`, value);
			expect(JSON.parse(JSON.stringify(store.get(`case.${i}`)))).toEqual(value);
		}

		expect(JSON.parse(JSON.stringify(store.snapshot()))).toEqual({
			"case.0": null,
			"case.1": true,
			"case.2": 42,
			"case.3": "folio",
			"case.4": ["a", 1, false, null],
			"case.5": { filters: ["open", "late"], range: { min: 3, max: 9 }, visible: true },
		});
	});

	it("replaces values on write and notifies subscribers on every set", () => {
		const store = createInMemoryMorpheStore();
		const seen: Array<JsonValue | undefined> = [];
		const unsubscribe = store.subscribe("filters", (value) => {
			seen.push(value);
		});

		store.set("filters", { status: "open" });
		store.set("filters", { status: "open" });
		store.set("filters", { status: "closed" });
		unsubscribe();
		store.set("filters", { status: "ignored" });

		expect(seen).toEqual([
			{ status: "open" },
			{ status: "open" },
			{ status: "closed" },
		]);
		expect(store.get("filters")).toEqual({ status: "ignored" });
	});

	it("freezes returned object and array values in dev", () => {
		const store = createInMemoryMorpheStore({
			nested: { list: [{ id: "a" }] },
		});
		const value = store.get("nested");
		expect(Object.isFrozen(value)).toBe(true);
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error("expected object value");
		}
		const obj = value as { readonly list: readonly unknown[] };
		expect(Object.isFrozen(obj.list)).toBe(true);
		expect(Object.isFrozen(obj.list[0])).toBe(true);
		expect(() => {
			(value as { list: unknown[] }).list = [];
		}).toThrow();
	});

	it("keeps store reads inside primitives that declare binding paths", () => {
		const primitivesDir = fileURLToPath(new URL("../primitives", import.meta.url));
		const readers = svelteFiles(primitivesDir)
			.filter((file) => read(file).includes("useMorpheStore"))
			.map((file) => basename(file))
			.sort();

		expect(readers).toEqual([
			"Dialog.svelte",
			"Field.svelte",
			"Popover.svelte",
			"Range.svelte",
			"Select.svelte",
			"Toggle.svelte",
		]);
		for (const file of svelteFiles(primitivesDir)) {
			const content = read(file);
			if (content.includes("useMorpheStore")) {
				expect(content, file).toContain("node.bind");
			}
		}
	});
});

function svelteFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) out.push(...svelteFiles(path));
		else if (entry.endsWith(".svelte")) out.push(path);
	}
	return out;
}

function read(path: string): string {
	return readFileSync(path, "utf8");
}

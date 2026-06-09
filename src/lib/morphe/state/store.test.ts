import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	commitTier1,
	createInMemoryMorpheStore,
	resolveMorpheStore,
	TIER1_WINDOW_SIZE,
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

describe("Morphe event tiers — the purity taxonomy (Lemma 5, R1.2)", () => {
	/** A deterministic clock: injected, ticking 100ms per stamp. */
	function tickingClock(start = 1000, step = 100): () => number {
		let t = start - step;
		return () => {
			t += step;
			return t;
		};
	}

	it("commitTier1 writes the value AND records the event, stamped by the injected clock", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock(1000) });
		commitTier1(store, "filters.status", "selection", "open");
		commitTier1(store, "filters.range", "filter-edit", { min: 1, max: 9 });

		expect(store.get("filters.status")).toBe("open");
		expect(store.get("filters.range")).toEqual({ min: 1, max: 9 });
		expect(store.recentEvents()).toEqual([
			{ tier: 1, kind: "selection", path: "filters.status", value: "open", at: 1000 },
			{ tier: 1, kind: "filter-edit", path: "filters.range", value: { min: 1, max: 9 }, at: 1100 },
		]);
	});

	it("is a no-op without a store or a bind path (unbound primitives stay local)", () => {
		const store = createInMemoryMorpheStore();
		commitTier1(undefined, "a", "selection", 1);
		commitTier1(store, undefined, "selection", 1);
		expect(store.recentEvents()).toEqual([]);
		expect(store.snapshot()).toEqual({});
	});

	it("the recent-event window is bounded FIFO at TIER1_WINDOW_SIZE", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock(0, 1) });
		const total = TIER1_WINDOW_SIZE + 8;
		for (let i = 0; i < total; i++) {
			commitTier1(store, `p.${i}`, "sort", i);
		}
		const window = store.recentEvents();
		expect(window.length).toBe(TIER1_WINDOW_SIZE);
		// Oldest dropped, order preserved: the first survivor is event #8.
		expect(window[0]?.value).toBe(8);
		expect(window[window.length - 1]?.value).toBe(total - 1);
	});

	it("recorded events are snapshots, not live references (and frozen in dev)", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock() });
		const value = { list: ["a"] };
		commitTier1(store, "sel", "selection", value);
		// Mutating the caller's object after the commit must not rewrite history.
		value.list.push("b");
		const recorded = store.recentEvents()[0];
		expect(recorded?.value).toEqual({ list: ["a"] });
		expect(Object.isFrozen(recorded)).toBe(true);
		expect(() => {
			(recorded as { value: unknown }).value = null;
		}).toThrow();
	});

	it("events are not state: the window never leaks into snapshot()", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock() });
		commitTier1(store, "sel", "selection", "x");
		expect(store.snapshot()).toEqual({ sel: "x" });
	});

	it("tier boundaries are structural: commit surfaces accept tier-1 shapes only", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock() });
		// The recorder mints tier and stamp itself — the input shape carries
		// neither, so a forged `tier: 2` is unrepresentable at this surface.
		store.recordEvent({ kind: "expand", path: "dlg", value: true });
		const e = store.recentEvents()[0];
		expect(e?.tier).toBe(1);
		expect(typeof e?.at).toBe("number");
	});

	it("tier-1 handlers cannot escalate: no input/overlay primitive touches the escalation context", () => {
		const primitivesDir = fileURLToPath(new URL("../primitives", import.meta.url));
		for (const file of svelteFiles(primitivesDir)) {
			const content = read(file);
			expect(content, file).not.toContain("useEscalation");
			// And every store write goes through the atomic commit helper —
			// no raw `.set(` writes that could skip the event window.
			if (content.includes("useMorpheStore")) {
				expect(content, file).toContain("commitTier1");
				expect(content, file).not.toMatch(/store\.set\(/);
			}
		}
	});
});

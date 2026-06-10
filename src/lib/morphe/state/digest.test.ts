import { describe, expect, it, vi } from "vitest";
import { digestOf, escalationWithDigest } from "./digest.js";
import { commitTier1, createInMemoryMorpheStore } from "./store.svelte.js";
import type { Tier2Event } from "./events.js";

describe("ContextDigest — typed snapshot and escalation recorder (R1.3)", () => {
	it("is a JSON-round-trippable snapshot of tier-1 state plus recent events", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock(1000) });
		commitTier1(store, "filters.status", "selection", "open");
		commitTier1(store, "filters.range", "filter-edit", { min: 2, max: 8 });

		const digest = digestOf(store);

		expect(digest).toEqual({
			digestVersion: 1,
			state: {
				"filters.status": "open",
				"filters.range": { min: 2, max: 8 },
			},
			recentEvents: [
				{ tier: 1, kind: "selection", path: "filters.status", value: "open", at: 1000 },
				{
					tier: 1,
					kind: "filter-edit",
					path: "filters.range",
					value: { min: 2, max: 8 },
					at: 1100,
				},
			],
		});
		expect(JSON.parse(JSON.stringify(digest))).toEqual(digest);
	});

	it("records the current digest at the tier-2 escalation moment", () => {
		const store = createInMemoryMorpheStore({}, { now: tickingClock(500) });
		const onEscalate = vi.fn();
		const emit = escalationWithDigest(store, onEscalate);
		const event: Tier2Event = { tier: 2, kind: "submit", id: "request-access" };

		commitTier1(store, "form.name", "filter-edit", "Ada");
		emit?.(event);

		expect(onEscalate).toHaveBeenCalledOnce();
		expect(onEscalate).toHaveBeenCalledWith({
			event,
			digest: {
				digestVersion: 1,
				state: { "form.name": "Ada" },
				recentEvents: [
					{ tier: 1, kind: "filter-edit", path: "form.name", value: "Ada", at: 500 },
				],
			},
		});
	});

	it("omits the escalation emitter when no boundary handler is supplied", () => {
		const store = createInMemoryMorpheStore();

		expect(escalationWithDigest(store, undefined)).toBeUndefined();
	});
});

function tickingClock(start: number, step = 100): () => number {
	let t = start - step;
	return () => {
		t += step;
		return t;
	};
}

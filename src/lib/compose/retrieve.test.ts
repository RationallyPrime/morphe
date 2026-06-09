/**
 * The retrieval layer (ADR-0002, WS9): the embedding fixed point, cosine, and the
 * system-aware cosine retriever. No network — the real-data checks use a committed
 * capability embedding as its own query (self-retrieval), so they are deterministic.
 */

import { describe, expect, it } from "vitest";
import type { Capability, SystemId } from "./capability.js";
import { CAPABILITIES } from "./corpus.js";
import { CAPABILITY_EMBEDDINGS, EMBEDDINGS_META } from "./embeddings.js";
import { cosine, retrieve } from "./retrieve.js";
import { SYSTEMS } from "./taxonomy.js";

const ALL_SYSTEMS: SystemId[] = SYSTEMS.map((s) => s.id);

/** A minimal, fully-typed capability fixture — retrieve only reads id + systems. */
function fakeCap(id: string, systems: SystemId[]): Capability {
	const ref = { id: systems[0] ?? "x", label: "x" };
	return {
		id,
		title: id,
		painPoints: [],
		systems,
		source: ref,
		target: ref,
		transform: "",
		value: "",
		surfaces: [],
		tier: "read-only",
	};
}

describe("retrieval — the embedding fixed point", () => {
	it("ships exactly one embedding per capability, at the declared dimension", () => {
		expect(EMBEDDINGS_META.count).toBe(CAPABILITIES.length);
		for (const cap of CAPABILITIES) {
			const vec = CAPABILITY_EMBEDDINGS[cap.id];
			expect(vec, `missing embedding for ${cap.id}`).toBeDefined();
			expect(vec?.length, `wrong dimension for ${cap.id}`).toBe(EMBEDDINGS_META.dimension);
		}
	});

	it("has no orphan embeddings (every embedded id is a real capability)", () => {
		const ids = new Set(CAPABILITIES.map((c) => c.id));
		for (const id of Object.keys(CAPABILITY_EMBEDDINGS)) {
			expect(ids.has(id), `orphan embedding ${id}`).toBe(true);
		}
	});
});

describe("retrieval — cosine", () => {
	it("is 1 for identical direction, -1 for opposite, 0 for orthogonal", () => {
		expect(cosine([1, 0], [1, 0])).toBeCloseTo(1, 10);
		expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
		expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 10);
	});

	it("returns 0 (not NaN) for a zero-magnitude vector", () => {
		expect(cosine([0, 0], [1, 1])).toBe(0);
		expect(Number.isNaN(cosine([0, 0], [0, 0]))).toBe(false);
	});

	it("is scale-invariant", () => {
		expect(cosine([2, 0], [5, 0])).toBeCloseTo(1, 10);
	});
});

describe("retrieval — retrieve (synthetic, deterministic)", () => {
	const corpus = [fakeCap("a", ["twenty"]), fakeCap("b", ["twenty"]), fakeCap("c", ["dkplus"])];
	const emb: Record<string, readonly number[]> = { a: [1, 0], b: [0, 1], c: [1, 0] };

	it("orders eligible caps by cosine similarity to the query", () => {
		const out = retrieve([0.9, 0.1], ["twenty"], 10, corpus, emb);
		expect(out.map((r) => r.capability.id)).toEqual(["a", "b"]);
		expect(out[0]?.similarity).toBeGreaterThan(out[1]?.similarity ?? 1);
	});

	it("hard-gates on subset eligibility (a dkplus cap never surfaces for twenty-only)", () => {
		const out = retrieve([1, 0], ["twenty"], 10, corpus, emb);
		expect(out.map((r) => r.capability.id)).not.toContain("c");
	});

	it("unlocks the gated cap once its system is selected", () => {
		const out = retrieve([1, 0], ["twenty", "dkplus"], 10, corpus, emb);
		expect(out.map((r) => r.capability.id)).toContain("c");
	});

	it("caps the shortlist at k", () => {
		const out = retrieve([1, 0], ["twenty", "dkplus"], 1, corpus, emb);
		expect(out).toHaveLength(1);
	});
});

describe("retrieval — retrieve (real corpus, self-retrieval)", () => {
	it("ranks a capability first when queried with its own embedding", () => {
		const target = CAPABILITIES[0];
		expect(target).toBeDefined();
		const query = CAPABILITY_EMBEDDINGS[target!.id];
		expect(query).toBeDefined();
		const out = retrieve(query!, ALL_SYSTEMS, 5, CAPABILITIES);
		expect(out[0]?.capability.id).toBe(target!.id);
		expect(out[0]?.similarity).toBeCloseTo(1, 4);
		expect(out.length).toBeLessThanOrEqual(5);
	});
});

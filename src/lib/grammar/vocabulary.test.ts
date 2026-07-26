/**
 * Grammar vocabulary-neutrality gate, TS side (KRA-825 gate 1).
 *
 * `py/morphe_grammar/vocabulary.json` is the single registered source of truth
 * for the authored-facing intent vocabulary. The Python gate
 * (py/tests/test_vocabulary.py) holds models.py to it; this mirror holds the
 * EMITTED artifacts to it — both the runtime intent lists (tokens/intents.ts,
 * what dialect parity keys off) and the generated `types.ts` unions (which a
 * hand edit could otherwise drift without touching any runtime value).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CORE_INTENTS, REGISTER_INTENTS } from "../tokens/intents.js";

interface Vocabulary {
	readonly core: readonly string[];
	readonly register: readonly string[];
	readonly grandfathered_vertical: readonly string[];
}

function load(rel: string): string {
	return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const vocabulary = JSON.parse(load("../../../py/morphe_grammar/vocabulary.json")) as Vocabulary;

/** The literal members of a `export type X = ...` string-literal union in types.ts. */
function generatedUnion(name: string): readonly string[] {
	const source = load("./types.ts");
	const m = source.match(new RegExp(`export type ${name} =([^;]+);`));
	expect(m, `types.ts is missing the generated ${name} union`).not.toBeNull();
	return [...(m?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((g) => g[1] as string);
}

describe("the registered intent vocabulary is the single source of truth (KRA-825)", () => {
	it("the runtime core-intent list equals the registry, in order", () => {
		expect([...CORE_INTENTS]).toEqual([...vocabulary.core]);
	});

	it("the runtime register-intent list equals the registry, in order", () => {
		expect([...REGISTER_INTENTS]).toEqual([...vocabulary.register]);
	});

	it("the generated types.ts unions equal the registry (a hand edit cannot drift them)", () => {
		expect(generatedUnion("CoreIntent")).toEqual([...vocabulary.core]);
		expect(generatedUnion("RegisterIntent")).toEqual([...vocabulary.register]);
	});

	it("grandfathered vertical names annotate registered names only", () => {
		const registered = new Set([...vocabulary.core, ...vocabulary.register]);
		for (const name of vocabulary.grandfathered_vertical) {
			expect(registered.has(name), `${name} grandfathered but not registered`).toBe(true);
		}
	});

	it("the grandfather list stays empty and the retired vertical names stay retired", () => {
		// KRA-831 ratchet (grammar 0.7.0): folio/marginalia/seal became
		// footnote/aside/authority, and provenance/accession were re-classified as
		// neutral discourse roles rather than grandfathered. A new vertical word
		// gets no grandfather slot — domain meaning belongs to dialect metadata.
		expect([...vocabulary.grandfathered_vertical]).toEqual([]);
		const registered = new Set([...vocabulary.core, ...vocabulary.register]);
		for (const retired of ["folio", "marginalia", "seal"]) {
			expect(registered.has(retired), `${retired} was retired at 0.7.0`).toBe(false);
		}
	});
});

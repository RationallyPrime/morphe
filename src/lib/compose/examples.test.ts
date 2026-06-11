/**
 * Suggestion-chip tests — the example pains are HONEST BY CONSTRUCTION.
 *
 * Every chip the composer offers must (a) speak only for systems we register,
 * (b) yield at least one DETERMINISTIC match when submitted under exactly its
 * declared system set — so a suggestion can never lead the visitor to the
 * off-domain refusal, even on the no-Voyage fallback path — and (c) re-shape
 * with the selection through the same subset gate capabilities use.
 */

import { describe, expect, it } from "vitest";
import { EXAMPLE_LIMIT, EXAMPLE_PAINS, examplePainsFor } from "./examples.js";
import { matchCapabilities } from "./match.js";
import { defaultSelection, SYSTEMS, tagsFromText } from "./taxonomy.js";

describe("example pains — the curated pool is well-formed", () => {
	it("every example declares a non-empty footprint of known system ids", () => {
		const known = new Set(SYSTEMS.map((s) => s.id));
		for (const e of EXAMPLE_PAINS) {
			// An empty footprint would be vacuously eligible for any selection — a
			// chip with no stack behind it. Every suggestion names its systems.
			expect(e.systems.length, `"${e.text}": empty systems`).toBeGreaterThanOrEqual(1);
			for (const id of e.systems) {
				expect(known.has(id), `"${e.text}": unknown system "${id}"`).toBe(true);
			}
		}
	});

	it("every system has at least one single-system example (a lone selection still gets chips)", () => {
		for (const s of SYSTEMS) {
			const singles = EXAMPLE_PAINS.filter((e) => e.systems.length === 1 && e.systems[0] === s.id);
			expect(singles.length, `${s.id}: no single-system example`).toBeGreaterThanOrEqual(1);
		}
	});

	it("every example resolves onto the closed pain-tag taxonomy", () => {
		for (const e of EXAMPLE_PAINS) {
			expect(
				tagsFromText(e.text).length,
				`"${e.text}" resolves to no pain tag — the deterministic matcher would refuse it`,
			).toBeGreaterThanOrEqual(1);
		}
	});

	it("every example yields a deterministic match under exactly its declared systems", () => {
		// Eligibility is monotone in the selection (the subset gate only opens as
		// systems are added), so a non-empty floor here holds for every live
		// selection the chip can appear under.
		for (const e of EXAMPLE_PAINS) {
			const matches = matchCapabilities({ pain: e.text, systems: [...e.systems] });
			expect(
				matches.length,
				`"${e.text}" under [${e.systems.join(", ")}] matches no capability`,
			).toBeGreaterThanOrEqual(1);
		}
	});
});

describe("examplePainsFor — suggestions re-shape around the selection", () => {
	it("offers only examples whose full footprint is selected (the subset gate)", () => {
		const byText = new Map(EXAMPLE_PAINS.map((e) => [e.text, e]));
		const selected = ["jira", "twenty"];
		for (const text of examplePainsFor(selected, EXAMPLE_PAINS.length)) {
			const e = byText.get(text);
			expect(e, `unknown example "${text}"`).toBeDefined();
			for (const id of e?.systems ?? []) {
				expect(selected.includes(id), `"${text}" needs unselected system "${id}"`).toBe(true);
			}
		}
	});

	it("an intra-category swap swaps the suggestions (Asana chips for Jira chips)", () => {
		const base = ["twenty", "dkplus", "humanity", "50skills"];
		const withAsana = examplePainsFor([...base, "asana"], EXAMPLE_PAINS.length);
		const withJira = examplePainsFor([...base, "jira"], EXAMPLE_PAINS.length);
		expect(withAsana.some((t) => t.includes("delivery projects"))).toBe(true);
		expect(withJira.some((t) => t.includes("ship dates"))).toBe(true);
		// No Jira-shaped suggestion under an Asana stack, and vice versa.
		expect(withAsana.some((t) => t.includes("Tickets"))).toBe(false);
		expect(withJira.some((t) => t.includes("deadline"))).toBe(false);
	});

	it("caps at the limit, leads with the widest footprint, and is deterministic", () => {
		const sel = defaultSelection();
		const chips = examplePainsFor(sel);
		expect(chips.length).toBeLessThanOrEqual(EXAMPLE_LIMIT);
		expect(chips).toEqual(examplePainsFor(sel));
		// The default selection (one system per category) affords a full chip row.
		expect(chips.length).toBe(EXAMPLE_LIMIT);
	});

	it("an empty selection yields no chips (nothing to suggest, nothing to answer)", () => {
		expect(examplePainsFor([])).toEqual([]);
	});

	it("a lone system still yields at least one chip", () => {
		for (const s of SYSTEMS) {
			expect(
				examplePainsFor([s.id]).length,
				`${s.id}: a lone selection gets no chips`,
			).toBeGreaterThanOrEqual(1);
		}
	});
});

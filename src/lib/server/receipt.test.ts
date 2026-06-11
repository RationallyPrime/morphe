/**
 * Receipt minting tests (KRA-372) — the accession id the sealed dossier carries.
 *
 * The clock and the randomness are INJECTED (the store's StoreOptions.now
 * precedent), so the format is pinned deterministically and the default
 * arguments stay a thin shell over the pure core.
 */

import { describe, expect, it } from "vitest";
import { mintReceiptId, RECEIPT_RE } from "./receipt.js";

/** A tiny deterministic LCG so the test owns its randomness. */
function lcg(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

describe("mintReceiptId", () => {
	const june11 = new Date(Date.UTC(2026, 5, 11, 9, 30));

	it("mints K-YYYYMMDD-XXXX over the no-confusables alphabet", () => {
		const id = mintReceiptId(june11, lcg(42));
		expect(id).toMatch(RECEIPT_RE);
		expect(id.startsWith("K-20260611-")).toBe(true);
	});

	it("is deterministic under an injected clock and rng", () => {
		expect(mintReceiptId(june11, lcg(7))).toBe(mintReceiptId(june11, lcg(7)));
	});

	it("distinct rng streams mint distinct suffixes", () => {
		expect(mintReceiptId(june11, lcg(1))).not.toBe(mintReceiptId(june11, lcg(2)));
	});

	it("never emits a confusable character (0, O, 1, I, L, U)", () => {
		for (let seed = 0; seed < 50; seed++) {
			const suffix = mintReceiptId(june11, lcg(seed)).slice(-4);
			expect(suffix).not.toMatch(/[0O1ILU]/);
		}
	});

	it("uses the wall clock and Math.random by default", () => {
		expect(mintReceiptId()).toMatch(RECEIPT_RE);
	});
});

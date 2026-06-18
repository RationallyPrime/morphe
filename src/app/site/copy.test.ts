/**
 * COPY DECK tests — base + overlay resolution (the cohort copy mechanism).
 *
 * `resolveCopy` is total: an absent overlay returns BASE_COPY unchanged; an
 * overlay merges field-by-field (meta/hero/closingCta), by-key (faq.entries),
 * and replaces faq.order wholesale. FaqEntry is atomic — a cohort supplies a
 * complete {q, a}, never a half-entry — so the result is always a sound SiteCopy.
 */

import { describe, expect, it } from "vitest";
import { BASE_COPY, resolveCopy } from "./copy.js";

describe("resolveCopy — base passthrough", () => {
	it("returns BASE_COPY when no overlay is given", () => {
		expect(resolveCopy()).toEqual(BASE_COPY);
	});

	it("returns BASE_COPY for an empty overlay", () => {
		expect(resolveCopy({})).toEqual(BASE_COPY);
	});
});

describe("resolveCopy — partial overlays inherit the rest", () => {
	it("overrides closingCta.sub and INHERITS closingCta.heading", () => {
		const out = resolveCopy({ closingCta: { sub: "new sub" } });
		expect(out.closingCta.sub).toBe("new sub");
		expect(out.closingCta.heading).toBe(BASE_COPY.closingCta.heading);
	});

	it("overrides hero fields without touching meta or faq", () => {
		const out = resolveCopy({ hero: { title: "T", lede: "L" } });
		expect(out.hero).toEqual({ title: "T", lede: "L" });
		expect(out.meta).toEqual(BASE_COPY.meta);
		expect(out.faq).toEqual(BASE_COPY.faq);
	});
});

describe("resolveCopy — faq merges by key, order replaces wholesale", () => {
	it("overrides one entry by key and appends new ones; inherits the rest", () => {
		const out = resolveCopy({
			faq: {
				entries: {
					"data-residency": { q: "Q?", a: "A." },
					"new-one": { q: "New?", a: "Yes." },
				},
				order: ["new-one", "data-residency"],
			},
		});
		expect(out.faq.entries["data-residency"]).toEqual({ q: "Q?", a: "A." });
		expect(out.faq.entries["new-one"]).toEqual({ q: "New?", a: "Yes." });
		// inherited base entry survives the merge
		expect(out.faq.entries.exit).toEqual(BASE_COPY.faq.entries.exit);
		// order is replaced, not concatenated
		expect(out.faq.order).toEqual(["new-one", "data-residency"]);
	});

	it("keeps the base order when the overlay supplies none", () => {
		const out = resolveCopy({ faq: { entries: { exit: { q: "x", a: "y" } } } });
		expect(out.faq.order).toEqual(BASE_COPY.faq.order);
	});
});

describe("BASE_COPY — every ordered faq id resolves to an entry", () => {
	it("has no dangling id in order", () => {
		for (const id of BASE_COPY.faq.order) {
			expect(BASE_COPY.faq.entries[id], id).toBeDefined();
		}
	});
});

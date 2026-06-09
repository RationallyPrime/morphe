/**
 * Site surface smoke tests — the marketing compounds must pass the same factory
 * gate as the composer compounds before route-level SSR can render them.
 */

import { describe, expect, it } from "vitest";
import { CompoundRegistry } from "$morphe";
import { SITE_COMPOUNDS, registerSiteCompounds } from "./compounds.js";

describe("site compounds — registration through the factory gate", () => {
	it("registers all site compounds cleanly on a fresh registry", () => {
		const reg = new CompoundRegistry();

		expect(() => registerSiteCompounds(reg)).not.toThrow();

		expect(SITE_COMPOUNDS.length).toBe(6);
		for (const def of SITE_COMPOUNDS) {
			expect(reg.has(def.name)).toBe(true);
		}
	});

	it("is idempotent — a second pass over the same registry is a no-op", () => {
		const reg = new CompoundRegistry();
		registerSiteCompounds(reg);

		expect(() => registerSiteCompounds(reg)).not.toThrow();
		expect(reg.names.length).toBe(SITE_COMPOUNDS.length);
	});
});

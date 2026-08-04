import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import SubstratePage from "./+page.svelte";

describe("/substrate coherent playground", () => {
	it("SSR renders the workbench navigation, controls, preview, and proof rail", () => {
		const html = render(SubstratePage).body;

		expect(html).toContain("Morphe Workbench");
		expect(html).toContain("Gold Standard");
		expect(html).toContain("Compound Mint");
		expect(html).toContain("Grammar Studio");
		expect(html).toContain("Dialect Lab");
		expect(html).toContain("State + Actions");
		expect(html).toContain("Vary + Delta");
		expect(html).toContain("CMS Pipeline");
		expect(html).toContain("Local AI Provider");
		expect(html).toContain("Proof rail");
		expect(html).toContain("Chrome local AI unavailable");
		expect(html).toContain("Preview capability-page.demo/rev-001");
		expect(html).toContain('class="mo-root');
		expect(html).toContain('data-mo-dialect="gallery"');
		expect(html).toContain("Close the governed action circuit");
		expect(html).toContain("Gold circuit connected");
		expect(html).toContain('data-action="gold.advance"');
		expect(html).toContain('data-action="gold.attest"');
		for (const path of ["gold.note", "gold.posture", "gold.reviewed", "gold.confidence"]) {
			expect(html).toContain(`data-bind="${path}"`);
		}
		expect(html).toContain("Compact evidence");
		expect(html).toContain("Inspect the complete gold circuit");
	});
});

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import SubstratePage from "./+page.svelte";

describe("/substrate coherent playground", () => {
	it("SSR renders the workbench navigation, controls, preview, and proof rail", () => {
		const html = render(SubstratePage).body;

		expect(html).toContain("Morphe Workbench");
		expect(html).toContain("Grammar Studio");
		expect(html).toContain("Dialect Lab");
		expect(html).toContain("State + Actions");
		expect(html).toContain("Vary + Delta");
		expect(html).toContain("CMS Pipeline");
		expect(html).toContain("Local AI Provider");
		expect(html).toContain("Proof rail");
		expect(html).toContain("Chrome local AI unavailable");
		expect(html).toContain("Preview capability-page.demo/rev-001");
	});
});

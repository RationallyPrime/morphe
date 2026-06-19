import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import SubstratePage from "./+page.svelte";

describe("/substrate adaptive lab", () => {
	it("SSR renders the adaptive lab controls and deterministic preview", () => {
		const html = render(SubstratePage).body;

		expect(html).toContain("Agent-rendered Node");
		expect(html).toContain("adaptive-goal");
		expect(html).toContain("No sidecar required for the first render");
	});
});

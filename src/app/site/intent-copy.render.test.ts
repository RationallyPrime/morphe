/**
 * INTENT-LABEL OVERRIDE render lock (`copy.intent.labels`) — proves a cohort's
 * chip-label overlay survives the FULL render path, not just the `resolveCopy`
 * merge that `copy.test.ts` asserts in isolation. A cohort overrides one chip's
 * text by intent id and inherits the rest; the registry label (`intents.ts`) is
 * the no-JS ground truth and the fallback. Both surfaces that paint intent
 * labels — the chip row and the Cmd/Ctrl+K palette — are asserted, since the
 * home route hands the cohort-resolved `copy.intent` to BOTH.
 *
 * SSR via Svelte's server `render()` — same node env, no jsdom, no new dep — the
 * exact path the home route ships (it SSRs IntentChips/IntentPalette). The
 * palette's options render from `matchIntents("")`, which returns every intent,
 * so the closed-dialog SSR markup still carries each label.
 */

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { FINANCE_CONTROLS } from "./cohort-defs.js";
import { BASE_INTENT_COPY, type IntentCopy, resolveCopy } from "./copy.js";
import IntentChips from "./IntentChips.svelte";
import IntentPalette from "./IntentPalette.svelte";

// A REAL intent id (intents.ts) so the override lands on a rendered chip/option.
const OVERRIDDEN_ID = "plates-story";
const DEFAULT_LABEL = "Tell me the story"; // the registry label for that id
const OVERRIDE_LABEL = "Show the control model"; // a cohort's per-chip override
const INHERITED_LABEL = "How is it governed?"; // a chip the overlay does NOT touch

const withOverride: IntentCopy = {
	...BASE_INTENT_COPY,
	labels: { [OVERRIDDEN_ID]: OVERRIDE_LABEL },
};

describe("intent-label overrides survive the render path (copy.intent.labels)", () => {
	it("IntentChips paints the cohort override and inherits the untouched chips", () => {
		const html = render(IntentChips, { props: { copy: withOverride } }).body;
		expect(html).toContain(OVERRIDE_LABEL);
		expect(html).not.toContain(DEFAULT_LABEL);
		expect(html).toContain(INHERITED_LABEL); // merge-by-key holds at the render layer
	});

	it("IntentChips falls back to the registry label when no overlay is given", () => {
		const html = render(IntentChips, { props: { copy: BASE_INTENT_COPY } }).body;
		expect(html).toContain(DEFAULT_LABEL);
		expect(html).not.toContain(OVERRIDE_LABEL);
	});

	it("IntentPalette paints the cohort override and inherits the untouched options", () => {
		const html = render(IntentPalette, { props: { copy: withOverride } }).body;
		expect(html).toContain(OVERRIDE_LABEL);
		expect(html).not.toContain(DEFAULT_LABEL);
		expect(html).toContain(INHERITED_LABEL);
	});

	it("IntentPalette falls back to the registry label when no overlay is given", () => {
		const html = render(IntentPalette, { props: { copy: BASE_INTENT_COPY } }).body;
		expect(html).toContain(DEFAULT_LABEL);
		expect(html).not.toContain(OVERRIDE_LABEL);
	});

	// Integration: the SAME path the home route ships — a REAL cohort's overlay
	// through resolveCopy into the chip row. Reads the override off the resolved
	// copy (not a hard-coded string) so it locks the wiring, not the wording.
	it("a shipped cohort's resolved override lands in the chip row (finance-controls)", () => {
		const intent = resolveCopy(FINANCE_CONTROLS.copy).intent;
		const override = intent.labels?.["governance-story"];
		expect(override, "finance-controls overrides governance-story").toBeDefined();
		const html = render(IntentChips, { props: { copy: intent } }).body;
		expect(html).toContain(override ?? "");
		expect(html).not.toContain("How is it governed?"); // the base label it replaces
	});
});

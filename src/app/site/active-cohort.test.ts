/**
 * ACTIVE-COHORT store tests — the app-wide cohort selection + reactive copy.
 *
 *   A1  Default is null; activeCopy is BASE_COPY.
 *   A2  setById to a registered cohort drives activeCopy to its resolved copy.
 *   A3  setById to an unknown id is a no-op (never a reset).
 *   A4  clear() returns to null / BASE_COPY.
 *   A5  pageCopy: the request-scoped id drives it when the store is null (the SSR /
 *       first-paint path); the client store wins once a cohort is selected.
 */

import { afterEach, describe, expect, it } from "vitest";
import { activeCohort, activeCopy, pageCopy } from "./active-cohort.svelte.js";
import { BASE_COPY } from "./copy.js";

afterEach(() => activeCohort.clear());

describe("active-cohort", () => {
	it("A1 — defaults to null with base copy", () => {
		expect(activeCohort.current).toBeNull();
		expect(activeCopy.current).toEqual(BASE_COPY);
	});

	it("A2 — a registered cohort drives the resolved copy", () => {
		activeCohort.setById("pharma-sovereign");
		expect(activeCohort.current).toBe("pharma-sovereign");
		expect(activeCopy.current.hero.title.toLowerCase()).toContain("drug development");
	});

	it("A3 — an unknown id is a no-op", () => {
		activeCohort.setById("pharma-sovereign");
		activeCohort.setById("not-a-cohort");
		expect(activeCohort.current).toBe("pharma-sovereign");
	});

	it("A4 — clear returns to base", () => {
		activeCohort.setById("pharma-sovereign");
		activeCohort.clear();
		expect(activeCohort.current).toBeNull();
		expect(activeCopy.current).toEqual(BASE_COPY);
	});

	it("A5 — pageCopy: data id drives a null store; the store wins once selected", () => {
		// SSR / first-paint: the store is null, so the request-scoped id resolves.
		expect(activeCohort.current).toBeNull();
		expect(pageCopy(null)).toEqual(BASE_COPY);
		expect(pageCopy("finance-controls").hero.title.toLowerCase()).toContain("financial operations");
		// Post-hydration: an in-session/persisted selection overrides the request id.
		activeCohort.setById("pharma-sovereign");
		expect(pageCopy(null).hero.title.toLowerCase()).toContain("drug development");
		expect(pageCopy("finance-controls").hero.title.toLowerCase()).toContain("drug development");
	});
});

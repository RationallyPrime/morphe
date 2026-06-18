/**
 * COHORT ARRIVAL — the app-level resolution sequence the layout runs: a cohort
 * supplies the dialect baseline, an explicit `?dialect=` (or a persisted explicit
 * toggle) overrides it, and an explicit choice always wins on return. This test
 * legitimately spans $lib (the dialect store) and $site (the cohort registry) —
 * the app→lib direction is the correct one (the inverse would break layering).
 */

import { afterEach, describe, expect, it } from "vitest";
import {
	activeDialect,
	DEFAULT_DIALECT,
	DIALECT_IDS,
	hasDialect,
	resolveArrivalDialect,
} from "$lib";
import { COHORT_IDS, getCohort, resolveArrivalCohort } from "$site";

afterEach(() => activeDialect.set(DEFAULT_DIALECT));

/** The layout's dialect mount sequence, verbatim (+layout.svelte). */
function arrive(
	href: string,
	persistedCohort: string | null,
	persistedDialect: string | null,
): void {
	const url = new URL(href);
	const cohort = resolveArrivalCohort(url.searchParams.get("cohort"), persistedCohort, COHORT_IDS);
	const cohortDialect = cohort !== null ? (getCohort(cohort)?.dialect ?? null) : null;
	const explicit = resolveArrivalDialect(
		url.searchParams.get("dialect"),
		persistedDialect,
		DIALECT_IDS,
	);
	// resolveArrivalDialect returns the PERSISTED value unvalidated, so `explicit` may
	// be a stale/garbage id — the layout guards it with `&& hasDialect` (+layout.svelte),
	// falling back to the cohort dialect. The helper must mirror that or it tests a path
	// the code never takes.
	const target = explicit !== null && hasDialect(explicit) ? explicit : cohortDialect;
	if (target !== null) activeDialect.setById(target);
}

describe("cohort → dialect resolution", () => {
	it("?cohort=pharma-sovereign lands on the clinical dialect", () => {
		arrive("https://sokrates.example/?cohort=pharma-sovereign", null, null);
		expect(activeDialect.id).toBe("clinical");
	});

	it("an explicit ?dialect= overrides the cohort's dialect", () => {
		arrive("https://sokrates.example/?cohort=pharma-sovereign&dialect=night", null, null);
		expect(activeDialect.id).toBe("night");
	});

	it("a persisted explicit dialect outranks the cohort's dialect on return", () => {
		arrive("https://sokrates.example/?cohort=pharma-sovereign", null, "night");
		expect(activeDialect.id).toBe("night");
	});

	it("an unknown cohort with no persistence leaves the default active", () => {
		arrive("https://sokrates.example/?cohort=banana", null, null);
		expect(activeDialect.current).toBe(DEFAULT_DIALECT);
	});

	it("a STALE persisted dialect falls back to the cohort's dialect (not the stale id)", () => {
		// The guarded path: a persisted id that no longer names a dialect must not win
		// over the cohort's dialect. pharma-sovereign → clinical, despite the garbage.
		arrive("https://sokrates.example/?cohort=pharma-sovereign", null, "not-a-dialect");
		expect(activeDialect.id).toBe("clinical");
	});
});

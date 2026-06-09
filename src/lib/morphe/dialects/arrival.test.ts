/**
 * ARRIVAL ATTRIBUTION tests (Lemma 4 / τ_frame) — `?cohort=` selects the dialect.
 *
 * `resolveArrivalDialect` is the pure precedence rule behind DESIGN.md §9's
 * cohort wiring: valid landing param > persisted choice > null (leave the
 * default). These pin its contract:
 *
 *   C1  A VALID `?cohort=` param wins over the persisted choice — attribution
 *       is a statement about THIS arrival.
 *   C2  An UNKNOWN/garbage param is ignored (never throws, never resets): the
 *       persisted choice stands exactly as if the param were absent.
 *   C3  With no param, the persisted choice stands; with neither, null — the
 *       caller leaves the active dialect untouched.
 *   C4  Ids are EXACT-MATCH (case-sensitive): `Clinical` is not `clinical`.
 *   C5  Arrival-sequence sanity: driving the layout's exact mount sequence
 *       against the REAL global store with a mocked landing URL of
 *       `?cohort=clinical` ends with `clinical` active — and an unknown cohort
 *       leaves the selection alone (`setById`'s registry guard composes).
 *
 * Each store-touching test restores the default afterward so module-level
 * state does not leak between cases (the store is a singleton by design).
 */

import { afterEach, describe, expect, it } from "vitest";
import { activeDialect } from "./active.svelte.js";
import { resolveArrivalDialect } from "./arrival.js";
import { DEFAULT_DIALECT } from "./icelandic-archive.js";
import { clinical } from "./clinical.js";
import { DIALECT_IDS } from "./registry.js";

afterEach(() => {
	activeDialect.set(DEFAULT_DIALECT);
});

describe("C1 — a valid param beats the persisted choice", () => {
	it("returns the param when it names a registered dialect", () => {
		expect(resolveArrivalDialect("clinical", "icelandic-archive", DIALECT_IDS)).toBe("clinical");
	});

	it("returns the param when nothing is persisted", () => {
		expect(resolveArrivalDialect("reykjavik-registry", null, DIALECT_IDS)).toBe(
			"reykjavik-registry",
		);
	});
});

describe("C2 — an unknown param is ignored, never an error", () => {
	it("falls back to the persisted choice for a garbage param", () => {
		expect(resolveArrivalDialect("not-a-dialect", "clinical", DIALECT_IDS)).toBe("clinical");
	});

	it("falls back to null when nothing is persisted either", () => {
		expect(resolveArrivalDialect("not-a-dialect", null, DIALECT_IDS)).toBeNull();
	});

	it("does not validate the persisted value (setById's registry guard owns that)", () => {
		expect(resolveArrivalDialect("not-a-dialect", "also-stale", DIALECT_IDS)).toBe("also-stale");
	});
});

describe("C3 — absent param defers to persistence; absent both defers to the default", () => {
	it("returns the persisted choice when there is no param", () => {
		expect(resolveArrivalDialect(null, "reykjavik-registry", DIALECT_IDS)).toBe(
			"reykjavik-registry",
		);
	});

	it("returns null when there is neither param nor persistence", () => {
		expect(resolveArrivalDialect(null, null, DIALECT_IDS)).toBeNull();
	});
});

describe("C4 — ids are exact-match (case-sensitive)", () => {
	it("treats a case-mismatched param as unknown", () => {
		expect(resolveArrivalDialect("Clinical", "icelandic-archive", DIALECT_IDS)).toBe(
			"icelandic-archive",
		);
		expect(resolveArrivalDialect("CLINICAL", null, DIALECT_IDS)).toBeNull();
	});
});

describe("C5 — arrival-sequence sanity against the real store", () => {
	/**
	 * The layout's mount effect, verbatim (URL mocked, localStorage as a value):
	 * read `?cohort=`, resolve, and apply via `setById` when non-null.
	 */
	function arrive(href: string, persisted: string | null): void {
		const cohort = new URL(href).searchParams.get("cohort");
		const resolved = resolveArrivalDialect(cohort, persisted, DIALECT_IDS);
		if (resolved !== null) activeDialect.setById(resolved);
	}

	it("?cohort=clinical lands with clinical active", () => {
		arrive("https://sokrates.example/?cohort=clinical", null);
		expect(activeDialect.current).toBe(clinical);
		expect(activeDialect.id).toBe("clinical");
	});

	it("a valid cohort outranks the persisted choice", () => {
		arrive("https://sokrates.example/?cohort=reykjavik-registry", "clinical");
		expect(activeDialect.id).toBe("reykjavik-registry");
	});

	it("no cohort param restores the persisted choice", () => {
		arrive("https://sokrates.example/", "clinical");
		expect(activeDialect.id).toBe("clinical");
	});

	it("an unknown cohort with no persistence leaves the default active", () => {
		arrive("https://sokrates.example/?cohort=banana", null);
		expect(activeDialect.current).toBe(DEFAULT_DIALECT);
	});

	it("an unknown cohort with a STALE persisted id still leaves the selection intact", () => {
		// The helper passes the stale id through; setById's registry guard
		// makes it a no-op rather than a reset — the two guards compose.
		arrive("https://sokrates.example/?cohort=banana", "long-retired-dialect");
		expect(activeDialect.current).toBe(DEFAULT_DIALECT);
	});
});

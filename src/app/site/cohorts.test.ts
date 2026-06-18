/**
 * COHORT REGISTRY tests — a cohort selects a dialect AND a copy overlay
 * (CONTEXT.md), behind the same gate/idempotency posture as the intent registry.
 *
 *   K1  The gate rejects a non-kebab id and an unknown dialect; a clean def passes.
 *   K2  Registration is idempotent (HMR-safe); the registry enumerates in order.
 *   K3  pharma-sovereign resolves to the clinical dialect and pharma copy
 *       (hero re-pitched, the IP/sovereignty FAQ present, base entries inherited).
 *   K4  Arrival precedence: valid ?cohort= > persisted > null; unknown ignored.
 *   K5  Persistence: an explicit cohort persists; "no cohort" never does.
 *   K6  Copy hygiene — the RESOLVED pharma copy carries no banned/excluded token.
 */

import { describe, expect, it } from "vitest";
import { hasDialect } from "$lib";
import {
	COHORT_IDS,
	CohortRegistry,
	cohortGateFailure,
	getCohort,
	persistableCohort,
	registerSiteCohorts,
	resolveArrivalCohort,
} from "./cohorts.js";
import { resolveCopy } from "./copy.js";

describe("K1 — the gate", () => {
	it("rejects a non-kebab id", () => {
		expect(cohortGateFailure({ id: "Pharma_X", dialect: "clinical", copy: {} })).not.toBeNull();
	});
	it("rejects an unknown dialect", () => {
		expect(cohortGateFailure({ id: "ok-id", dialect: "no-such-dialect", copy: {} })).not.toBeNull();
	});
	it("passes a clean def", () => {
		expect(cohortGateFailure({ id: "ok-id", dialect: "clinical", copy: {} })).toBeNull();
	});
});

describe("K2 — registration is gated, idempotent, ordered", () => {
	it("registers the shipped cohorts and is idempotent", () => {
		const reg = new CohortRegistry();
		registerSiteCohorts(reg);
		const first = reg.list().map((c) => c.id);
		registerSiteCohorts(reg);
		expect(reg.list().map((c) => c.id)).toEqual(first);
		expect(first).toContain("pharma-sovereign");
	});
	it("never registers a bad def, never throws the batch", () => {
		const reg = new CohortRegistry();
		expect(() => reg.register({ id: "Bad Id", dialect: "clinical", copy: {} })).not.toThrow();
		expect(reg.has("Bad Id")).toBe(false);
	});
});

describe("K3 — pharma-sovereign: dialect + copy", () => {
	it("selects the clinical dialect", () => {
		const c = getCohort("pharma-sovereign");
		expect(c).toBeDefined();
		expect(c?.dialect).toBe("clinical");
		expect(hasDialect(c?.dialect ?? "")).toBe(true);
	});
	it("re-pitches the hero and carries the IP/sovereignty FAQ, inheriting base entries", () => {
		const copy = resolveCopy(getCohort("pharma-sovereign")?.copy);
		expect(copy.hero.title.toLowerCase()).toContain("drug development");
		expect(copy.faq.entries["no-shared-model"]).toBeDefined();
		expect(copy.faq.entries["validation-audit"]).toBeDefined();
		expect(copy.faq.entries.exit).toEqual(resolveCopy().faq.entries.exit); // inherited
		// the close inherits the base heading, overrides only the sub
		expect(copy.closingCta.heading).toBe(resolveCopy().closingCta.heading);
		expect(copy.closingCta.sub).not.toBe(resolveCopy().closingCta.sub);
	});
});

describe("K4 — arrival precedence", () => {
	it("a valid param beats the persisted cohort", () => {
		expect(resolveArrivalCohort("pharma-sovereign", "other", COHORT_IDS)).toBe("pharma-sovereign");
	});
	it("an unknown param falls back to the persisted cohort", () => {
		expect(resolveArrivalCohort("banana", "pharma-sovereign", COHORT_IDS)).toBe("pharma-sovereign");
	});
	it("no param defers to persistence; neither yields null", () => {
		expect(resolveArrivalCohort(null, "pharma-sovereign", COHORT_IDS)).toBe("pharma-sovereign");
		expect(resolveArrivalCohort(null, null, COHORT_IDS)).toBeNull();
	});
	it("ids are exact-match (case-sensitive)", () => {
		expect(resolveArrivalCohort("Pharma-Sovereign", null, COHORT_IDS)).toBeNull();
	});
});

describe("K5 — persistence: no-cohort is not a choice", () => {
	it("persists an explicit cohort", () => {
		expect(persistableCohort("pharma-sovereign", null)).toBe("pharma-sovereign");
	});
	it("writes nothing for a null cohort or an idempotent re-affirm", () => {
		expect(persistableCohort(null, null)).toBeNull();
		expect(persistableCohort(null, "pharma-sovereign")).toBeNull();
		expect(persistableCohort("pharma-sovereign", "pharma-sovereign")).toBeNull();
	});
});

describe("K6 — resolved pharma copy stays out of doctrine/Trajectory register", () => {
	const BANNED = ["under governance", "read-only", "Read-only", "by construction", "AUTHORIZES"];
	const FORBIDDEN: readonly RegExp[] = [
		/\bINV-\d/,
		/\bADR-\d/,
		new RegExp(["fly", "wheel"].join(""), "i"),
	];
	it("carries no banned or excluded token", () => {
		const json = JSON.stringify(resolveCopy(getCohort("pharma-sovereign")?.copy));
		for (const p of BANNED) expect(json, p).not.toContain(p);
		for (const r of FORBIDDEN) expect(json).not.toMatch(r);
	});
});

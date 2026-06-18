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
	SITE_COHORTS,
} from "./cohorts.js";
import { BASE_COPY, resolveCopy } from "./copy.js";
import { intentRegistry, registerSiteIntents } from "./intents.js";

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
	it("rejects a faq.order that names an entry no overlay or base provides", () => {
		// faqSection THROWS on a dangling order id — the gate rejects it at registration
		// so render stays total by construction (parity with the intent/compound gates).
		const failure = cohortGateFailure({
			id: "ok-id",
			dialect: "clinical",
			copy: { faq: { order: ["no-such-entry"] } },
		});
		expect(failure).not.toBeNull();
		expect(failure).toContain("no-such-entry");
	});
	it("passes a faq.order that names only base + overlay entries", () => {
		expect(
			cohortGateFailure({
				id: "ok-id",
				dialect: "clinical",
				copy: {
					faq: { entries: { custom: { q: "Q?", a: "A." } }, order: ["custom", "exit"] },
				},
			}),
		).toBeNull();
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

describe("K6 — every cohort's resolved copy stays out of doctrine/Trajectory register", () => {
	const BANNED = ["under governance", "read-only", "Read-only", "by construction", "AUTHORIZES"];
	const FORBIDDEN: readonly RegExp[] = [
		/\bINV-\d/,
		/\bADR-\d/,
		new RegExp(["fly", "wheel"].join(""), "i"),
	];
	it("carries no banned or excluded token", () => {
		for (const c of SITE_COHORTS) {
			const json = JSON.stringify(resolveCopy(c.copy));
			for (const p of BANNED) expect(json, `${c.id}: ${p}`).not.toContain(p);
			for (const r of FORBIDDEN) expect(json, c.id).not.toMatch(r);
		}
	});
});

describe("K7 — the six audience cohorts register, gate-clean, on real dialects", () => {
	const SIX = [
		"finance-controls",
		"public-sector-sovereign",
		"healthcare-operations",
		"industrial-quality",
		"rollup-integration",
		"midmarket-ops",
	];
	it("each is registered and passes the gate", () => {
		for (const id of SIX) {
			const c = getCohort(id);
			expect(c, id).toBeDefined();
			if (c === undefined) continue;
			expect(cohortGateFailure(c), id).toBeNull();
		}
	});
	it("each selects a registered dialect", () => {
		for (const id of SIX) {
			expect(hasDialect(getCohort(id)?.dialect ?? ""), id).toBe(true);
		}
	});
	it("COHORT_IDS carries pharma + the six (seven shipped)", () => {
		expect(COHORT_IDS).toContain("pharma-sovereign");
		for (const id of SIX) expect(COHORT_IDS, id).toContain(id);
		expect(COHORT_IDS).toHaveLength(7);
	});
});

describe("K8 — every shipped cohort resolves to render-safe copy", () => {
	// faqSection() THROWS on an order id with no entry (present.ts) — so a dangling
	// `faq.order` key would crash the page at render. Guard it here, at test time.
	it("no faq.order id is dangling in any cohort", () => {
		for (const c of SITE_COHORTS) {
			const copy = resolveCopy(c.copy);
			for (const id of copy.faq.order) {
				expect(copy.faq.entries[id], `${c.id}: ${id}`).toBeDefined();
			}
		}
	});
});

describe("K9 — every shipped cohort tailors the conversion surfaces", () => {
	// The whole point of the surface expansion: a cohort re-pitches the centerpiece
	// (composer) and the quiet nav CTA, not just the hero/close/faq. Prove each one
	// actually overrides them (resolved value diverges from base), and the resolved
	// copy stays a total SiteCopy (every surface slot present).
	it("each re-pitches the nav CTA and the composer pain placeholder", () => {
		for (const c of SITE_COHORTS) {
			const copy = resolveCopy(c.copy);
			expect(copy.nav.cta, `${c.id} nav.cta`).not.toBe(BASE_COPY.nav.cta);
			expect(copy.composer.painPlaceholder, `${c.id} composer.painPlaceholder`).not.toBe(
				BASE_COPY.composer.painPlaceholder,
			);
			// inheritance still holds — an un-overridden field falls back to base.
			expect(copy.composer.title).toBe(BASE_COPY.composer.title);
		}
	});
});

describe("K10 — cohort chip-label overrides target real intents", () => {
	// A cohort may relabel a home chip by intent id (copy.intent.labels), merged by
	// key over the gated registry. A key that names NO registered intent would
	// silently never render (the chip keeps its default) — the quiet failure the
	// merge-by-key design invites. Guard that every override key resolves to a real
	// intent AND actually diverges from the registry label it claims to replace.
	registerSiteIntents();
	const registryLabel = new Map(intentRegistry.list().map((i) => [i.id, i.label]));

	it("every override key names a registered intent and changes its label", () => {
		for (const c of SITE_COHORTS) {
			const labels = c.copy.intent?.labels;
			if (labels === undefined) continue;
			for (const [id, label] of Object.entries(labels)) {
				const base = registryLabel.get(id);
				expect(base, `${c.id}: "${id}" names no registered intent`).toBeDefined();
				expect(label, `${c.id}: "${id}" override equals the registry label`).not.toBe(base);
			}
		}
	});
});

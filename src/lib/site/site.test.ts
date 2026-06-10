/**
 * SITE COMPOUND + PRESENTER tests — the smoke layer the marketing site was
 * missing.
 *
 * The factory gate is allowed to get STRICTER over time (R0.1 added the
 * template-root-claim rejection). When it does, every registered def must
 * still pass it — and `compose/` had a registration smoke test that forced
 * its migration while `site/` did not, so the site shipped a def the gate now
 * rejects and every marketing page 500'd at SSR. These tests close that hole:
 *
 *   S1  Every site compound registers cleanly on a FRESH registry (the gate's
 *       current rules, whatever they are, accept the shipped defs) and
 *       registration is idempotent (HMR-safe).
 *   S2  Every site presenter's tree is RENDERABLE against the site registry:
 *       each CompoundRef in each emitted tree names a registered compound and
 *       expands. A presenter can never emit a ref the registry cannot honor.
 */

import { describe, expect, it } from "vitest";
import type { Node } from "$morphe";
import { CompoundRegistry, childrenOf } from "$morphe";
import { registerSiteCompounds, SITE_COMPOUNDS } from "./compounds.js";
import {
	architectureBody,
	architectureHero,
	closingCta,
	faqSection,
	governanceLadder,
	homeBody,
	homeHero,
	howItWorksBody,
	howItWorksHero,
	onboardingBand,
	sovereigntySplit,
	timaeusTease,
} from "./present.js";

const PRESENTERS: ReadonlyArray<readonly [string, () => Node]> = [
	["governanceLadder", governanceLadder],
	["sovereigntySplit", sovereigntySplit],
	["closingCta", closingCta],
	["homeHero", homeHero],
	["homeBody", homeBody],
	["onboardingBand", onboardingBand],
	["howItWorksHero", howItWorksHero],
	["howItWorksBody", howItWorksBody],
	["faqSection", faqSection],
	["architectureHero", architectureHero],
	["architectureBody", architectureBody],
	["timaeusTease", timaeusTease],
];

describe("S1 — every site compound passes the factory gate", () => {
	it("registers all site compounds cleanly on a fresh registry", () => {
		const reg = new CompoundRegistry();
		expect(() => registerSiteCompounds(reg)).not.toThrow();
		for (const def of SITE_COMPOUNDS) {
			expect(reg.has(def.name)).toBe(true);
		}
	});

	it("is idempotent — a second pass over the same registry is a no-op", () => {
		const reg = new CompoundRegistry();
		registerSiteCompounds(reg);
		expect(() => registerSiteCompounds(reg)).not.toThrow();
	});
});

describe("S2 — every site presenter emits only resolvable compound refs", () => {
	const reg = new CompoundRegistry();
	registerSiteCompounds(reg);

	/** Walk a tree (including expanded compounds and slot fills) collecting refs. */
	function assertResolvable(n: Node, path: string): void {
		if (n.kind === "compound") {
			expect(reg.has(n.name), `${path}: unregistered compound "${n.name}"`).toBe(true);
			expect(() => reg.expand(n), `${path}: "${n.name}" failed to expand`).not.toThrow();
			for (const fills of Object.values(n.slots ?? {})) {
				for (const child of fills) assertResolvable(child, `${path}>${n.name}`);
			}
			return;
		}
		for (const child of childrenOf(n)) assertResolvable(child, `${path}>${n.kind}`);
	}

	for (const [name, present] of PRESENTERS) {
		it(`${name}() is renderable against the site registry`, () => {
			assertResolvable(present(), name);
		});
	}
});

describe("S3 — the public copy respects the Trajectory exclusion (KRA-324)", () => {
	// The investor-private panel must never reach the public site — not as a
	// word, not as an asset reference, not as an internal invariant citation.
	// This is the merge-time grep gate, run as a test over every presenter's
	// emitted tree (every string field rides JSON.stringify, so alt text and
	// asset paths are covered alongside the visible copy).
	// Patterns are assembled from fragments so this gate itself never trips the
	// raw text greps the acceptance criteria run over src/ — the file that
	// enforces the exclusion must not be the one place the words appear.
	const FORBIDDEN: readonly RegExp[] = [
		new RegExp(["fly", "wheel"].join(""), "i"),
		new RegExp(["q", "lo", "ra"].join(""), "i"),
		new RegExp(["\\bmo", "at\\b"].join(""), "i"),
		new RegExp(["reward-", "labeled"].join(""), "i"),
		/\bINV-\d/,
		/\bADR-\d/,
		new RegExp(["\\bt", "1-"].join(""), "i"),
	];
	for (const [name, present] of PRESENTERS) {
		it(`${name}() carries no excluded token`, () => {
			const serialized = JSON.stringify(present());
			for (const pattern of FORBIDDEN) {
				expect(serialized).not.toMatch(pattern);
			}
		});
	}
});

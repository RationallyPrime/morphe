# Cohort copy + URL-param attribution — Implementation Plan

> **Status: superseded, not built in this repo** — overtaken by the
> sokrates-website decoupling (ADR-0008/ADR-0012) before implementation.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each marketing cohort its own copy (not just its own dialect), selected by a landing `?cohort=` param and persisted to localStorage, with `?dialect=`/`?intent=` as siblings — and ship the first cohort, `pharma-sovereign`.

**Architecture:** Decouple cohort from dialect (per `CONTEXT.md`): a typed cohort registry maps `cohort id → { dialect, copy overlay }`. Copy becomes `BASE_COPY` (today's strings, verbatim) + a per-cohort `CohortCopyOverlay`, merged by a total `resolveCopy`. An `activeCohort` rune drives a reactive `activeCopy`; presenters take the resolved copy. Arrival + persistence live in client-only `$effect`s (the server always renders base copy + default dialect). v1 is a client-only swap; SSR-on-arrival is a named follow-up.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax` → `import type` + `.js` relative extensions), Vitest, Biome (tabs, double quotes, semicolons, 100 cols), bun.

**Spec:** `docs/superpowers/specs/2026-06-18-cohort-copy-attribution-design.md`

**Conventions for every task:**
- Relative imports inside `src/app/site/**` carry `.js` extensions; types use `import type`.
- Run a single test file with `bunx vitest run <path>`; the whole suite with `bun run test`.
- Typecheck with `bun run check` (svelte-kit sync + svelte-check, 0 errors/0 warnings).
- After Biome-sensitive edits, `bun run format` normalizes tabs/quotes; don't hand-fight formatting.

---

## Task 1: The copy deck (`copy.ts`)

The single source of the *targetable* marketing copy: a typed `SiteCopy`, today's
strings as `BASE_COPY` (extracted **verbatim**), an explicit `CohortCopyOverlay`,
and a total `resolveCopy`. Pure data — no Svelte, no I/O.

**Files:**
- Create: `src/app/site/copy.ts`
- Test: `src/app/site/copy.test.ts`
- Modify: `src/app/site/index.ts` (barrel export)

- [ ] **Step 1: Write the failing test**

Create `src/app/site/copy.test.ts`:

```ts
/**
 * COPY DECK tests — base + overlay resolution (the cohort copy mechanism).
 *
 * `resolveCopy` is total: an absent overlay returns BASE_COPY unchanged; an
 * overlay merges field-by-field (meta/hero/closingCta), by-key (faq.entries),
 * and replaces faq.order wholesale. FaqEntry is atomic — a cohort supplies a
 * complete {q, a}, never a half-entry — so the result is always a sound SiteCopy.
 */

import { describe, expect, it } from "vitest";
import { BASE_COPY, resolveCopy } from "./copy.js";

describe("resolveCopy — base passthrough", () => {
	it("returns BASE_COPY when no overlay is given", () => {
		expect(resolveCopy()).toEqual(BASE_COPY);
	});

	it("returns BASE_COPY for an empty overlay", () => {
		expect(resolveCopy({})).toEqual(BASE_COPY);
	});
});

describe("resolveCopy — partial overlays inherit the rest", () => {
	it("overrides closingCta.sub and INHERITS closingCta.heading", () => {
		const out = resolveCopy({ closingCta: { sub: "new sub" } });
		expect(out.closingCta.sub).toBe("new sub");
		expect(out.closingCta.heading).toBe(BASE_COPY.closingCta.heading);
	});

	it("overrides hero fields without touching meta or faq", () => {
		const out = resolveCopy({ hero: { title: "T", lede: "L" } });
		expect(out.hero).toEqual({ title: "T", lede: "L" });
		expect(out.meta).toEqual(BASE_COPY.meta);
		expect(out.faq).toEqual(BASE_COPY.faq);
	});
});

describe("resolveCopy — faq merges by key, order replaces wholesale", () => {
	it("overrides one entry by key and appends new ones; inherits the rest", () => {
		const out = resolveCopy({
			faq: {
				entries: {
					"data-residency": { q: "Q?", a: "A." },
					"new-one": { q: "New?", a: "Yes." },
				},
				order: ["new-one", "data-residency"],
			},
		});
		expect(out.faq.entries["data-residency"]).toEqual({ q: "Q?", a: "A." });
		expect(out.faq.entries["new-one"]).toEqual({ q: "New?", a: "Yes." });
		// inherited base entry survives the merge
		expect(out.faq.entries.exit).toEqual(BASE_COPY.faq.entries.exit);
		// order is replaced, not concatenated
		expect(out.faq.order).toEqual(["new-one", "data-residency"]);
	});

	it("keeps the base order when the overlay supplies none", () => {
		const out = resolveCopy({ faq: { entries: { exit: { q: "x", a: "y" } } } });
		expect(out.faq.order).toEqual(BASE_COPY.faq.order);
	});
});

describe("BASE_COPY — every ordered faq id resolves to an entry", () => {
	it("has no dangling id in order", () => {
		for (const id of BASE_COPY.faq.order) {
			expect(BASE_COPY.faq.entries[id], id).toBeDefined();
		}
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/app/site/copy.test.ts`
Expected: FAIL — cannot resolve `./copy.js` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/app/site/copy.ts`. The strings under `BASE_COPY` are lifted
**verbatim** from `present.ts` (`homeHero`, `closingCta`, the `FAQ` array) and
`src/routes/+page.svelte`'s `<svelte:head>` — do not reword them:

```ts
/**
 * THE COPY DECK — the targetable marketing copy as data (the cohort mechanism).
 *
 * `present.ts` turns copy into Morphe Node trees; THIS module is the copy those
 * presenters read. `BASE_COPY` is the canonical, SSR/SEO copy (today's strings,
 * verbatim). A cohort (cohorts.ts) supplies a `CohortCopyOverlay` — a partial
 * statement over these same slots — and `resolveCopy` merges base ∪ overlay into
 * a total `SiteCopy`. A cohort overrides only what it names and inherits the
 * rest: "not every piece of text changes". Pure data + one merge function; no
 * Svelte, no I/O. (CONTEXT.md: a cohort selects a dialect AND a copy variant.)
 */

/** One FAQ entry — atomic: a cohort supplies a complete pair, never a half. */
export interface FaqEntry {
	readonly q: string;
	readonly a: string;
}

/** The full set of copy slots a cohort may target. */
export interface SiteCopy {
	/** The home page <head> (applied client-side in v1). */
	readonly meta: { readonly title: string; readonly description: string };
	/** The home hero (SiteHero title + lede). */
	readonly hero: { readonly title: string; readonly lede: string };
	/** The shared closing CTA band (SiteCtaBanner). */
	readonly closingCta: { readonly heading: string; readonly sub: string };
	/** The FAQ — keyed so an overlay overrides one answer or appends; `order` paints. */
	readonly faq: {
		readonly entries: Readonly<Record<string, FaqEntry>>;
		readonly order: readonly string[];
	};
}

/**
 * A cohort's partial statement over SiteCopy. Each level is optional; FaqEntry
 * stays atomic and `faq.order` replaces wholesale — so `resolveCopy` is always
 * total and sound (never a half-built entry).
 */
export interface CohortCopyOverlay {
	readonly meta?: Partial<SiteCopy["meta"]>;
	readonly hero?: Partial<SiteCopy["hero"]>;
	readonly closingCta?: Partial<SiteCopy["closingCta"]>;
	readonly faq?: {
		readonly entries?: Readonly<Record<string, FaqEntry>>;
		readonly order?: readonly string[];
	};
}

/** The canonical copy — lifted verbatim from present.ts + the home <head>. */
export const BASE_COPY: SiteCopy = {
	meta: {
		title: "Sókrates — Your AI Department",
		description:
			"Software waits for instructions. Sókrates looks for friction. An on-premises AI department for the cross-system work that keeps landing on one senior person.",
	},
	hero: {
		title: "You now have an AI department.",
		lede: "Tell Sókrates what actually runs your operation, and see what it can take on.",
	},
	closingCta: {
		heading: "One conversation is usually enough.",
		sub: "Bring one workflow that keeps crossing systems. Thirty minutes is usually enough to find the first useful question.",
	},
	faq: {
		entries: {
			"chatgpt-diff": {
				q: "How is this different from just using ChatGPT?",
				a: "A substrate, not a chatbot. Sókrates reasons over a verified, typed map of your systems and cites the rows behind every answer. It asks the model to operate over what is true, and every action carries an authority record you can inspect.",
			},
			"what-if-wrong": {
				q: "What happens if it gets something wrong?",
				a: "Human approval is the default trust posture. Every action is a typed process with a named owner and an authority record, auditable as a single record. You authorise classes of work; you can revoke them.",
			},
			"data-residency": {
				q: "Our data can't leave the country, or our network.",
				a: "The appliance is installed on your premises. The Sovereign configuration uses local inference only.",
			},
			exit: {
				q: "What if we want to leave?",
				a: "Clean exit, no hostage-taking. The hardware is yours; your operational data is yours. We deliver a portable custody export of your extracts, operating map, rule contracts, evidence and approval history. What ends is the managed department, not your ownership.",
			},
			"mid-migration": {
				q: "We're mid-migration. We can't take on another project.",
				a: "The migration is the wedge. Sókrates provides semantic continuity across it: the same operational questions, the same evidence posture, before, during and after cutover.",
			},
		},
		order: ["chatgpt-diff", "what-if-wrong", "data-residency", "exit", "mid-migration"],
	},
};

/**
 * Merge an optional cohort overlay onto the base copy. Total and explicit:
 * meta/hero/closingCta merge field-by-field; faq.entries merge by key;
 * faq.order is replaced when supplied. Returns BASE_COPY unchanged when the
 * overlay is absent or empty.
 */
export function resolveCopy(overlay?: CohortCopyOverlay): SiteCopy {
	if (overlay === undefined) return BASE_COPY;
	return {
		meta: { ...BASE_COPY.meta, ...overlay.meta },
		hero: { ...BASE_COPY.hero, ...overlay.hero },
		closingCta: { ...BASE_COPY.closingCta, ...overlay.closingCta },
		faq: {
			entries: { ...BASE_COPY.faq.entries, ...overlay.faq?.entries },
			order: overlay.faq?.order ?? BASE_COPY.faq.order,
		},
	};
}
```

- [ ] **Step 4: Add the barrel export**

In `src/app/site/index.ts`, after the presenters export block (around line 70),
add:

```ts
// The copy deck — targetable marketing copy as data; base + per-cohort overlay.
export type { CohortCopyOverlay, FaqEntry, SiteCopy } from "./copy.js";
export { BASE_COPY, resolveCopy } from "./copy.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx vitest run src/app/site/copy.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 6: Typecheck**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/app/site/copy.ts src/app/site/copy.test.ts src/app/site/index.ts
git commit -m "feat(site): the copy deck — base + cohort overlay (resolveCopy)"
```

---

## Task 2: The cohort registry (`cohorts.ts`)

A cohort is a first-class primitive: `{ id, dialect, copy }`, behind a gate
(kebab id, registered dialect) and a registry mirroring `IntentRegistry`. Ships
the first cohort, `pharma-sovereign`, on the `clinical` dialect, plus the pure
arrival + persistence helpers.

**Files:**
- Create: `src/app/site/cohorts.ts`
- Test: `src/app/site/cohorts.test.ts`
- Modify: `src/app/site/index.ts` (barrel export)

- [ ] **Step 1: Write the failing test**

Create `src/app/site/cohorts.test.ts`:

```ts
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
	CohortRegistry,
	COHORT_IDS,
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
	const FORBIDDEN: readonly RegExp[] = [/\bINV-\d/, /\bADR-\d/, new RegExp(["fly", "wheel"].join(""), "i")];
	it("carries no banned or excluded token", () => {
		const json = JSON.stringify(resolveCopy(getCohort("pharma-sovereign")?.copy));
		for (const p of BANNED) expect(json, p).not.toContain(p);
		for (const r of FORBIDDEN) expect(json).not.toMatch(r);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/app/site/cohorts.test.ts`
Expected: FAIL — cannot resolve `./cohorts.js`.

- [ ] **Step 3: Write the implementation**

Create `src/app/site/cohorts.ts`. The pharma overlay strings are the approved
copy from the spec (`pharma-sovereign`); the Sovereign claim is "local inference
only / no outbound inference calls", never "air-gapped":

```ts
/**
 * THE COHORT REGISTRY — a cohort selects a dialect AND a copy overlay (CONTEXT.md).
 *
 * A cohort is the marketing-side audience segment designed into an ad campaign:
 * a landing `?cohort=<id>` re-poses the page into the pitch that segment responds
 * to. It is DISTINCT from a dialect (the presentation register it selects); many
 * cohorts may share one dialect. Same posture as the intent/compound registries:
 * a gate on the way in, idempotent re-registration, ordered enumeration. The
 * arrival + persistence helpers mirror dialects/arrival.ts (valid param >
 * persisted > none; an untouched non-choice is never persisted).
 */

import { hasDialect } from "$lib";
import type { CohortCopyOverlay } from "./copy.js";

/** A marketing cohort: an id, the dialect it wears, and its copy overlay. */
export interface Cohort {
	/** Stable kebab-case id — the `?cohort=` value. */
	readonly id: string;
	/** The registered dialect this cohort selects. */
	readonly dialect: string;
	/** The copy this cohort overlays onto BASE_COPY (empty = palette-only). */
	readonly copy: CohortCopyOverlay;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Validate one cohort def. Returns a reason string, or null when it passes. */
export function cohortGateFailure(def: Cohort): string | null {
	if (!ID_PATTERN.test(def.id)) return `id "${def.id}" is not kebab-case`;
	if (!hasDialect(def.dialect)) return `${def.id}: unknown dialect "${def.dialect}"`;
	return null;
}

/** The cohort registry — gate in, idempotent, ordered (mirrors IntentRegistry). */
export class CohortRegistry {
	private readonly cohorts = new Map<string, Cohort>();

	register(def: Cohort): void {
		if (this.cohorts.has(def.id)) return; // idempotent (HMR/repeat imports)
		const failure = cohortGateFailure(def);
		if (failure !== null) {
			if (import.meta.env.DEV) {
				console.warn(`[morphe-site] cohort rejected by the gate: ${failure}`);
			}
			return;
		}
		this.cohorts.set(def.id, def);
	}

	has(id: string): boolean {
		return this.cohorts.has(id);
	}

	get(id: string): Cohort | undefined {
		return this.cohorts.get(id);
	}

	list(): readonly Cohort[] {
		return [...this.cohorts.values()];
	}
}

/* ------------------------------------------------------------------------- *
 * Arrival + persistence — the pure halves (the layout owns the I/O).
 * ------------------------------------------------------------------------- */

/**
 * Decide which cohort id (if any) an arrival should activate.
 * Precedence: valid `?cohort=` param > persisted cohort > null. Unknown/garbage
 * is ignored (never an error, never a reset). Ids are exact-match.
 */
export function resolveArrivalCohort(
	param: string | null,
	persisted: string | null,
	knownIds: readonly string[],
): string | null {
	if (param !== null && knownIds.includes(param)) return param;
	return persisted ?? null;
}

/**
 * Decide whether to persist the active cohort. "No cohort" is not a choice, and
 * re-affirming the stored value writes nothing; an explicit cohort persists.
 */
export function persistableCohort(active: string | null, stored: string | null): string | null {
	if (active === null) return null;
	if (active === stored) return null;
	return active;
}

/* ------------------------------------------------------------------------- *
 * The shipped cohorts.
 * ------------------------------------------------------------------------- */

/**
 * pharma-sovereign — regulated drug-development companies that mandate Sovereign
 * deployment for IP reasons. Wears the `clinical` dialect (the regulated/GxP
 * console register). Copy leads with the IP/sovereignty pitch: local inference
 * only, no outbound inference calls; the rest of the site copy is inherited.
 */
export const PHARMA_SOVEREIGN: Cohort = {
	id: "pharma-sovereign",
	dialect: "clinical",
	copy: {
		meta: {
			title: "Sókrates — A sovereign AI department for drug development",
			description:
				"An on-premises AI department for regulated drug development. Local inference only, no outbound inference calls: your pipeline IP is reasoned over where it lives and never sent to a cloud model. Every act on a signed, auditable record.",
		},
		hero: {
			title: "A sovereign AI department for drug development.",
			lede: "Sókrates runs your cross-system operational work on a Sovereign appliance on your premises, on local inference — no outbound inference calls, ever. Your compounds, assays and trial data are read and acted on where they already live, and never sent to a model in the cloud. Tell it what runs your operation, and see what it takes on.",
		},
		closingCta: {
			sub: "Bring the workflow your IP constraints have kept off every cloud tool. Thirty minutes is enough to see Sókrates run it without your data leaving the building.",
		},
		faq: {
			entries: {
				"data-residency": {
					q: "Can our IP — compounds, assays, trial data — stay in-house?",
					a: "It never leaves. The appliance is installed inside your network and runs on local inference only — no outbound inference calls at all. A roughly 200-billion-parameter model runs on the box itself; your data is reasoned over where it already lives. No cloud model ever sees your pipeline.",
				},
				"no-shared-model": {
					q: "Could a model trained elsewhere ever see our pipeline?",
					a: "Never. The Sovereign appliance calls no externally hosted model, and nothing from your environment trains a shared one. The weights live on the box; your data stays on the box.",
				},
				"validation-audit": {
					q: "How does it hold up to validation and an audit?",
					a: "Every action is a typed act with a named owner and a signed authority record, and the full causal tree of each act is preserved as one auditable record: who did what, under whose authorization, with what data, in what order. The audit trail is the substrate itself, not a report bolted on after — built for the evidence standard your validation and QA teams already work to.",
				},
			},
			order: [
				"data-residency",
				"no-shared-model",
				"validation-audit",
				"what-if-wrong",
				"exit",
				"chatgpt-diff",
				"mid-migration",
			],
		},
	},
};

/** The shipped cohorts. Adding a cohort = add its module here. */
export const SITE_COHORTS: readonly Cohort[] = [PHARMA_SOVEREIGN];

/** The module-level default registry the layout resolves arrivals against. */
export const cohortRegistry = new CohortRegistry();

/** Idempotent registration of the shipped cohorts (safe under HMR). */
export function registerSiteCohorts(reg: CohortRegistry = cohortRegistry): void {
	for (const def of SITE_COHORTS) {
		reg.register(def);
	}
}

/** Resolve a cohort by id against the default registry (undefined if unknown). */
export function getCohort(id: string): Cohort | undefined {
	return cohortRegistry.get(id);
}

/** Whether an id names a registered cohort (against the default registry). */
export function hasCohort(id: string): boolean {
	return cohortRegistry.has(id);
}

/** Every registered cohort id, in registration order. */
export function getCohortIds(): readonly string[] {
	return cohortRegistry.list().map((c) => c.id);
}

/**
 * The shipped cohort ids (eager, for the layout's arrival check). Registration
 * is idempotent, so registering here at module load is safe and means COHORT_IDS
 * is populated before the layout's mount effect runs.
 */
registerSiteCohorts();
export const COHORT_IDS: readonly string[] = getCohortIds();
```

- [ ] **Step 4: Add the barrel export**

In `src/app/site/index.ts`, below the copy-deck export added in Task 1, add:

```ts
// The cohort registry — a cohort selects a dialect AND a copy overlay (CONTEXT.md).
export type { Cohort } from "./cohorts.js";
export {
	COHORT_IDS,
	CohortRegistry,
	cohortGateFailure,
	cohortRegistry,
	getCohort,
	hasCohort,
	persistableCohort,
	registerSiteCohorts,
	resolveArrivalCohort,
	SITE_COHORTS,
} from "./cohorts.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx vitest run src/app/site/cohorts.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `bun run check` → 0/0.

```bash
git add src/app/site/cohorts.ts src/app/site/cohorts.test.ts src/app/site/index.ts
git commit -m "feat(site): cohort registry + pharma-sovereign (clinical dialect)"
```

---

## Task 3: The active-cohort store (`active-cohort.svelte.ts`)

The app-wide active cohort as a pure rune (mirrors `active.svelte.ts`), and the
reactive `activeCopy` the presenters read. SSR-safe: nothing at module scope
touches `window`/`localStorage`.

**Files:**
- Create: `src/app/site/active-cohort.svelte.ts`
- Test: `src/app/site/active-cohort.test.ts`
- Modify: `src/app/site/index.ts` (barrel export)

- [ ] **Step 1: Write the failing test**

Create `src/app/site/active-cohort.test.ts`:

```ts
/**
 * ACTIVE-COHORT store tests — the app-wide cohort selection + reactive copy.
 *
 *   A1  Default is null; activeCopy is BASE_COPY.
 *   A2  setById to a registered cohort drives activeCopy to its resolved copy.
 *   A3  setById to an unknown id is a no-op (never a reset).
 *   A4  clear() returns to null / BASE_COPY.
 */

import { afterEach, describe, expect, it } from "vitest";
import { activeCohort, activeCopy } from "./active-cohort.svelte.js";
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/app/site/active-cohort.test.ts`
Expected: FAIL — cannot resolve `./active-cohort.svelte.js`.

- [ ] **Step 3: Write the implementation**

Create `src/app/site/active-cohort.svelte.ts`:

```ts
/**
 * THE APP-WIDE ACTIVE COHORT — the marketing τ_frame selection of WHICH cohort's
 * copy is live, and the reactive `activeCopy` derived from it.
 *
 * Mirrors dialects/active.svelte.ts: one module-level `$state`, a tiny read/write
 * API, writes guarded by the registry (an unknown id is a no-op, never a reset).
 * SSR-SAFE BY CONSTRUCTION — nothing at module scope touches window/localStorage;
 * the setters run only from client code (the layout's mount effect), so the server
 * always renders the default (null cohort → BASE_COPY) and hydration is stable.
 * Persistence lives in the client-only layout effect, not here.
 */

import { getCohort, hasCohort } from "./cohorts.js";
import { type SiteCopy, resolveCopy } from "./copy.js";

/** The app-wide active cohort id, or null for "no cohort" (base copy). */
let active = $state<string | null>(null);

export const activeCohort = {
	/** The active cohort id (reactive); null when none is selected. */
	get current(): string | null {
		return active;
	},
	/** Select a cohort by id; an unknown id is a no-op (not a reset). */
	setById(id: string): void {
		if (hasCohort(id)) active = id;
	},
	/** Return to "no cohort" (base copy). */
	clear(): void {
		active = null;
	},
};

/** The live resolved copy (reactive): base ∪ the active cohort's overlay. */
export const activeCopy = {
	get current(): SiteCopy {
		const id = active; // reactive read
		return resolveCopy(id !== null ? getCohort(id)?.copy : undefined);
	},
};
```

- [ ] **Step 4: Add the barrel export**

In `src/app/site/index.ts`, below the cohort-registry export, add:

```ts
// The app-wide active cohort + the reactive resolved copy the presenters read.
export { activeCohort, activeCopy } from "./active-cohort.svelte.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bunx vitest run src/app/site/active-cohort.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `bun run check` → 0/0.

```bash
git add src/app/site/active-cohort.svelte.ts src/app/site/active-cohort.test.ts src/app/site/index.ts
git commit -m "feat(site): active-cohort store + reactive activeCopy"
```

---

## Task 4: Thread copy through the presenters (`present.ts` + `site.test.ts`)

The targetable presenters now READ the resolved copy instead of hardcoding it.
The local `FAQ` array + `FaqEntry` interface move out (they live in `copy.ts`
now). `homeHero`, `closingCta`, `faqSection`, `howItWorksBody` take a `SiteCopy`;
the non-targetable presenters keep their no-arg signatures.

**Files:**
- Modify: `src/app/site/present.ts`
- Modify: `src/app/site/site.test.ts`

- [ ] **Step 1: Update the presenter smoke test to the new signatures (write the failing test first)**

In `src/app/site/site.test.ts`:

1. Add an import of `BASE_COPY` and the cohort copy:

```ts
import { BASE_COPY, resolveCopy } from "./copy.js";
import { getCohort } from "./cohorts.js";
```

2. Change the `PRESENTERS` table so the copy-taking presenters are bound to
   `BASE_COPY` (keeping the uniform `() => Node` shape):

```ts
const PRESENTERS: ReadonlyArray<readonly [string, () => Node]> = [
	["closingCta", () => closingCta(BASE_COPY)],
	["homeHero", () => homeHero(BASE_COPY)],
	["homeIntentStage", homeIntentStage],
	["timaeusTease", timaeusTease],
	["howItWorksHero", howItWorksHero],
	["howItWorksBody", () => howItWorksBody(BASE_COPY)],
	["faqSection", () => faqSection(BASE_COPY)],
	["architectureHero", architectureHero],
	["architectureBody", architectureBody],
];
```

3. Add a new describe block pinning that the cohort copy actually reaches the trees:

```ts
describe("S7 — cohort copy re-pitches the targetable presenters", () => {
	const pharma = resolveCopy(getCohort("pharma-sovereign")?.copy);
	it("homeHero(pharma) carries the cohort hero, not the base hero", () => {
		const json = JSON.stringify(homeHero(pharma));
		expect(json).toContain("sovereign AI department for drug development");
		expect(json).not.toContain(BASE_COPY.hero.title);
	});
	it("faqSection(pharma) leads with the IP question and renders new entries", () => {
		const json = JSON.stringify(faqSection(pharma));
		expect(json).toContain("stay in-house");
		expect(json).toContain("Could a model trained elsewhere");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/app/site/site.test.ts`
Expected: FAIL — `homeHero`/`closingCta`/`faqSection`/`howItWorksBody` are still
no-arg (type error / wrong output); `S7` fails.

- [ ] **Step 3: Update `present.ts`**

In `src/app/site/present.ts`:

1. Import the copy type at the top (after the existing `import type { Node }`):

```ts
import type { SiteCopy } from "./copy.js";
```

2. `closingCta` takes copy:

```ts
export function closingCta(copy: SiteCopy): Node {
	return {
		kind: "compound",
		name: "SiteCtaBanner",
		emphasis: "strong",
		args: {
			heading: t(copy.closingCta.heading, "heading", { emphasis: "strong" }),
			sub: t(copy.closingCta.sub, "body", { emphasis: "muted" }),
		},
	};
}
```

3. `homeHero` takes copy:

```ts
export function homeHero(copy: SiteCopy): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			title: t(copy.hero.title, "display", { emphasis: "strong" }),
			lede: t(copy.hero.lede, "body", { emphasis: "muted" }),
		},
	};
}
```

4. DELETE the local `FaqEntry` interface and the `FAQ` array (now in `copy.ts`),
   and rewrite `faqSection` to read the keyed copy in `order`:

```ts
export function faqSection(copy: SiteCopy): Node {
	const items: Node[] = copy.faq.order.map((id) => {
		const entry = copy.faq.entries[id];
		if (entry === undefined) throw new Error(`faqSection: unknown faq id in order: ${id}`);
		return {
			kind: "disclosure",
			summary: entry.q,
			children: [t(entry.a, "body", { emphasis: "muted" })],
		};
	});
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			t("The honest version.", "heading", { emphasis: "strong" }),
			{ kind: "spacer", size: "xs" },
			{ kind: "stack", role: "list", direction: "block", children: items },
		],
	};
}
```

5. `howItWorksBody` takes copy and threads it to `faqSection` (only the final
   `faqSection()` call changes — everything above it is unchanged):

```ts
export function howItWorksBody(copy: SiteCopy): Node {
```

and at the end of its `children` array, replace `faqSection(),` with
`faqSection(copy),`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run src/app/site/site.test.ts`
Expected: PASS (S1–S7 green).

- [ ] **Step 5: Typecheck (this WILL flag the route call sites — fixed in Task 6)**

Run: `bun run check`
Expected: errors ONLY in `src/routes/+page.svelte`, `src/routes/architecture/+page.svelte`,
`src/routes/how-it-works/+page.svelte` (they still call the presenters with no
args). These are fixed in Task 6. The `src/app/site/**` modules typecheck clean.

> Note: do not commit a red typecheck. Either proceed straight to Task 6 and
> commit the presenter + route changes together, or stage `present.ts` +
> `site.test.ts` now and only run the unit tests (`bunx vitest run
> src/app/site/site.test.ts`) before moving on. Recommended: continue to Task 6,
> then commit Tasks 4+6 together at Task 6 Step 6.

---

## Task 5: Intent persistence — the engine tracks the open morph

The intent engine gains an in-memory `openIntentId` (the id of the morph
currently open, or null). The page persists it; arrival restores it. The engine
stays SSR-safe (no `window`); `resolveArrivalIntent` is UNCHANGED (precedence is
`param ?? persisted` at the call site, done in Task 6).

**Files:**
- Modify: `src/app/site/intent-engine.svelte.ts`
- Modify: `src/app/site/intents.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/app/site/intents.test.ts`, add a new describe block (after the `I6`
block ends, near line 374):

```ts
describe("I7 — the engine tracks the open morph id (intent persistence)", () => {
	const reg = new IntentRegistry();
	registerSiteIntents(reg);

	it("opening a stage morph sets openIntentId; closing it clears it", () => {
		intentEngine.setStage(homeIntentStageEnvelope());
		expect(intentEngine.openIntentId).toBeNull();

		const open = resolveArrivalIntent("governance-story", reg) as SiteIntent;
		intentEngine.execute(open);
		expect(intentEngine.openIntentId).toBe("governance-story");

		// re-invoking the open intent closes it (toggle) → back to null
		intentEngine.execute(open);
		expect(intentEngine.openIntentId).toBeNull();
	});

	it("a flip-dialect intent never touches openIntentId", () => {
		intentEngine.setStage(homeIntentStageEnvelope());
		const open = resolveArrivalIntent("technical-version", reg) as SiteIntent;
		intentEngine.execute(open);
		expect(intentEngine.openIntentId).toBe("technical-version");

		const flip = reg.get("flip-the-lights") as SiteIntent;
		intentEngine.execute(flip);
		expect(intentEngine.openIntentId).toBe("technical-version"); // unchanged
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run src/app/site/intents.test.ts`
Expected: FAIL — `intentEngine.openIntentId` is undefined.

- [ ] **Step 3: Update `intent-engine.svelte.ts`**

1. Below the existing `announcement` state (around line 68), add:

```ts
/** The id of the stage morph currently open, or null (intent persistence). */
let openIntentId = $state<string | null>(null);
```

2. In the `intentEngine` object, after the `announcement` getter, add a getter:

```ts
	/** The id of the open stage morph (reactive); null when the stage is at default. */
	get openIntentId(): string | null {
		return openIntentId;
	},
```

3. In `execute`, inside the `case "stage-delta":` block, after
   `stage = outcome.envelope;` and the `announcement = ...` line, add:

```ts
				openIntentId = closing ? null : intent.id;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run src/app/site/intents.test.ts`
Expected: PASS (I1–I7 green).

- [ ] **Step 5: Typecheck and commit**

Run: `bun run check` (note: route errors from Task 4 may still be present if Task
4 wasn't committed; the `src/app/site/**` files typecheck clean). Commit the
engine slice:

```bash
git add src/app/site/intent-engine.svelte.ts src/app/site/intents.test.ts
git commit -m "feat(site): intent engine tracks openIntentId for persistence"
```

---

## Task 6: Wire arrival, persistence, and reactive copy into the routes

The layout resolves `?cohort=`/`?dialect=` and persists them; the home resolves
`?intent=`, persists the open morph, and renders reactive copy + head; the
architecture and how-it-works routes thread `activeCopy` into their presenters.

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/architecture/+page.svelte`
- Modify: `src/routes/how-it-works/+page.svelte`

- [ ] **Step 1: Rewrite the layout arrival + persistence**

In `src/routes/+layout.svelte`:

1. Extend the `$lib` import to add `hasDialect`:

```ts
import {
	activeDialect,
	applyDialect,
	DEFAULT_DIALECT_ID,
	DIALECT_IDS,
	dialectStyle,
	hasDialect,
	persistableDialect,
	resolveArrivalDialect,
} from "$lib";
```

2. Add a `$site` import and register cohorts at module load (idempotent):

```ts
import {
	activeCohort,
	COHORT_IDS,
	getCohort,
	persistableCohort,
	registerSiteCohorts,
	resolveArrivalCohort,
} from "$site";

registerSiteCohorts();
```

3. Add the cohort storage key beside the dialect keys:

```ts
const COHORT_STORAGE_KEY = "mo-cohort";
```

4. Replace the arrival `$effect` (the one that reads `?cohort=` for the dialect)
   with cohort-first resolution, then dialect resolution with the cohort's
   dialect as the baseline:

```ts
$effect(() => {
	if (typeof localStorage === "undefined") return;
	// One-time amnesty: drop the v1 key entirely (default-polluted).
	localStorage.removeItem(LEGACY_DIALECT_STORAGE_KEY);

	// COHORT first — it drives the copy AND supplies the dialect baseline.
	const cohortParam = untrack(() => page.url.searchParams.get("cohort"));
	const resolvedCohort = resolveArrivalCohort(
		cohortParam,
		localStorage.getItem(COHORT_STORAGE_KEY),
		COHORT_IDS,
	);
	if (resolvedCohort !== null) activeCohort.setById(resolvedCohort);
	const cohortDialect = resolvedCohort !== null ? (getCohort(resolvedCohort)?.dialect ?? null) : null;

	// DIALECT — explicit `?dialect=` or a persisted explicit toggle wins; else
	// the cohort's dialect; else leave the default. A stale persisted id falls
	// through to the cohort's dialect (setById guards either way).
	const dialectParam = untrack(() => page.url.searchParams.get("dialect"));
	const persistedDialect = localStorage.getItem(DIALECT_STORAGE_KEY);
	const explicit = resolveArrivalDialect(dialectParam, persistedDialect, DIALECT_IDS);
	const target = explicit !== null && hasDialect(explicit) ? explicit : cohortDialect;
	if (target !== null) activeDialect.setById(target);

	arrivalResolved = true;
});
```

5. Add a cohort write-back `$effect` (after the existing dialect write-back), and
   change the dialect write-back's baseline to the cohort's dialect so a
   cohort-derived palette is never persisted as an explicit preference:

```ts
$effect(() => {
	const id = activeDialect.id; // reactive read first
	if (!arrivalResolved || typeof localStorage === "undefined") return;
	const cohortId = activeCohort.current;
	const baseline = cohortId !== null ? (getCohort(cohortId)?.dialect ?? DEFAULT_DIALECT_ID) : DEFAULT_DIALECT_ID;
	const value = persistableDialect(id, localStorage.getItem(DIALECT_STORAGE_KEY), baseline);
	if (value !== null) localStorage.setItem(DIALECT_STORAGE_KEY, value);
});
$effect(() => {
	const cohortId = activeCohort.current; // reactive read first
	if (!arrivalResolved || typeof localStorage === "undefined") return;
	const value = persistableCohort(cohortId, localStorage.getItem(COHORT_STORAGE_KEY));
	if (value !== null) localStorage.setItem(COHORT_STORAGE_KEY, value);
});
```

> The existing dialect write-back effect (currently using `DEFAULT_DIALECT_ID` as
> the baseline) is REPLACED by the first effect above; do not keep both.

- [ ] **Step 2: Rewrite the home page copy + intent wiring**

In `src/routes/+page.svelte`:

1. Add `activeCopy` to the `$site` import block (alongside the existing names):

```ts
import {
	activeCopy,
	closingCta,
	homeHero,
	homeIntentStageEnvelope,
	intentEngine,
	registerSiteCompounds,
	registerSiteIntents,
	resolveArrivalIntent,
} from "$site";
```

2. Add the intent storage key and make the copy + trees reactive (replace the
   `const heroTree = homeHero();` / `const ctaTree = closingCta();` lines):

```ts
const INTENT_STORAGE_KEY = "mo-intent";

const copy = $derived(activeCopy.current);
const heroTree = $derived(homeHero(copy));
const ctaTree = $derived(closingCta(copy));
const stageEnvelope = homeIntentStageEnvelope();

// Guards the intent write-back from racing the restore on mount.
let stageArrivalResolved = false;
```

3. Replace the arrival `$effect` so it resolves `?intent=` OR the persisted intent
   (param wins), and persists the open morph thereafter:

```ts
$effect(() => {
	intentEngine.setStage(stageEnvelope);
	// ARRIVAL INTENT (KRA-376) + persistence: a valid `?intent=` param, else the
	// persisted morph, opens through the same execute() path the chips ride.
	const param = untrack(() => page.url.searchParams.get("intent"));
	const persisted = typeof localStorage !== "undefined" ? localStorage.getItem(INTENT_STORAGE_KEY) : null;
	const arrival = resolveArrivalIntent(param ?? persisted);
	if (arrival !== null) intentEngine.execute(arrival);
	stageArrivalResolved = true;
	return () => intentEngine.setStage(null);
});
// Persist the open morph: a returning visitor re-lands on it; closing it (or the
// engine returning to default) clears it. In-session chip/close always wins.
$effect(() => {
	const open = intentEngine.openIntentId; // reactive read first
	if (!stageArrivalResolved || typeof localStorage === "undefined") return;
	if (open === null) localStorage.removeItem(INTENT_STORAGE_KEY);
	else localStorage.setItem(INTENT_STORAGE_KEY, open);
});
```

4. Make the `<svelte:head>` reactive (replace the hardcoded title + description):

```svelte
<svelte:head>
	<title>{copy.meta.title}</title>
	<meta name="description" content={copy.meta.description} />
</svelte:head>
```

- [ ] **Step 3: Thread copy into the architecture route**

In `src/routes/architecture/+page.svelte`:

1. Add `activeCopy` to the `$site` import:

```ts
import { activeCopy, architectureBody, architectureHero, closingCta, registerSiteCompounds } from "$site";
```

2. Make the close reactive (replace `const ctaTree = closingCta();`):

```ts
const ctaTree = $derived(closingCta(activeCopy.current));
```

(`architectureHero()`/`architectureBody()` stay no-arg — not targeted in v1.)

- [ ] **Step 4: Thread copy into the how-it-works route**

In `src/routes/how-it-works/+page.svelte`:

1. Add `activeCopy` to the `$site` import:

```ts
import { activeCopy, closingCta, howItWorksBody, howItWorksHero, registerSiteCompounds } from "$site";
```

2. Make the body + close reactive (replace `const bodyTree = howItWorksBody();`
   and `const ctaTree = closingCta();`):

```ts
const copy = $derived(activeCopy.current);
const bodyTree = $derived(howItWorksBody(copy));
const ctaTree = $derived(closingCta(copy));
```

(`howItWorksHero()` stays no-arg; the page stays pinned to the `timaeus` dialect
per-surface — copy varies by cohort, the dialect on this page does not.)

- [ ] **Step 5: Typecheck + full suite**

Run: `bun run check`
Expected: 0 errors, 0 warnings (the Task-4 route errors are now resolved).

Run: `bun run test`
Expected: all suites PASS (copy, cohorts, active-cohort, site, intents, arrival
pending Task 7, dialects, render).

> If `arrival.test.ts` fails here, that is expected — Task 7 updates it. You may
> run `bunx vitest run --exclude '**/arrival.test.ts'` to confirm everything else
> is green before doing Task 7.

- [ ] **Step 6: Commit (Tasks 4 + 6 together — the presenter signatures and their call sites)**

```bash
git add src/app/site/present.ts src/app/site/site.test.ts \
	src/routes/+layout.svelte src/routes/+page.svelte \
	src/routes/architecture/+page.svelte src/routes/how-it-works/+page.svelte
git commit -m "feat(site): cohort copy + ?cohort=/?dialect=/?intent= arrival wiring"
```

---

## Task 7: Update the arrival tests to the cohort/dialect split

`?cohort=` now names a COHORT (not a raw dialect); raw dialect selection is
`?dialect=`. **Layering matters:** `src/lib/**` must not import `$site` (app
code), so the lib test keeps only the pure, dialect-only concern (driven by
`?dialect=`); the cohort→dialect sequence lives in a NEW app-level test where
`app → lib` is the correct import direction.

**Files:**
- Modify: `src/lib/dialects/arrival.test.ts` (retarget C5 to `?dialect=`, no `$site`)
- Create: `src/app/site/cohort-arrival.test.ts` (the cohort/dialect sequence)

- [ ] **Step 1: Retarget the lib C5 block to `?dialect=` (no `$site` import)**

In `src/lib/dialects/arrival.test.ts`, the old C5 drove the dialect through
`?cohort=` — now invalid (`?cohort=` names a cohort). Replace the C5 `describe`
with the same store-sanity test driven by `?dialect=` (the lib's own concern;
still NO `$site` import — the file keeps its existing imports only):

```ts
describe("C5 — arrival-sequence sanity against the real store (?dialect=)", () => {
	/**
	 * The dialect half of the layout's mount sequence: read `?dialect=`, resolve
	 * via the pure rule, apply via setById. (URL mocked, persisted as a value.)
	 */
	function arrive(href: string, persisted: string | null): void {
		const dialect = new URL(href).searchParams.get("dialect");
		const resolved = resolveArrivalDialect(dialect, persisted, DIALECT_IDS);
		if (resolved !== null) activeDialect.setById(resolved);
	}

	it("?dialect=clinical lands with clinical active", () => {
		arrive("https://sokrates.example/?dialect=clinical", null);
		expect(activeDialect.current).toBe(clinical);
		expect(activeDialect.id).toBe("clinical");
	});

	it("a valid ?dialect= outranks the persisted choice", () => {
		arrive("https://sokrates.example/?dialect=reykjavik-registry", "clinical");
		expect(activeDialect.id).toBe("reykjavik-registry");
	});

	it("no ?dialect= param restores the persisted choice", () => {
		arrive("https://sokrates.example/", "clinical");
		expect(activeDialect.id).toBe("clinical");
	});

	it("an unknown ?dialect= with no persistence leaves the default active", () => {
		arrive("https://sokrates.example/?dialect=banana", null);
		expect(activeDialect.current).toBe(DEFAULT_DIALECT);
	});

	it("an unknown ?dialect= with a STALE persisted id still leaves the selection intact", () => {
		arrive("https://sokrates.example/?dialect=banana", "long-retired-dialect");
		expect(activeDialect.current).toBe(DEFAULT_DIALECT);
	});
});
```

Leave C1–C4 and the `persistableDialect` block unchanged. Also update the file's
top doc comment: the `?cohort=` references now describe `?dialect=` (the param
that selects a raw dialect); `?cohort=` selects a cohort, covered by the app test.

- [ ] **Step 2: Run the lib test to verify it passes**

Run: `bunx vitest run src/lib/dialects/arrival.test.ts`
Expected: PASS.

- [ ] **Step 3: Create the app-level cohort/dialect arrival test (failing first)**

Create `src/app/site/cohort-arrival.test.ts`:

```ts
/**
 * COHORT ARRIVAL — the app-level resolution sequence the layout runs: a cohort
 * supplies the dialect baseline, an explicit `?dialect=` (or a persisted explicit
 * toggle) overrides it, and an explicit choice always wins on return. This test
 * legitimately spans $lib (the dialect store) and $site (the cohort registry) —
 * the app→lib direction is the correct one (the inverse would break layering).
 */

import { afterEach, describe, expect, it } from "vitest";
import { activeDialect, DEFAULT_DIALECT, DIALECT_IDS, resolveArrivalDialect } from "$lib";
import { COHORT_IDS, getCohort, resolveArrivalCohort } from "$site";

afterEach(() => activeDialect.set(DEFAULT_DIALECT));

/** The layout's dialect mount sequence, verbatim. */
function arrive(href: string, persistedCohort: string | null, persistedDialect: string | null): void {
	const url = new URL(href);
	const cohort = resolveArrivalCohort(url.searchParams.get("cohort"), persistedCohort, COHORT_IDS);
	const cohortDialect = cohort !== null ? (getCohort(cohort)?.dialect ?? null) : null;
	const explicit = resolveArrivalDialect(url.searchParams.get("dialect"), persistedDialect, DIALECT_IDS);
	const target = explicit !== null ? explicit : cohortDialect;
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
});
```

- [ ] **Step 4: Run it (fails until $site exports exist — they do after Tasks 2/3), then passes**

Run: `bunx vitest run src/app/site/cohort-arrival.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dialects/arrival.test.ts src/app/site/cohort-arrival.test.ts
git commit -m "test: arrival tests for the cohort/dialect param split"
```

---

## Task 8: Full gate + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck clean**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Full test suite**

Run: `bun run test`
Expected: every suite PASS.

- [ ] **Step 3: Lint/format**

Run: `bun run lint`
Expected: clean (run `bun run format` first if Biome reports fixable issues).

- [ ] **Step 4: Production build (SSR + client)**

Run: `bun run build`
Expected: build succeeds (the server renders BASE_COPY + default dialect — no
hydration crash).

- [ ] **Step 5: Manual smoke (browser)**

Run: `bun run dev`, then check:
- `/` → base hero ("You now have an AI department."), gallery ground.
- `/?cohort=pharma-sovereign` → pharma hero ("A sovereign AI department for drug
  development."), clinical (cold steel-blue) ground; the tab title updates; the
  close band shows the pharma sub.
- Navigate to `/how-it-works` → the FAQ leads with "Can our IP … stay in-house?"
  and the two new entries; the page stays in the timaeus world.
- Reload `/` (no params) → pharma copy + clinical ground persist (from
  `mo-cohort`). Flip the lights on `/substrate` → the explicit dialect persists
  and survives the next reload over the cohort's clinical.
- `/?intent=governance-story` → the governance morph opens on arrival; reload →
  it re-opens (persisted); close it → reload shows the default plates tease.
- Mobile width + `prefers-reduced-motion`: morphs still honest, no layout break.

- [ ] **Step 6: Final commit (if any formatting/touch-ups)**

```bash
git add -A
git commit -m "chore(site): formatting + smoke fixes for cohort copy" || echo "nothing to commit"
```

---

## Self-review notes (coverage map)

| Spec item | Task |
|---|---|
| Cohort registry, decoupled from dialect, gated | Task 2 |
| `SiteCopy` + base + `CohortCopyOverlay` + `resolveCopy` | Task 1 |
| `activeCohort` store + reactive `activeCopy` | Task 3 |
| Presenters read resolved copy; FAQ keyed | Task 4 |
| `?cohort=`/`?dialect=`/`?intent=` arrival + precedence | Task 6 (+ Task 7 tests) |
| All three persisted; cohort-dialect never masquerades | Task 6 (layout effects) |
| Intent persists (engine `openIntentId`) | Task 5 + Task 6 |
| `pharma-sovereign` full copy, canon-correct ("no outbound inference calls") | Task 2 |
| Client-only swap; SSR rendered base | Tasks 3/6 ($effect discipline) |
| Copy hygiene (no banned/Trajectory tokens) over resolved cohort copy | Task 2 (K6), Task 4 (S7) |
| Tests: copy/cohorts/active-cohort/site/intents/arrival | Tasks 1–7 |
| SSR-on-arrival, morph-stage/architecture targeting, IS copy | Out of scope (named follow-ups) |

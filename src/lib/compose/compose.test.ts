/**
 * Composer smoke tests — proves the read-only "What can Sókrates do for you?"
 * surface is coherent end to end: the five domain compounds register cleanly
 * through the factory gate, the deterministic matcher ranks a representative pain
 * sensibly, the presenter turns matches into a well-formed Frame tree of
 * CapabilityCard refs, and the grounded corpus stays large and mechanically
 * valid, each capability carrying at least one real endpoint surface.
 *
 * Everything under test is pure data + pure functions; no clock, no RNG, no I/O.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CompoundRef, Node } from "$morphe";
import { CompoundRegistry } from "$morphe";
import { COMPOSE_COMPOUNDS, registerComposeCompounds } from "./compounds.js";
import { CAPABILITIES } from "./corpus.js";
import type { ComposeQuery } from "./input.js";
import { featuredCapabilities, matchCapabilities } from "./match.js";
import { capabilityCard, composeAnswer, offDomainState, thinMatchState } from "./present.js";
import { CATEGORIES, CATEGORY_LABELS, categoriesOf, categoryOf, SYSTEMS } from "./taxonomy.js";

describe("compose compounds — registration through the factory gate", () => {
	it("registers all five compose compounds cleanly on a fresh registry", () => {
		const reg = new CompoundRegistry();
		// Idempotent batch registration; throws on a genuine registration failure.
		expect(() => registerComposeCompounds(reg)).not.toThrow();

		expect(COMPOSE_COMPOUNDS.length).toBe(5);
		for (const def of COMPOSE_COMPOUNDS) {
			expect(reg.has(def.name)).toBe(true);
		}
	});

	it("is idempotent — a second pass over the same registry is a no-op", () => {
		const reg = new CompoundRegistry();
		registerComposeCompounds(reg);
		expect(() => registerComposeCompounds(reg)).not.toThrow();
		expect(reg.names.length).toBe(COMPOSE_COMPOUNDS.length);
	});
});

describe("compose matching — deterministic, pain-led ranking", () => {
	const query: ComposeQuery = {
		pain: "shift planning is slow and error prone",
		systems: ["humanity", "dkplus"],
	};

	it("returns a non-empty ranked list for a representative pain", () => {
		const matches = matchCapabilities(query);
		expect(matches.length).toBeGreaterThan(0);
	});

	it("ranks a scheduling/labor-related capability at the top", () => {
		const matches = matchCapabilities(query);
		const top = matches[0];
		expect(top).toBeDefined();
		// "shift planning" resolves to the scheduling tag; the top match must carry it.
		expect(top?.painPoints).toContain("scheduling");
	});

	it("is deterministic — the same query yields the same ranking", () => {
		const a = matchCapabilities(query).map((c) => c.id);
		const b = matchCapabilities(query).map((c) => c.id);
		expect(a).toEqual(b);
	});
});

describe("compose matching — subset eligibility across one, two and three systems", () => {
	// The hard gate: a capability surfaces only when its full required `systems` set
	// is a SUBSET of the visitor's selected systems. Helper: are all of `cap.systems`
	// in the selection? (mirrors match.ts's gate, asserted from the outside).
	const systemsSubsetOf = (required: readonly string[], selected: readonly string[]): boolean => {
		const sel = new Set(selected);
		return required.every((id) => sel.has(id));
	};

	it("['twenty'] surfaces ONLY caps whose systems are a subset of {twenty}", () => {
		const query: ComposeQuery = {
			// "stale deal" + "duplicate" + "tasks" hit the Twenty-only families.
			pain: "stale deals are piling up and our pipeline is full of duplicate companies",
			systems: ["twenty"],
		};
		const matches = matchCapabilities(query);
		expect(matches.length).toBeGreaterThan(0);
		// EVERY match must be runnable with only Twenty selected.
		for (const cap of matches) {
			expect(cap.systems, `${cap.id} leaked into a twenty-only selection`).toEqual(["twenty"]);
			expect(systemsSubsetOf(cap.systems, ["twenty"])).toBe(true);
		}
		// And it actually found a real Twenty-only capability.
		expect(matches.some((c) => c.id === "twenty-stale-deal-detection")).toBe(true);
	});

	it("['twenty','dkplus'] includes a Twenty×dkPlus cap and excludes any needing Humanity", () => {
		const query: ComposeQuery = {
			pain: "when a deal is won we re-key the customer and the sales order by hand to invoice it",
			systems: ["twenty", "dkplus"],
		};
		const matches = matchCapabilities(query);
		expect(matches.length).toBeGreaterThan(0);
		// The CRM→ERP pair cap is eligible and present.
		const pair = matches.find((c) => c.id === "won-opportunity-to-dkplus-customer-and-sales-order");
		expect(pair, "Twenty×dkPlus cap not surfaced").toBeDefined();
		expect(pair?.systems).toEqual(["twenty", "dkplus"]);
		// Nothing requiring Humanity (a two-system pair we didn't select, or the
		// three-way loop) may leak through.
		for (const cap of matches) {
			expect(cap.systems.includes("humanity"), `${cap.id} requires unselected humanity`).toBe(
				false,
			);
			expect(systemsSubsetOf(cap.systems, ["twenty", "dkplus"])).toBe(true);
		}
	});

	it("all three selected unlocks a three-way 'deal to delivery' capability", () => {
		const query: ComposeQuery = {
			pain: "a won deal should staff the crew, open the project and advance the stage",
			systems: ["twenty", "humanity", "dkplus"],
		};
		const matches = matchCapabilities(query);
		expect(matches.length).toBeGreaterThan(0);
		const threeWay = matches.find(
			(c) => c.id === "deal-to-delivery-staff-project-and-advance-stage",
		);
		expect(threeWay, "three-way loop not surfaced with all systems selected").toBeDefined();
		expect([...(threeWay?.systems ?? [])].sort()).toEqual(["dkplus", "humanity", "twenty"]);
		// A three-system cap can only ever surface when all three are selected.
		expect(systemsSubsetOf(threeWay?.systems ?? [], ["twenty", "humanity", "dkplus"])).toBe(true);
	});

	it("removing a required system drops its dependent caps (gate is hard, not soft)", () => {
		const pain = "a won deal should staff the crew, open the project and advance the stage";
		const withAll = matchCapabilities({
			pain,
			systems: ["twenty", "humanity", "dkplus"],
		});
		const withoutHumanity = matchCapabilities({
			pain,
			systems: ["twenty", "dkplus"],
		});
		const id = "deal-to-delivery-staff-project-and-advance-stage";
		expect(withAll.some((c) => c.id === id)).toBe(true);
		// Drop Humanity and the three-way loop must disappear entirely.
		expect(withoutHumanity.some((c) => c.id === id)).toBe(false);
	});
});

describe("compose presenting — the answer is a well-formed Frame of cards", () => {
	const query: ComposeQuery = {
		pain: "shift planning is slow and error prone",
		systems: ["humanity", "dkplus"],
	};

	it("composeAnswer returns a Frame node containing CapabilityCard refs", () => {
		const matches = matchCapabilities(query);
		// Pass an explicit limit at/above the match count so every match renders — the
		// structural invariant under test is "one card per matched capability".
		const tree = composeAnswer(matches, query, matches.length);

		expect(tree.kind).toBe("frame");

		// The card refs live in the page's Grid(list); find it and assert the cards.
		const json = JSON.stringify(tree);
		expect(json).toContain("ComposeCapabilityCard");
		expect(json).toContain("ComposePainPrompt");

		// Structurally: a card ref per matched capability, all of the right name.
		const cards = collectCompoundRefs(tree, "ComposeCapabilityCard");
		expect(cards.length).toBe(matches.length);
	});

	it("composeAnswer honors `limit` — caps the cards, with no count note (D5)", () => {
		const matches = matchCapabilities(query);
		// This query out-yields a small cap, so the limit is exercised honestly.
		expect(matches.length).toBeGreaterThan(3);

		const tree = composeAnswer(matches, query, 3);
		const cards = collectCompoundRefs(tree, "ComposeCapabilityCard");
		// At most `limit` cards render.
		expect(cards.length).toBe(3);

		// D5: the answer IS the result — no "Showing N of M" / full-corpus count.
		expect(JSON.stringify(tree)).not.toContain("Showing");
	});

	it("composeAnswer omits the count note when nothing was capped", () => {
		const matches = matchCapabilities(query);
		const tree = composeAnswer(matches, query, matches.length);
		expect(JSON.stringify(tree)).not.toContain("Showing");
	});

	it("composeAnswer caps to `limit` (a safety floor, not a 'show all'); default is 4", () => {
		// A broad, multi-tag pain across all three systems out-yields the cap. The
		// answer is a tight RESULT (the most relevant few led by one dominant card),
		// never a catalogue — there is no "show all" in the flow (D5); `limit` is just
		// a safety cap on the pure presenter, and the client passes the thresholded set.
		const broad: ComposeQuery = {
			pain: "scheduling, overtime, invoicing, margin, deals, master-data and reporting are all painful",
			systems: ["humanity", "dkplus", "twenty"],
		};
		const matches = matchCapabilities(broad);
		expect(matches.length).toBeGreaterThan(4);

		// limit 4: at most 4 cards render.
		const capped = composeAnswer(matches, broad, 4);
		expect(collectCompoundRefs(capped, "ComposeCapabilityCard").length).toBe(4);

		// A limit at/above the match count renders every match (the card refs span the
		// dominant lead card AND the remainder grid, so the recursive count is
		// structure-independent — one card per matched capability).
		const all = composeAnswer(matches, broad, matches.length);
		expect(collectCompoundRefs(all, "ComposeCapabilityCard").length).toBe(matches.length);

		// Omitting the limit applies the DEFAULT_LIMIT (4).
		const omitted = composeAnswer(matches, broad);
		expect(collectCompoundRefs(omitted, "ComposeCapabilityCard").length).toBe(4);
	});

	it("composeAnswer leads with one dominant card outside the remainder grid", () => {
		const matches = matchCapabilities(query);
		expect(matches.length).toBeGreaterThan(2);
		const tree = composeAnswer(matches, query, 4);

		// The page frame's direct children: masthead, spacer, the DOMINANT lead card
		// (a CapabilityCard ref in block flow — full width), spacer, then the
		// remainder Grid. The lead card is NOT inside the grid — that asymmetry is the
		// fix for the identical-card-wall (DESIGN §5).
		const frameKids = childrenOfNode(tree);
		const leadCard = frameKids.find(
			(n) => n.kind === "compound" && n.name === "ComposeCapabilityCard",
		);
		expect(leadCard).toBeDefined();
		const grid = frameKids.find((n) => n.kind === "grid");
		expect(grid).toBeDefined();
		if (grid === undefined) return;
		// Exactly one card leads outside the grid; the rest are inside it.
		const inGrid = collectCompoundRefs(grid, "ComposeCapabilityCard").length;
		const total = collectCompoundRefs(tree, "ComposeCapabilityCard").length;
		expect(total - inGrid).toBe(1);
	});
});

describe("compose presenting — relevance states (D4)", () => {
	const query: ComposeQuery = {
		pain: "cinnamon hot dogs",
		systems: ["humanity", "dkplus", "twenty"],
	};

	it("offDomainState is a card-less, honest refusal that redirects", () => {
		const tree = offDomainState();
		expect(tree.kind).toBe("frame");
		// No capability cards — an off-domain query shows none.
		expect(collectCompoundRefs(tree, "ComposeCapabilityCard").length).toBe(0);
		// Still carries the masthead and names what Sókrates does (a redirect, not a dead end).
		const json = JSON.stringify(tree);
		expect(json).toContain("ComposePainPrompt");
		expect(json).toContain("outside what Sókrates works on");
	});

	it("thinMatchState shows the few cards under a 'loose match' masthead", () => {
		const caps = CAPABILITIES.slice(0, 3);
		const tree = thinMatchState(caps, query);
		expect(tree.kind).toBe("frame");
		expect(collectCompoundRefs(tree, "ComposeCapabilityCard").length).toBe(caps.length);
		expect(JSON.stringify(tree)).toContain("loose match");
	});

	it("the off-domain refusal copy carries no em dash (DESIGN §9 bans them in copy)", () => {
		// offDomainState is card-less, so its whole tree is authored state copy (no
		// corpus card text) — a clean guard against the em-dash ban regressing.
		expect(JSON.stringify(offDomainState())).not.toContain("—");
	});
});

describe("compose presenting — outcome-led card relocates proof but keeps tier + real method", () => {
	it("a proposes card leads with the outcome and demotes proof under the wiring disclosure", () => {
		const reg = new CompoundRegistry();
		registerComposeCompounds(reg);
		const cap = CAPABILITIES.find((c) => c.tier === "proposes");
		expect(cap).toBeDefined();
		if (!cap) return;

		// Expand through the factory (fills flow/evidence/models slots + nested refs).
		const expanded = reg.expand(capabilityCard(cap));
		const json = JSON.stringify(expanded);

		// THE HERO: the business outcome is present and rendered as the prominent
		// strong subheading — the customer reads the result first. Assert the outcome
		// Text node structurally (value + subheading + strong on one node) rather than
		// by brittle key adjacency, so a human polishing the register later is free to
		// add fields without breaking this.
		expect(json).toContain(cap.value);
		const outcomeNode = findTextNode(
			expanded,
			(t) => t.value === cap.value && t.as === "subheading" && t.emphasis === "strong",
		);
		expect(outcomeNode, "outcome value is not a strong subheading hero").toBeDefined();

		// tier param is rendered (honest governance is trust, kept visible), not the
		// old hardcoded chip. The value subheading is the outcome, never the tier.
		expect(json).toContain("Proposes, never acts");
		expect(json).not.toContain('"Read-only"');

		// THE PROOF IS DEMOTED, NOT DELETED: the single quiet wiring disclosure owns it.
		expect(json).toContain("How Sókrates wires this");
		// the first surface's real HTTP method still renders (as the evidence badge
		// label) — relocated under the disclosure, still verifiable.
		const method = cap.surfaces[0]?.method;
		expect(method).toBeDefined();
		if (method) expect(json).toContain(method);
		// the endpoint count caption survives the relocation (proof present, just quiet).
		const count = cap.surfaces.length;
		expect(json).toContain(`Grounded in ${count} real ${count === 1 ? "endpoint" : "endpoints"}`);
		// no empty-label badge survives expansion (the SurfaceEvidence method-badge fix).
		expect(json).not.toContain('"label":""');
	});

	it("a read-only card expands to the read-only tier label", () => {
		const reg = new CompoundRegistry();
		registerComposeCompounds(reg);
		const cap = CAPABILITIES.find((c) => c.tier === "read-only");
		expect(cap).toBeDefined();
		if (!cap) return;
		const json = JSON.stringify(reg.expand(capabilityCard(cap)));
		expect(json).toContain("Read-only");
		expect(json).not.toContain("Proposes, never acts");
	});

	it("the demoted proof rows carry the CAPTION register, not body (quiet lives in the data)", () => {
		// FINDING-2 REGRESSION: the SurfaceEvidence path/summary/system/direction and
		// the ModelView name now ride as NODE params with an explicit `caption`
		// register, so the proof reads QUIETER than the card's outcome. Before the fix
		// they were bare STRING params that the factory coerced to register-less Text,
		// which Text defaults to BODY — heavier and larger than the card's own
		// supporting copy, contradicting the "proof is quiet" hierarchy. Pick a cap
		// with both an endpoint and a model so both paths are exercised.
		const reg = new CompoundRegistry();
		registerComposeCompounds(reg);
		const cap = CAPABILITIES.find((c) => c.surfaces.length > 0 && (c.models?.length ?? 0) > 0);
		expect(cap, "no capability with both a surface and a model").toBeDefined();
		if (!cap) return;
		const expanded = reg.expand(capabilityCard(cap));

		// The endpoint path renders as a caption Text (the citation locus), never body.
		const path = cap.surfaces[0]?.path;
		expect(path).toBeDefined();
		if (path) {
			const pathNode = findTextNode(expanded, (t) => t.value === path);
			expect(pathNode, "endpoint path is not in the tree").toBeDefined();
			expect(pathNode?.as, "endpoint path is not caption register").toBe("caption");
		}

		// The compiled-model name renders as a caption Text (the accession chip), not body.
		const model = cap.models?.[0];
		expect(model).toBeDefined();
		if (model) {
			const modelNode = findTextNode(expanded, (t) => t.value === model);
			expect(modelNode, "model name is not in the tree").toBeDefined();
			expect(modelNode?.as, "model name is not caption register").toBe("caption");
		}

		// No proof leaf fell through to the bare register-less Text the factory would
		// have produced from a string param (`{ "kind":"text", "value":"…" }` with no
		// `as`). Every Text under the card declares its register now.
		const bareLeaf = findTextNode(expanded, (t) => t.value === path && t.as === undefined);
		expect(
			bareLeaf,
			"a proof path leaf has no explicit register (body fallthrough)",
		).toBeUndefined();
	});
});

describe("compose grounding — every cited surface is a real endpoint", () => {
	const humanity = loadEvidence("humanity.json");
	const dkplus = loadEvidence("dkplus.json");
	const twenty = loadEvidence("twenty.json");
	const index: Record<string, Map<string, EvidenceOp>> = {
		humanity: new Map(humanity.operations.map((o) => [o.operationId, o])),
		dkplus: new Map(dkplus.operations.map((o) => [o.operationId, o])),
		twenty: new Map(twenty.operations.map((o) => [o.operationId, o])),
	};

	it("resolves every surface operationId to a real op with matching method and path", () => {
		for (const cap of CAPABILITIES) {
			for (const s of cap.surfaces) {
				const sysIndex = index[s.system];
				expect(sysIndex, `${cap.id}: unknown system "${s.system}"`).toBeDefined();
				if (!sysIndex) continue;
				expect(s.operationId, `${cap.id}: surface has no operationId`).toBeDefined();
				const op = s.operationId ? sysIndex.get(s.operationId) : undefined;
				expect(
					op,
					`${cap.id}: surface "${s.operationId}" not in ${s.system} evidence`,
				).toBeDefined();
				if (!op) continue;
				expect(op.method, `${cap.id}/${s.operationId} method`).toBe(s.method);
				expect(op.path, `${cap.id}/${s.operationId} path`).toBe(s.path);
			}
		}
	});

	it("no surface path carries a leaked query string or malformed template", () => {
		for (const cap of CAPABILITIES) {
			for (const s of cap.surfaces) {
				expect(s.path.includes("?"), `${cap.id}: ${s.path}`).toBe(false);
				expect(s.path.includes("&"), `${cap.id}: ${s.path}`).toBe(false);
				expect(s.path.includes("{{"), `${cap.id}: ${s.path}`).toBe(false);
			}
		}
	});
});

describe("compose grounding — every cited MODEL name is a real compiled model", () => {
	// The endpoint half of "real endpoint + real compiled-model name" is gated above;
	// this is the model half. It is drift-tolerant for the three legitimate naming
	// conventions the corpus uses, and tight enough to catch a fabricated model
	// (the `EmployeeSkills`-style chip that resolved to no Hyle artifact).
	const twenty = loadEvidence("twenty.json");
	const dkplus = loadEvidence("dkplus.json");
	const humanity = loadEvidence("humanity.json");
	const twentyModels = new Set(twenty.models);

	// Every dkplus.json.models entry, expanded into its readable leaf forms: each
	// trailing run of dot-segments concatenated (e.g. `dkCloud.Data.Model.Sales.
	// Quote.Head` -> `Head`, `QuoteHead`, `SalesQuoteHead`, ...), with a plural
	// namespace segment also admitted in its singular form (`Vendors.InvoiceModel`
	// -> `VendorInvoiceModel`). This is exactly the leaf-naming the build-evidence
	// index produces; membership here means the leaf maps to a real dotted model.
	const dkplusLeafForms = new Set<string>();
	for (const dotted of dkplus.models) {
		for (const form of leafForms(dotted)) dkplusLeafForms.add(form);
	}

	// Humanity ships `models: []` (264 inline titles are unrecoverable per
	// specs-scope.md §3), so we cannot diff against the spec. Instead we guard
	// against fabrication with the hand-picked specs-scope.md §2 capability-model
	// row labels — the only Humanity model names the corpus is allowed to cite.
	// A future `EmployeeSkills`-style name fails here.
	const HUMANITY_ALLOWED_MODELS = new Set([
		"Availability",
		"Budget",
		"Employee",
		"Leave",
		"Location",
		"Position",
		"Shift",
		"Skill",
		"Timeclock",
		"TimeclockEvent",
	]);

	const assertModel = (system: string, model: string, where: string): void => {
		if (system === "twenty") {
			// Twenty has a complete, exactly-matching schema set (75) — exact membership.
			expect(
				twentyModels.has(model),
				`${where}: twenty model "${model}" not in twenty.json.models`,
			).toBe(true);
		} else if (system === "dkplus") {
			// dkPlus uses readable leaf display-names that map to dotted evidence keys.
			expect(
				dkplusLeafForms.has(model),
				`${where}: dkplus model "${model}" matches no dkplus.json.models leaf`,
			).toBe(true);
		} else if (system === "humanity") {
			// Humanity titles are unrecoverable; allow only the curated §2 labels.
			expect(
				HUMANITY_ALLOWED_MODELS.has(model),
				`${where}: humanity model "${model}" is not a specs-scope.md §2 label (fabrication?)`,
			).toBe(true);
		} else {
			throw new Error(`${where}: unknown system "${system}"`);
		}
	};

	it("humanity.json still ships no models — the §2 guard is the right tool here", () => {
		// If Humanity ever recovers its inline titles, switch the guard to a real diff.
		expect(humanity.models.length).toBe(0);
	});

	it("every surface.model resolves to a real compiled model for its system", () => {
		for (const cap of CAPABILITIES) {
			for (const s of cap.surfaces) {
				if (s.model === undefined) continue; // surfaces without a model are honest blanks
				assertModel(s.system, s.model, `${cap.id}/${s.operationId ?? s.path}`);
			}
		}
	});

	it("every cap.models entry resolves to a real compiled model on one of the cap's systems", () => {
		for (const cap of CAPABILITIES) {
			for (const model of cap.models ?? []) {
				// A cap-level model must be real for AT LEAST ONE of the systems the cap
				// spans (the corpus doesn't tag cap.models by system; surfaces do).
				const matchesSomeSystem = cap.systems.some((system) => {
					if (system === "twenty") return twentyModels.has(model);
					if (system === "dkplus") return dkplusLeafForms.has(model);
					if (system === "humanity") return HUMANITY_ALLOWED_MODELS.has(model);
					return false;
				});
				expect(
					matchesSomeSystem,
					`${cap.id}: cap model "${model}" is real for none of [${cap.systems.join(", ")}] (fabrication?)`,
				).toBe(true);
			}
		}
	});
});

describe("compose corpus — grounded, three-system, subset-aware", () => {
	// The corpus grew past the original 45 Humanity×dkPlus automations: it now also
	// carries single-system caps (so any one selection is never empty), the two new
	// cross-system pairs (Twenty×dkPlus, Twenty×Humanity) and the three-way loop.
	it("has more than the original 45 capabilities", () => {
		expect(CAPABILITIES.length).toBeGreaterThan(45);
	});

	it("adds a large new high-ROI surface without changing empty featured behavior", () => {
		// 73 was the pre-expansion corpus: the original 45 Humanity×dkPlus caps plus
		// single-system, pair, and three-way seed coverage. This pass should surface
		// roughly forty more evidence-grounded examples without making the no-system
		// default behave like an all-systems browser.
		expect(CAPABILITIES.length).toBeGreaterThanOrEqual(113);
		expect(featuredCapabilities([])).toEqual([]);
	});

	it("every capability carries at least one real endpoint surface", () => {
		for (const cap of CAPABILITIES) {
			expect(cap.surfaces.length).toBeGreaterThanOrEqual(1);
		}
	});

	it("every capability id is unique", () => {
		const ids = new Set(CAPABILITIES.map((c) => c.id));
		expect(ids.size).toBe(CAPABILITIES.length);
	});

	it("every capability declares a non-empty `systems` of known SYSTEM ids", () => {
		const known = new Set(SYSTEMS.map((s) => s.id));
		for (const cap of CAPABILITIES) {
			// A capability with no required systems would be vacuously subset-eligible
			// and surface for an empty selection — the subset gate would be a no-op.
			expect(cap.systems.length, `${cap.id}: empty systems`).toBeGreaterThanOrEqual(1);
			for (const id of cap.systems) {
				expect(known.has(id), `${cap.id}: unknown system "${id}"`).toBe(true);
			}
		}
	});

	it("spans the whole lattice — single, every pair, and the three-way", () => {
		// At least one capability at each subset cardinality, proving "one system,
		// any two, all three" are all answerable.
		const bySize = (n: number) => CAPABILITIES.some((c) => c.systems.length === n);
		expect(bySize(1), "no single-system capability").toBe(true);
		expect(bySize(2), "no two-system capability").toBe(true);
		expect(bySize(3), "no three-system capability").toBe(true);
	});

	it("has high-ROI examples for every non-empty exact system footprint", () => {
		const keyOf = (systems: readonly string[]): string => [...systems].sort().join("|");
		const countExact = (systems: readonly string[]): number => {
			const key = keyOf(systems);
			return CAPABILITIES.filter(
				(cap) => cap.systems.length === systems.length && keyOf(cap.systems) === key,
			).length;
		};

		expect(countExact(["twenty"]), "Twenty-only").toBeGreaterThanOrEqual(8);
		expect(countExact(["dkplus"]), "dkPlus-only").toBeGreaterThanOrEqual(8);
		expect(countExact(["humanity"]), "Humanity-only").toBeGreaterThanOrEqual(8);
		expect(countExact(["twenty", "dkplus"]), "Twenty×dkPlus").toBeGreaterThanOrEqual(12);
		expect(countExact(["twenty", "humanity"]), "Twenty×Humanity").toBeGreaterThanOrEqual(12);
		expect(countExact(["humanity", "dkplus"]), "Humanity×dkPlus").toBeGreaterThanOrEqual(53);
		expect(countExact(["twenty", "humanity", "dkplus"]), "three-way").toBeGreaterThanOrEqual(12);
	});
});

/* ---------------------------------------------------------------------------
 * Test helper — walk a Node tree and collect the CompoundRefs of a given name.
 * The composed answer nests refs inside Frame/Grid children, so a recursive
 * collector is the honest way to assert the card count structurally.
 * ------------------------------------------------------------------------- */
function collectCompoundRefs(node: Node, name: string): CompoundRef[] {
	const out: CompoundRef[] = [];
	const visit = (n: Node): void => {
		if (n.kind === "compound") {
			if (n.name === name) out.push(n);
		}
		const kids = childrenOfNode(n);
		for (const kid of kids) visit(kid);
	};
	visit(node);
	return out;
}

/** Best-effort child accessor — reads a `children` array when the node has one. */
function childrenOfNode(node: Node): Node[] {
	const maybe = (node as { children?: unknown }).children;
	return Array.isArray(maybe) ? (maybe as Node[]) : [];
}

/** A Text node's structural shape, narrowed for the predicate below. */
type TextNode = { kind: "text"; value: string; as?: string; emphasis?: string };

/**
 * Walk a Node tree and return the first Text node satisfying `pred`. Used to
 * assert a register (value + `as` + `emphasis`) on the right node WITHOUT relying
 * on brittle JSON key adjacency, so the assertion survives cosmetic field churn.
 */
function findTextNode(node: Node, pred: (t: TextNode) => boolean): TextNode | undefined {
	let found: TextNode | undefined;
	const visit = (n: Node): void => {
		if (found) return;
		if (n.kind === "text" && pred(n as unknown as TextNode)) {
			found = n as unknown as TextNode;
			return;
		}
		for (const kid of childrenOfNode(n)) visit(kid);
	};
	visit(node);
	return found;
}

/* ---------------------------------------------------------------------------
 * Grounding evidence — the committed endpoint index built from the raw specs.
 * The grounding test reads it straight off disk (vitest runs in node) and diffs
 * every corpus surface against it, so a fabricated or drifted endpoint fails CI.
 * ------------------------------------------------------------------------- */
interface EvidenceOp {
	operationId: string;
	method: string;
	path: string;
	summary: string;
}
interface EvidenceFile {
	operations: EvidenceOp[];
	models: string[];
}

function loadEvidence(file: string): EvidenceFile {
	const url = new URL(`../../../data/evidence/${file}`, import.meta.url);
	return JSON.parse(readFileSync(url, "utf8")) as EvidenceFile;
}

/* ---------------------------------------------------------------------------
 * dkPlus leaf-naming — the dkPlus corpus cites readable leaf display-names that
 * map to dotted evidence keys. Given a dotted model (e.g.
 * `dkCloud.Data.Model.Sales.Quote.Head`), enumerate every leaf form the
 * build-evidence index could have bound to an operation: each trailing run of
 * dot-segments concatenated CamelCase (`Head`, `QuoteHead`, `SalesQuoteHead`, …),
 * admitting a plural namespace segment in its singular form too (`Vendors` ->
 * `Vendor`, so `Vendors.InvoiceModel` -> `VendorInvoiceModel`). Membership of a
 * corpus leaf name in these forms proves it resolves to a real dotted model.
 * ------------------------------------------------------------------------- */
function leafForms(dotted: string): Set<string> {
	const segs = dotted.split(".");
	const out = new Set<string>();
	const segVariants = (seg: string): string[] =>
		seg.endsWith("s") ? [seg, seg.slice(0, -1)] : [seg];
	// every trailing run of segments, each segment optionally singularized
	for (let i = 0; i < segs.length; i++) {
		let combos: string[] = [""];
		for (let j = i; j < segs.length; j++) {
			const next: string[] = [];
			const seg = segs[j];
			if (seg === undefined) continue;
			for (const c of combos) for (const v of segVariants(seg)) next.push(c + v);
			combos = next;
		}
		for (const c of combos) out.add(c);
	}
	return out;
}

describe("compose taxonomy — category classification (system-agnostic axis)", () => {
	it("every system is classified into a known category with a label", () => {
		for (const s of SYSTEMS) {
			expect(CATEGORIES, `${s.id} category`).toContain(s.category);
			expect(CATEGORY_LABELS[s.category], `${s.category} label`).toBeTruthy();
			expect(categoryOf(s.id)).toBe(s.category);
		}
	});

	it("categoryOf is undefined for an unknown system", () => {
		expect(categoryOf("salesforce")).toBeUndefined();
	});

	it("each category is filled by exactly one product today (1:1 mapping)", () => {
		for (const cat of CATEGORIES) {
			const filling = SYSTEMS.filter((s) => s.category === cat);
			expect(filling.length, `${cat} products`).toBe(1);
		}
	});

	it("categoriesOf maps a system set to its deduped, canonically ordered categories", () => {
		// Order follows CATEGORIES (crm, erp, wfm), not the input order.
		expect(categoriesOf(["dkplus", "twenty"])).toEqual(["crm", "erp"]);
		expect(categoriesOf(["twenty", "dkplus", "humanity"])).toEqual(["crm", "erp", "wfm"]);
		expect(categoriesOf([])).toEqual([]);
		// Unknown ids contribute no category.
		expect(categoriesOf(["hubspot"])).toEqual([]);
	});

	it("every capability's systems all classify — its category footprint is coherent", () => {
		for (const cap of CAPABILITIES) {
			for (const s of cap.systems) {
				expect(categoryOf(s), `${cap.id}: system "${s}" has no category`).toBeDefined();
			}
			// One category per system today, so the footprint cardinality matches.
			expect(categoriesOf(cap.systems).length, `${cap.id} category footprint`).toBe(
				cap.systems.length,
			);
		}
	});
});

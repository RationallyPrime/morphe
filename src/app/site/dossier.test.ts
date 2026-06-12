/**
 * DOSSIER tests (KRA-371, KRA-374) — the onboarding intake as a typed record.
 *
 * The dossier is the first surface to run the FULL delegation circle:
 * slow loop (pure presenter re-emission) → tier-1 digest (the wizard mirrors
 * into a MorpheStore) → mid loop (createDossierMidLoop proposes) → applyDelta
 * (the gate) → render (resolveVaryOption). These tests pin every seam of that
 * circle plus the presenter's own laws:
 *
 *   D1  Purity — same draft, same tree; the draft is never mutated.
 *   D2  Stage Vary — open/sealed structure; the seal register carries the
 *       receipt only on the sealed branch.
 *   D3  Systems Vary — live only when a system is named; applyDelta accepts
 *       the compact choice and rejects out-of-range/stale-epoch totally.
 *   D4  Grounding — the SYSTEMS registry match is conservative and aliased.
 *   D5  Empty state — the record invites instead of rendering blank sections.
 *   D6  Dialect validity — every authored intent resolves under all six
 *       shipped dialects (CONTRACT §8 keyset + register extensions).
 *   D7  The mid-loop circle — store commit → digest → propose → applyDelta →
 *       compact branch; rejections leave the envelope untouched.
 */

import { describe, expect, it } from "vitest";
import type { Node, Vary } from "$lib";
import {
	applyDelta,
	commitTier1,
	createInMemoryMorpheStore,
	DIALECTS,
	digestOf,
	liveVaryIds,
	resolveVaryOption,
	unknownIntentsIn,
} from "$lib";
import type { DossierDraft } from "./dossier.js";
import {
	DOSSIER_STAGE_CHOICES,
	DOSSIER_STAGE_ID,
	DOSSIER_SYSTEMS_CHOICES,
	DOSSIER_SYSTEMS_ID,
	dossierEnvelope,
	dossierTree,
	groundedSystem,
} from "./dossier.js";
import {
	createDossierMidLoop,
	DOSSIER_COMPACT_THRESHOLD,
	DOSSIER_NAMED_SYSTEMS_PATH,
} from "./dossier-midloop.js";

/* ------------------------------------------------------------------------- *
 * Fixtures + a small structural walk (the dossier authors no compounds, so
 * children/options/fallback cover the whole tree).
 * ------------------------------------------------------------------------- */

const EMPTY_DRAFT: DossierDraft = {
	contact: { name: "", title: "", email: "", phone: "", company: "", website: "" },
	systems: [],
	priorities: [],
	outcomes: "",
};

const RICH_DRAFT: DossierDraft = {
	contact: {
		name: "Anna Sigurðardóttir",
		title: "CFO",
		email: "anna@example.is",
		phone: "+354 555 0000",
		company: "Verksmiðjan ehf.",
		website: "https://verksmidjan.is",
	},
	systems: [
		{
			name: "The ERP",
			vendor: "dkPlus",
			deployment: "on_premise",
			role: "source_of_record",
			criticality: "critical",
		},
		{
			name: "Project board",
			vendor: "Jira Software",
			deployment: "cloud_saas",
			role: "internal_tool",
			criticality: "secondary",
		},
	],
	priorities: [{ workflow: "The monthly close takes three days of reconciling." }],
	outcomes: "The close cut to half a day; errors stop reaching customers.",
};

function withSystems(count: number): DossierDraft {
	return {
		...RICH_DRAFT,
		systems: Array.from({ length: count }, (_, i) => ({
			name: `System ${i + 1}`,
			vendor: "",
			deployment: "",
			role: "",
			criticality: "",
		})),
	};
}

function walk(node: Node, visit: (n: Node) => void): void {
	visit(node);
	const kids: readonly Node[] =
		node.kind === "vary"
			? node.options
			: node.kind === "slot"
				? (node.fallback ?? [])
				: "children" in node && Array.isArray(node.children)
					? node.children
					: [];
	for (const k of kids) walk(k, visit);
}

function collect(node: Node, pred: (n: Node) => boolean): Node[] {
	const out: Node[] = [];
	walk(node, (n) => {
		if (pred(n)) out.push(n);
	});
	return out;
}

function findVary(node: Node, id: string): Vary | undefined {
	return collect(node, (n) => n.kind === "vary" && n.id === id)[0] as Vary | undefined;
}

function texts(node: Node): string[] {
	return collect(node, (n) => n.kind === "text").map((n) => (n as { value: string }).value);
}

/* ------------------------------------------------------------------------- */

describe("D1 — presenter purity", () => {
	it("same draft + opts produce structurally equal trees", () => {
		expect(dossierTree(RICH_DRAFT, { activeStep: "systems" })).toEqual(
			dossierTree(RICH_DRAFT, { activeStep: "systems" }),
		);
	});

	it("never mutates the draft", () => {
		const before = JSON.stringify(RICH_DRAFT);
		dossierTree(RICH_DRAFT, { receipt: "K-20260611-TEST", sealedAt: "11 June 2026" });
		expect(JSON.stringify(RICH_DRAFT)).toBe(before);
	});
});

describe("D2 — the stage Vary (open ↔ sealed)", () => {
	it("roots the record in one Vary with the open branch as default", () => {
		const tree = dossierTree(RICH_DRAFT);
		expect(tree.kind).toBe("vary");
		const stage = tree as Vary;
		expect(stage.id).toBe(DOSSIER_STAGE_ID);
		expect(stage.options).toHaveLength(2);
		expect(stage.default).toBe(DOSSIER_STAGE_CHOICES.open);
	});

	it("carries the receipt in a seal-register badge on the sealed branch only", () => {
		const tree = dossierTree(RICH_DRAFT, { receipt: "K-20260611-TEST" }) as Vary;
		const open = tree.options[DOSSIER_STAGE_CHOICES.open] as Node;
		const sealed = tree.options[DOSSIER_STAGE_CHOICES.sealed] as Node;
		const sealBadges = (n: Node) =>
			collect(n, (x) => x.kind === "badge" && x.intent === "seal").map(
				(x) => (x as { label: string }).label,
			);
		expect(sealBadges(sealed)).toContain("K-20260611-TEST");
		expect(sealBadges(open)).toHaveLength(0);
	});

	it("pairs the seal with a non-color success signal (WCAG 1.4.1)", () => {
		const tree = dossierTree(RICH_DRAFT, { receipt: "K-20260611-TEST" }) as Vary;
		const sealed = tree.options[DOSSIER_STAGE_CHOICES.sealed] as Node;
		const statuses = collect(sealed, (n) => n.kind === "status");
		expect(statuses.length).toBeGreaterThan(0);
		expect((statuses[0] as { signal: { text: string } }).signal.text.length).toBeGreaterThan(0);
	});
});

describe("D3 — the systems Vary (ledger ↔ compact)", () => {
	it("is absent until a system is named", () => {
		expect(findVary(dossierTree(EMPTY_DRAFT), DOSSIER_SYSTEMS_ID)).toBeUndefined();
		expect(findVary(dossierTree(RICH_DRAFT), DOSSIER_SYSTEMS_ID)).toBeDefined();
	});

	it("accepts the compact choice through applyDelta", () => {
		const env = dossierEnvelope(RICH_DRAFT, {}, 3);
		const out = applyDelta(env, {
			id: DOSSIER_SYSTEMS_ID,
			choice: DOSSIER_SYSTEMS_CHOICES.compact,
			epoch: 3,
		});
		expect(out.result).toBe("applied");
		expect(out.envelope.choices[DOSSIER_SYSTEMS_ID]).toBe(DOSSIER_SYSTEMS_CHOICES.compact);
	});

	it("rejects out-of-range and stale-epoch deltas totally (envelope untouched)", () => {
		const env = dossierEnvelope(RICH_DRAFT, {}, 3);
		const range = applyDelta(env, { id: DOSSIER_SYSTEMS_ID, choice: 5, epoch: 3 });
		expect(range.result).toBe("out-of-range");
		expect(range.envelope).toBe(env);
		const stale = applyDelta(env, { id: DOSSIER_SYSTEMS_ID, choice: 1, epoch: 2 });
		expect(stale.result).toBe("stale-epoch");
		expect(stale.envelope).toBe(env);
	});
});

describe("D4 — grounding against the SYSTEMS registry", () => {
	it("matches labels, ids and aliases through vendor first, then name", () => {
		expect(groundedSystem({ name: "The ERP", vendor: "dkPlus" })?.id).toBe("dkplus");
		expect(groundedSystem({ name: "", vendor: "dk" })?.id).toBe("dkplus");
		expect(groundedSystem({ name: "", vendor: "DK+" })?.id).toBe("dkplus");
		expect(groundedSystem({ name: "", vendor: "Jira Software" })?.id).toBe("jira");
		expect(groundedSystem({ name: "Business Central", vendor: "" })?.id).toBe("businesscentral");
		expect(groundedSystem({ name: "", vendor: "asana" })?.id).toBe("asana");
	});

	it("stays conservative: unknown vendors do not ground", () => {
		expect(groundedSystem({ name: "Spreadsheets", vendor: "Excel" })).toBeNull();
		expect(groundedSystem({ name: "", vendor: "" })).toBeNull();
		expect(groundedSystem({ name: "Jirafic", vendor: "" })).toBeNull();
	});

	it("renders the grounding line for recognized systems only", () => {
		const all = texts(dossierTree(RICH_DRAFT)).join("\n");
		expect(all).toContain("Sókrates already reads dkPlus");
		expect(all).toContain("Sókrates already reads Jira");
		const unknownOnly = dossierTree({
			...RICH_DRAFT,
			systems: [{ name: "Sheets", vendor: "Excel", deployment: "", role: "", criticality: "" }],
		});
		expect(texts(unknownOnly).join("\n")).not.toContain("Sókrates already reads");
	});
});

describe("D5 — the empty record invites", () => {
	it("renders the invite and no accession entries on an empty draft", () => {
		const tree = dossierTree(EMPTY_DRAFT);
		expect(texts(tree).join("\n")).toContain("assembles itself as you answer");
		expect(collect(tree, (n) => n.kind === "badge" && n.intent === "folio")).toHaveLength(1); // DRAFT only
	});
});

describe("D6 — every authored intent resolves under every shipped dialect", () => {
	const variants: ReadonlyArray<readonly [string, Node]> = [
		["empty/open", dossierTree(EMPTY_DRAFT)],
		["rich/open", dossierTree(RICH_DRAFT, { activeStep: "systems" })],
		[
			"rich/sealed",
			dossierTree(RICH_DRAFT, { receipt: "K-20260611-TEST", sealedAt: "11 June 2026" }),
		],
	];
	for (const [id, dialect] of Object.entries(DIALECTS)) {
		it(`dialect "${id}" knows every dossier intent`, () => {
			for (const [name, tree] of variants) {
				expect(unknownIntentsIn(tree, dialect.intents), `${name} under ${id}`).toEqual([]);
			}
		});
	}
});

describe("D7 — the full mid-loop circle (KRA-374)", () => {
	it("store commit → digest → propose → applyDelta → the compact branch renders", () => {
		const store = createInMemoryMorpheStore();
		commitTier1(store, DOSSIER_NAMED_SYSTEMS_PATH, "filter-edit", DOSSIER_COMPACT_THRESHOLD);
		const env = dossierEnvelope(withSystems(DOSSIER_COMPACT_THRESHOLD), {}, 7);
		const delegate = createDossierMidLoop(() => env.epoch);

		const deltas = delegate.propose(digestOf(store), liveVaryIds(env.tree));
		expect(deltas).toEqual([
			{ id: DOSSIER_SYSTEMS_ID, choice: DOSSIER_SYSTEMS_CHOICES.compact, epoch: 7 },
		]);

		let current = env;
		for (const delta of deltas) {
			const out = applyDelta(current, delta);
			expect(out.result).toBe("applied");
			current = out.envelope;
		}
		const vary = findVary(current.tree, DOSSIER_SYSTEMS_ID);
		expect(vary).toBeDefined();
		expect(resolveVaryOption(vary as Vary, current.choices)).toBe(
			(vary as Vary).options[DOSSIER_SYSTEMS_CHOICES.compact],
		);
	});

	it("proposes the ledger branch below the threshold", () => {
		const store = createInMemoryMorpheStore();
		commitTier1(store, DOSSIER_NAMED_SYSTEMS_PATH, "filter-edit", DOSSIER_COMPACT_THRESHOLD - 1);
		const env = dossierEnvelope(withSystems(DOSSIER_COMPACT_THRESHOLD - 1), {}, 1);
		const deltas = createDossierMidLoop(() => 1).propose(digestOf(store), liveVaryIds(env.tree));
		expect(deltas).toEqual([
			{ id: DOSSIER_SYSTEMS_ID, choice: DOSSIER_SYSTEMS_CHOICES.ledger, epoch: 1 },
		]);
	});

	it("proposes nothing when the systems Vary is not live", () => {
		const store = createInMemoryMorpheStore();
		commitTier1(store, DOSSIER_NAMED_SYSTEMS_PATH, "filter-edit", 5);
		const env = dossierEnvelope(EMPTY_DRAFT, {}, 1);
		expect(createDossierMidLoop(() => 1).propose(digestOf(store), liveVaryIds(env.tree))).toEqual(
			[],
		);
	});

	it("a stale-epoch proposal is rejected and the envelope reference unchanged", () => {
		const store = createInMemoryMorpheStore();
		commitTier1(store, DOSSIER_NAMED_SYSTEMS_PATH, "filter-edit", 5);
		const env = dossierEnvelope(withSystems(5), {}, 4);
		const deltas = createDossierMidLoop(() => 99).propose(digestOf(store), liveVaryIds(env.tree));
		expect(deltas).toHaveLength(1);
		const out = applyDelta(env, deltas[0] as (typeof deltas)[number]);
		expect(out.result).toBe("stale-epoch");
		expect(out.envelope).toBe(env);
	});

	it("the mirrored commit is observable in the digest's recent-event window", () => {
		const store = createInMemoryMorpheStore();
		commitTier1(store, DOSSIER_NAMED_SYSTEMS_PATH, "filter-edit", 2);
		const digest = digestOf(store);
		expect(digest.recentEvents.some((e) => e.path === DOSSIER_NAMED_SYSTEMS_PATH)).toBe(true);
		expect(digest.state[DOSSIER_NAMED_SYSTEMS_PATH]).toBe(2);
	});
});

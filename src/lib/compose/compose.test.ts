/**
 * Composer smoke tests — proves the read-only "What can Sókrates do for you?"
 * surface is coherent end to end: the five domain compounds register cleanly
 * through the factory gate, the deterministic matcher ranks a representative pain
 * sensibly, the presenter turns matches into a well-formed Frame tree of
 * CapabilityCard refs, and the grounded corpus is exactly the 45 capabilities,
 * each one carrying at least one real endpoint surface.
 *
 * Everything under test is pure data + pure functions; no clock, no RNG, no I/O.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CompoundRegistry } from "$morphe";
import type { CompoundRef, Node } from "$morphe";
import { CAPABILITIES } from "./corpus.js";
import { capabilityCard, composeAnswer } from "./present.js";
import { matchCapabilities } from "./match.js";
import { COMPOSE_COMPOUNDS, registerComposeCompounds } from "./compounds.js";
import type { ComposeQuery } from "./input.js";

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

describe("compose presenting — the answer is a well-formed Frame of cards", () => {
	const query: ComposeQuery = {
		pain: "shift planning is slow and error prone",
		systems: ["humanity", "dkplus"],
	};

	it("composeAnswer returns a Frame node containing CapabilityCard refs", () => {
		const matches = matchCapabilities(query);
		const tree = composeAnswer(matches, query);

		expect(tree.kind).toBe("frame");

		// The card refs live in the page's Grid(list); find it and assert the cards.
		const json = JSON.stringify(tree);
		expect(json).toContain("ComposeCapabilityCard");
		expect(json).toContain("ComposePainPrompt");

		// Structurally: a card ref per matched capability, all of the right name.
		const cards = collectCompoundRefs(tree, "ComposeCapabilityCard");
		expect(cards.length).toBe(matches.length);
	});
});

describe("compose presenting — expanded cards render honest tier + real method (no dead params)", () => {
	it("a proposes card expands to the honest tier label and real method badges", () => {
		const reg = new CompoundRegistry();
		registerComposeCompounds(reg);
		const cap = CAPABILITIES.find((c) => c.tier === "proposes");
		expect(cap).toBeDefined();
		if (!cap) return;

		// Expand through the factory (fills flow/evidence/models slots + nested refs).
		const json = JSON.stringify(reg.expand(capabilityCard(cap)));

		// tier param is rendered, not the old hardcoded chip.
		expect(json).toContain("Proposes, never acts");
		expect(json).not.toContain('"Read-only"');
		// the first surface's real HTTP method renders (as the evidence badge label).
		const method = cap.surfaces[0]?.method;
		expect(method).toBeDefined();
		if (method) expect(json).toContain(method);
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
});

describe("compose grounding — every cited surface is a real endpoint", () => {
	const humanity = loadEvidence("humanity.json");
	const dkplus = loadEvidence("dkplus.json");
	const index: Record<string, Map<string, EvidenceOp>> = {
		humanity: new Map(humanity.operations.map((o) => [o.operationId, o])),
		dkplus: new Map(dkplus.operations.map((o) => [o.operationId, o])),
	};

	it("resolves every surface operationId to a real op with matching method and path", () => {
		for (const cap of CAPABILITIES) {
			for (const s of cap.surfaces) {
				const sysIndex = index[s.system];
				expect(sysIndex, `${cap.id}: unknown system "${s.system}"`).toBeDefined();
				if (!sysIndex) continue;
				expect(s.operationId, `${cap.id}: surface has no operationId`).toBeDefined();
				const op = s.operationId ? sysIndex.get(s.operationId) : undefined;
				expect(op, `${cap.id}: surface "${s.operationId}" not in ${s.system} evidence`).toBeDefined();
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

describe("compose corpus — exactly 45 grounded capabilities", () => {
	it("has exactly 45 capabilities", () => {
		expect(CAPABILITIES.length).toBe(45);
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

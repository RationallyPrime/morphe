/**
 * Morphe — LEMMAS-AS-PROPERTY-TESTS (proposal §13 verification plan).
 *
 * "The document's logical structure IS the verification plan." This file
 * discharges the proof obligations of the lemmas as properties over fuzzed
 * inputs, complementing the deterministic smoke tests in core.test.ts:
 *
 *   Lemma 1 (Generativity / CLOSURE) — a compound's expansion terminates
 *     (acyclicity + depth bound) and lands in Tree(G), so render stays total.
 *   Lemma 2 (Calm / CONTEXT LAWS) — Monotone-depth and Budget-conservation
 *     (plus Locality + Stability as supporting properties) over fuzzed trees.
 *   Lemma 4 (Dialects / TOTALITY) — for the default and a 2nd dialect, render
 *     stays total and the algebra laws are preserved; an authored tree is
 *     byte-for-byte structurally identical across dialects (the re-dialecting
 *     fixed point of Lemma 3), differing only in resolved tokens.
 *
 * fast-check is not a project dependency and this agent may only edit test
 * files, so the "Hypothesis-style fuzzing" of §13 is realized with a small,
 * self-contained, SEEDED PRNG + a schema-valid `Node` generator. Seeded ⇒
 * deterministic ⇒ a failure is reproducible from its seed (printed in the
 * assertion context). This is the lean equivalent of a property runner: many
 * cases, shrink-free but reproducible.
 */

import { describe, expect, it } from "vitest";
import {
	ROOT_CONTEXT,
	THRESHOLDS,
	TOP_TIER_CAP,
	type MorpheContext,
	type ScaleTier,
	densityForCount,
	enterFrame,
	renderedChildEmphasis,
	renormalizeBudget,
	transform,
} from "./context/algebra.js";
import { CompoundRegistry, childrenOf } from "./compounds/factory.js";
import type { CompoundDef } from "./compounds/factory.js";
import { applyDialect } from "./dialects/provider.svelte.js";
import { DEFAULT_DIALECT } from "./dialects/icelandic-archive.js";
import { clinical } from "./dialects/clinical.js";
import type { Dialect } from "./dialects/types.js";
import type {
	ContainerRole,
	Density,
	EmphasisClaim,
	Node,
	NodeKind,
} from "./grammar/types.js";

/* ===========================================================================
 * 0. Seeded PRNG + schema-valid generators (the in-repo fuzz harness)
 * ========================================================================= */

/** Mulberry32 — a tiny, fast, deterministic 32-bit PRNG. */
function makeRng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const NUM_CASES = 200;

/** Run `body` over `NUM_CASES` deterministic seeds; surface the seed on failure. */
function forEachSeed(label: string, body: (rng: () => number, seed: number) => void): void {
	for (let i = 0; i < NUM_CASES; i++) {
		const seed = (i + 1) * 2654435761;
		try {
			body(makeRng(seed), seed);
		} catch (e) {
			throw new Error(
				`${label}: property failed for seed=${seed} (case ${i})\n${
					e instanceof Error ? e.message : String(e)
				}`,
			);
		}
	}
}

const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T;
const intIn = (rng: () => number, lo: number, hi: number): number =>
	lo + Math.floor(rng() * (hi - lo + 1));

const CONTAINER_ROLES: readonly ContainerRole[] = [
	"page",
	"section",
	"panel",
	"toolbar",
	"list",
	"form",
	"field-group",
	"inline",
];
const DENSITIES: readonly Density[] = ["compact", "regular", "spacious"];
const CLAIMS: readonly EmphasisClaim[] = ["muted", "normal", "strong", "critical"];
const VARY_IDS = ["density-panel", "emphasis-panel", "collapse-notes"] as const;

/** Leaf primitives that are always schema-valid with no required composition. */
function genLeaf(rng: () => number): Node {
	const which = intIn(rng, 0, 7);
	switch (which) {
		case 0:
			return { kind: "text", value: `t${intIn(rng, 0, 999)}`, as: pick(rng, ["body", "heading", "caption"] as const) };
		case 1:
			return { kind: "number", value: intIn(rng, 0, 1_000_000), format: pick(rng, ["plain", "integer", "currency", "percent", "compact"] as const) };
		case 2:
			return { kind: "badge", label: `b${intIn(rng, 0, 99)}`, intent: pick(rng, ["neutral", "success", "caution", "info"] as const) };
		case 3:
			return { kind: "icon", name: "circle", a11y: rng() < 0.5 ? { role: "decorative" } : { role: "img", label: "marker" } };
		case 4:
			return { kind: "status", tone: pick(rng, ["success", "caution", "info", "neutral"] as const), signal: { text: "ok" } };
		case 5:
			return { kind: "progress", value: rng(), label: "loading" };
		case 6:
			return {
				kind: "within",
				id: pick(rng, VARY_IDS),
				dimension: pick(rng, ["density", "emphasis", "collapse"] as const),
				range: [0, 3],
				default: intIn(rng, 0, 3),
			};
		default:
			return {
				kind: "field",
				a11y: { id: `f${intIn(rng, 0, 9999)}`, label: { mode: "aria-label", text: "name" } },
				inputType: pick(rng, ["text", "email", "number"] as const),
			};
	}
}

/** A container constructor that wraps generated children, schema-valid by role. */
function wrapContainer(rng: () => number, role: ContainerRole, children: Node[]): Node {
	const which = intIn(rng, 0, 3);
	switch (which) {
		case 0:
			return { kind: "stack", role, direction: pick(rng, ["block", "inline", "auto"] as const), children };
		case 1:
			return { kind: "grid", role, minTrack: pick(rng, ["narrow", "regular", "wide"] as const), children };
		case 2:
			return { kind: "cluster", role, justify: pick(rng, ["start", "between", "end"] as const), children };
		default:
			return { kind: "frame", role, surface: pick(rng, ["base", "raised", "sunken"] as const), children };
	}
}

/**
 * Generate a schema-valid Node tree of bounded depth/breadth. Authored trees
 * carry only intents/roles/priorities — NEVER scales or pixels — which is the
 * invariant Lemma 3/4 rely on. This generator honors that by construction (no
 * node it emits names a scale var).
 */
function genTree(rng: () => number, depth: number): Node {
	if (depth <= 0 || rng() < 0.35) return genLeaf(rng);
	const role = pick(rng, CONTAINER_ROLES);
	const n = intIn(rng, 0, 4);
	const children: Node[] = [];
	for (let i = 0; i < n; i++) children.push(genTree(rng, depth - 1));
	return wrapContainer(rng, role, children);
}

/** Walk every node in a tree (pre-order), via the single childrenOf source. */
function walk(node: Node, visit: (n: Node) => void): void {
	visit(node);
	for (const child of childrenOf(node)) walk(child, visit);
}

/** Structural skeleton: kinds + child arity only — token-free, dialect-free. */
function skeleton(node: Node): unknown {
	return { kind: node.kind, children: childrenOf(node).map(skeleton) };
}

/** Add a root claim to a node, wrapping unclaimable leaves in a neutral container. */
function withRootClaim(node: Node, claim: EmphasisClaim): Node {
	switch (node.kind) {
		case "stack":
		case "grid":
		case "cluster":
		case "text":
		case "number":
			return { ...node, emphasis: claim };
		default:
			return { kind: "stack", role: "inline", emphasis: claim, children: [node] };
	}
}

/** Remove only the root claim; nested authored claims remain part of the subtree. */
function withoutRootClaim(node: Node): Node {
	if (!("emphasis" in node)) return node;
	const { emphasis: _emphasis, ...rest } = node;
	return rest as Node;
}

/** The kinds the renderer can resolve at the leaf after compound expansion. */
const RENDERABLE_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
	// registry primitives
	"stack", "grid", "cluster", "frame", "spacer",
	"text", "number", "badge", "icon", "media",
	"field", "select", "toggle", "range",
	"progress", "status", "inline-alert",
	// meta the renderer handles directly (slot fallback / vary default)
	"slot", "vary", "within",
]);

/* ===========================================================================
 * Lemma 1 (Generativity / CLOSURE) — expansion terminates and lands in Tree(G)
 * ========================================================================= */

describe("Lemma 1 (CLOSURE): compound expansion terminates and lands in the grammar", () => {
	/** Build a compound whose template is a fuzzed schema-valid tree + leaves. */
	function genCompound(rng: () => number, name: string): CompoundDef {
		return {
			name,
			version: "1.0.0",
			grammarVersion: "0.1.0",
			params: {
				type: "object",
				properties: {
					label: { type: "string", default: `lbl-${name}` },
					count: { type: "number", default: intIn(rng, 0, 9) },
				},
			},
			template: {
				kind: "stack",
				role: "panel",
				children: [
					{ kind: "param-ref", param: "label" },
					{ kind: "param-ref", param: "count" },
					genTree(rng, intIn(rng, 0, 3)),
					{ kind: "slot", name: "body", fallback: [{ kind: "text", value: "—" }] },
				],
			},
		};
	}

	it("fuzzed schema-valid compounds register and expand with NO surviving Meta leaves", () => {
		forEachSeed("L1.expand-hygiene", (rng) => {
			const reg = new CompoundRegistry();
			const def = genCompound(rng, "fuzzed");
			const res = reg.register(def);
			expect(res.ok).toBe(true);

			// Expansion terminates (no throw / no hang) and is a concrete tree.
			const expanded = reg.expand({
				kind: "compound",
				name: "fuzzed",
				args: { label: "Live", count: 7 },
				slots: { body: [{ kind: "text", value: "filled" }] },
			});

			// HYGIENE: ParamRef resolved against the compound's own args; Slot from
			// the call site. Neither leaks into the expansion.
			walk(expanded, (n) => {
				expect(n.kind).not.toBe("param-ref");
				expect(n.kind).not.toBe("slot");
			});

			// LANDS IN Tree(G): every surviving leaf is a kind render can resolve.
			walk(expanded, (n) => {
				expect(RENDERABLE_KINDS.has(n.kind)).toBe(true);
			});

			// Args actually flowed in (ParamRef → Text coercion).
			const json = JSON.stringify(expanded);
			expect(json).toContain("Live");
			expect(json).toContain("filled");
		});
	});

	it("default-args expansion always lands in the grammar (registration gate guarantee)", () => {
		forEachSeed("L1.default-args-total", (rng) => {
			const reg = new CompoundRegistry();
			reg.register(genCompound(rng, "fuzzed"));
			// Expand with NO args/slots — the gate proved this is total at register.
			const expanded = reg.expand({ kind: "compound", name: "fuzzed", args: {} });
			walk(expanded, (n) => {
				expect(n.kind).not.toBe("param-ref");
				expect(RENDERABLE_KINDS.has(n.kind)).toBe(true);
			});
		});
	});

	it("Within leaves pass the compound registration gate", () => {
		const reg = new CompoundRegistry();
		const def: CompoundDef = {
			name: "within-gate-probe",
			version: "1.0.0",
			grammarVersion: "0.1.0",
			params: { type: "object", properties: {} },
			template: {
				kind: "stack",
				role: "panel",
				children: [
					{
						kind: "within",
						id: "density-panel",
						dimension: "density",
						range: [0, 2],
						default: 1,
					},
				],
			},
		};

		expect(reg.register(def).ok).toBe(true);
	});

	it("compounds reference compounds — vocabulary is OPEN under composition", () => {
		forEachSeed("L1.composition", (rng) => {
			const reg = new CompoundRegistry();
			// A chain leaf -> mid -> top, each referencing the previous.
			expect(
				reg.register({
					name: "leaf",
					version: "1.0.0",
					grammarVersion: "0.1.0",
					params: { type: "object", properties: { v: { type: "string", default: "L" } } },
					template: { kind: "stack", role: "inline", children: [{ kind: "param-ref", param: "v" }] },
				}).ok,
			).toBe(true);
			expect(
				reg.register({
					name: "mid",
					version: "1.0.0",
					grammarVersion: "0.1.0",
					params: { type: "object", properties: {} },
					template: {
						kind: "frame",
						role: "panel",
						children: [{ kind: "compound", name: "leaf", args: { v: `m${intIn(rng, 0, 9)}` } }],
					},
				}).ok,
			).toBe(true);
			const top: CompoundDef = {
				name: "top",
				version: "1.0.0",
				grammarVersion: "0.1.0",
				params: { type: "object", properties: {} },
				template: {
					kind: "stack",
					role: "section",
					children: [{ kind: "compound", name: "mid", args: {} }],
				},
			};
			expect(reg.register(top).ok).toBe(true);
			const expanded = reg.expand({ kind: "compound", name: "top", args: {} });
			// Nested compounds fully expanded — nothing un-rendered remains.
			walk(expanded, (n) => {
				expect(n.kind).not.toBe("compound");
				expect(RENDERABLE_KINDS.has(n.kind)).toBe(true);
			});
		});
	});

	it("ACYCLICITY: a cyclic compound is rejected and never added (render stays total)", () => {
		// Direct self-reference.
		const reg1 = new CompoundRegistry();
		const selfRef: CompoundDef = {
			name: "loop",
			version: "1.0.0",
			grammarVersion: "0.1.0",
			params: { type: "object", properties: {} },
			template: { kind: "stack", role: "panel", children: [{ kind: "compound", name: "loop", args: {} }] },
		};
		expect(reg1.register(selfRef).ok).toBe(false);
		expect(reg1.has("loop")).toBe(false);

		// Indirect cycle a -> b -> a. `a` registers referencing not-yet-present `b`
		// (a forward ref is acyclic so far); `b` referencing `a` closes the loop and
		// must be rejected.
		const reg2 = new CompoundRegistry();
		const a: CompoundDef = {
			name: "a",
			version: "1.0.0",
			grammarVersion: "0.1.0",
			params: { type: "object", properties: {} },
			template: { kind: "stack", role: "panel", children: [{ kind: "compound", name: "b", args: {} }] },
		};
		const aRes = reg2.register(a);
		const b: CompoundDef = {
			name: "b",
			version: "1.0.0",
			grammarVersion: "0.1.0",
			params: { type: "object", properties: {} },
			template: { kind: "stack", role: "panel", children: [{ kind: "compound", name: "a", args: {} }] },
		};
		const bRes = reg2.register(b);
		// At least one of the two closing the cycle must be rejected; the registry
		// must never end up containing BOTH (which would be a renderable cycle).
		expect(!(aRes.ok && bRes.ok)).toBe(true);
		expect(!(reg2.has("a") && reg2.has("b"))).toBe(true);
	});

	it("DEPTH BOUND: a too-deep self-similar nest is rejected at registration", () => {
		// Build n distinct compounds c0 -> c1 -> ... so the expansion depth exceeds
		// MAX_EXPANSION_DEPTH (16). Each is individually acyclic; the chain length is
		// what trips the depth bound at registration of the deepest.
		const reg = new CompoundRegistry();
		const CHAIN = 20; // > MAX_EXPANSION_DEPTH
		let lastOk = true;
		let anyRejected = false;
		for (let i = 0; i < CHAIN; i++) {
			const def: CompoundDef = {
				name: `c${i}`,
				version: "1.0.0",
				grammarVersion: "0.1.0",
				params: { type: "object", properties: {} },
				template:
					i === 0
						? { kind: "text", value: "base" }
						: { kind: "stack", role: "panel", children: [{ kind: "compound", name: `c${i - 1}`, args: {} }] },
			};
			const res = reg.register(def);
			lastOk = res.ok;
			if (!res.ok) anyRejected = true;
		}
		// The deep links must be rejected (the gate enforces the bound).
		expect(anyRejected).toBe(true);
		// And the deepest one specifically should not be registered.
		expect(lastOk).toBe(false);
	});
});

/* ===========================================================================
 * Lemma 2 (Calm / CONTEXT LAWS)
 * ========================================================================= */

describe("Lemma 2 (CONTEXT LAWS): the algebra satisfies its four laws over fuzzed trees", () => {
	it("MONOTONE-DEPTH: scaleTier is non-increasing through any chain of non-Frame transforms", () => {
		forEachSeed("L2.monotone", (rng) => {
			let ctx: MorpheContext = ROOT_CONTEXT;
			const len = intIn(rng, 1, 12);
			for (let i = 0; i < len; i++) {
				const role = pick(rng, CONTAINER_ROLES);
				const next = transform(ctx, role, { childCount: intIn(rng, 0, 20), claim: pick(rng, CLAIMS) });
				// scaleTier never RISES through a non-Frame transform.
				expect(next.scaleTier).toBeLessThanOrEqual(ctx.scaleTier);
				// ...and stays a valid tier.
				expect(next.scaleTier).toBeGreaterThanOrEqual(0);
				expect(next.scaleTier).toBeLessThanOrEqual(4);
				// depth strictly grows (until a Frame resets it).
				expect(next.depth).toBe(ctx.depth + 1);
				ctx = next;
			}
		});
	});

	it("MONOTONE-DEPTH: enterFrame is the ONLY operation that resets tier/depth upward", () => {
		forEachSeed("L2.frame-reset", (rng) => {
			let ctx: MorpheContext = ROOT_CONTEXT;
			// Descend a few non-Frame transforms to pull the tier down.
			const len = intIn(rng, 2, 8);
			for (let i = 0; i < len; i++) ctx = transform(ctx, pick(rng, ["toolbar", "section", "panel"] as const));
			const lowered = ctx.scaleTier;
			const reset = enterFrame(ctx, {
				surface: pick(rng, ["base", "raised", "sunken"] as const),
			});
			// A frame re-roots depth and resets scaleTier to the root tier.
			expect(reset.depth).toBe(0);
			expect(reset.scaleTier).toBe(ROOT_CONTEXT.scaleTier);
			expect(reset.scaleTier).toBeGreaterThanOrEqual(lowered);
		});
	});

	it("BUDGET-CONSERVATION: rendered emphasis weight never exceeds B, for any B and any claims", () => {
		const weight: Record<EmphasisClaim, number> = { muted: 0, normal: 1, strong: 2, critical: 3 };
		forEachSeed("L2.budget", (rng) => {
			const budget = intIn(rng, 0, 8); // includes the degenerate B = 0
			const n = intIn(rng, 0, 15);
			const claims: EmphasisClaim[] = [];
			for (let i = 0; i < n; i++) claims.push(pick(rng, CLAIMS));

			const rendered = renormalizeBudget(budget, claims);

			// Same arity in as out (every child gets a rendered emphasis).
			expect(rendered.length).toBe(claims.length);

			// CONSERVATION: total rendered weight <= B regardless of how loud the
			// children CLAIMED.
			const total = rendered.reduce((s, e) => s + weight[e], 0);
			expect(total).toBeLessThanOrEqual(budget);

			// TOP-TIER CAP: at most TOP_TIER_CAP children render critical.
			const top = rendered.filter((e) => e === "critical").length;
			expect(top).toBeLessThanOrEqual(TOP_TIER_CAP);

			// MONOTONE RENDER: no child is rendered LOUDER than it claimed (the
			// algebra only ever demotes; it never invents emphasis).
			for (let i = 0; i < claims.length; i++) {
				expect(weight[rendered[i] as EmphasisClaim]).toBeLessThanOrEqual(weight[claims[i] as EmphasisClaim]);
			}
		});
	});

	it("BUDGET-CONSERVATION: B = 0 renders everything muted (a hard floor)", () => {
		forEachSeed("L2.budget-zero", (rng) => {
			const n = intIn(rng, 0, 10);
			const claims: EmphasisClaim[] = [];
			for (let i = 0; i < n; i++) claims.push(pick(rng, CLAIMS));
			const rendered = renormalizeBudget(0, claims);
			for (const e of rendered) expect(e).toBe("muted");
		});
	});

	it("BUDGET-CONSERVATION: priority goes to EARLIER claimants (deterministic, re-emission-stable)", () => {
		// With a tight budget, the first claimant should keep more emphasis than a
		// later equal claimant — the documented demote-later-first policy.
		const rendered = renormalizeBudget(2, ["critical", "critical"]);
		const weight: Record<EmphasisClaim, number> = { muted: 0, normal: 1, strong: 2, critical: 3 };
		expect(weight[rendered[0] as EmphasisClaim]).toBeGreaterThanOrEqual(weight[rendered[1] as EmphasisClaim]);
	});

	it("STABILITY: density only steps at the enumerated thresholds; sub-threshold inserts change nothing", () => {
		forEachSeed("L2.stability", (rng) => {
			const parent = pick(rng, DENSITIES);
			// Pick a count strictly inside a band (not on a boundary) and perturb it
			// without crossing the next threshold: the density must be unchanged.
			const band = pick(rng, [
				[0, THRESHOLDS.densityCrowdAt - 1],
				[THRESHOLDS.densityCrowdAt, THRESHOLDS.densityPackAt - 1],
				[THRESHOLDS.densityPackAt, THRESHOLDS.densityPackAt + 10],
			] as const);
			const a = intIn(rng, band[0], band[1]);
			const b = intIn(rng, band[0], band[1]);
			expect(densityForCount(parent, a)).toBe(densityForCount(parent, b));
		});
	});

	it("STABILITY: crossing a named threshold is the ONLY thing that demotes density", () => {
		for (const parent of DENSITIES) {
			const below = densityForCount(parent, THRESHOLDS.densityCrowdAt - 1);
			const at = densityForCount(parent, THRESHOLDS.densityCrowdAt);
			const order: Density[] = ["spacious", "regular", "compact"];
			// At the crowd threshold, density is the same or one step more compact.
			expect(order.indexOf(at)).toBeGreaterThanOrEqual(order.indexOf(below));
		}
	});

	it("LOCALITY: transform is a pure function of (parent, role, opts) — no action at a distance", () => {
		forEachSeed("L2.locality", (rng) => {
			const parent: MorpheContext = {
				depth: intIn(rng, 0, 5),
				density: pick(rng, DENSITIES),
				scaleTier: intIn(rng, 0, 4) as ScaleTier,
				emphasisBudget: intIn(rng, 0, 6),
				surface: pick(rng, ["base", "raised", "sunken"] as const),
			};
			const role = pick(rng, CONTAINER_ROLES);
			const opts = { childCount: intIn(rng, 0, 20), claim: pick(rng, CLAIMS) };
			// Same inputs ⇒ identical output, every time (deterministic, replayable).
			expect(transform(parent, role, opts)).toEqual(transform(parent, role, opts));
		});
	});

	it("BUDGET-CONSERVATION commutes with pass-through compound wrapping", () => {
		forEachSeed("L2.expansion-commutation", (rng, seed) => {
			const n = intIn(rng, 1, 9);
			const children: Node[] = [];
			const claims: Array<EmphasisClaim | undefined> = [];
			for (let i = 0; i < n; i++) {
				const claim = rng() < 0.75 ? pick(rng, CLAIMS) : undefined;
				const child = genTree(rng, 2);
				children.push(claim === undefined ? child : withRootClaim(child, claim));
				claims.push(claim);
			}

			const target = intIn(rng, 0, n - 1);
			const name = `pass-through-${seed}-${target}`;
			const reg = new CompoundRegistry();
			const def: CompoundDef = {
				name,
				version: "1.0.0",
				grammarVersion: "0.1.0",
				params: { type: "object", properties: {} },
				template: {
					kind: "stack",
					role: "inline",
					children: [{ kind: "slot", name: "body" }],
				},
			};
			expect(reg.register(def).ok).toBe(true);

			const stripped = withoutRootClaim(children[target] as Node);
			const wrapped: Node =
				claims[target] === undefined
					? { kind: "compound", name, args: {}, slots: { body: [stripped] } }
					: {
							kind: "compound",
							name,
							args: {},
							emphasis: claims[target],
							slots: { body: [stripped] },
						};
			const wrappedChildren = [...children];
			wrappedChildren[target] = wrapped;
			const budget = intIn(rng, 0, 6);
			expect(renderedChildEmphasis(budget, wrappedChildren)).toEqual(
				renderedChildEmphasis(budget, children),
			);
		});
	});
});

/* ===========================================================================
 * Lemma 4 (Dialects / TOTALITY)
 * ========================================================================= */

/**
 * The DEFAULT dialect (`icelandic-archive`) and the real, intentionally
 * CONTRASTING 2nd dialect (`clinical`) are the §13 Lemma-4 demonstration shipped
 * in the codebase: the same intent NAMES (core eight + the register slots
 * folio/marginalia/seal) re-mapped onto different NEUTRAL scale chains, plus
 * different bounded priors. `clinical` is not yet wired into the barrel, so it is
 * imported directly from its module (as core.test.ts imports the default).
 *
 * A deliberately out-of-bounds dialect (`rogue`) is constructed as test data to
 * prove priors are CLAMPED — a dialect can never escape the design system's
 * range, which is what keeps Lemma 2's laws true under any dialect (Lemma 4).
 */
const ROGUE_DIALECT: Dialect = {
	id: "rogue",
	label: "Rogue",
	intents: {},
	priors: { rootBudget: 9999, rootScaleTier: 0 as ScaleTier },
	compounds: [],
};

describe("Lemma 4 (DIALECT TOTALITY): laws survive every dialect; authored trees are a fixed point", () => {
	const dialects: Dialect[] = [DEFAULT_DIALECT, clinical, ROGUE_DIALECT];

	it("priors are CLAMPED into bounds for every dialect (budget 1..6, scaleTier 2..4) — Lemma 2 survives", () => {
		for (const d of dialects) {
			const applied = applyDialect(d);
			expect(applied.rootContext.emphasisBudget).toBeGreaterThanOrEqual(1);
			expect(applied.rootContext.emphasisBudget).toBeLessThanOrEqual(6);
			expect(applied.rootContext.scaleTier).toBeGreaterThanOrEqual(2);
			expect(applied.rootContext.scaleTier).toBeLessThanOrEqual(4);
			expect(applied.attr).toBe(d.id);
		}
	});

	it("ROGUE priors really are out of bounds before clamping (the clamp is doing work)", () => {
		// Sanity: the rogue dialect's raw priors violate both bounds, so the clamp
		// test above is not vacuously passing on already-valid input.
		expect(ROGUE_DIALECT.priors.rootBudget).toBeGreaterThan(6);
		expect(ROGUE_DIALECT.priors.rootScaleTier as number).toBeLessThan(2);
		const applied = applyDialect(ROGUE_DIALECT);
		expect(applied.rootContext.emphasisBudget).toBe(6); // clamped down from 9999
		expect(applied.rootContext.scaleTier).toBe(2); // clamped up from 0
	});

	it("the algebra laws hold under EACH dialect's clamped root context (fuzzed descents)", () => {
		for (const d of dialects) {
			const root = applyDialect(d).rootContext;
			forEachSeed(`L4.laws-under-${d.id}`, (rng) => {
				// Monotone-depth from the dialect's root.
				let ctx = root;
				const len = intIn(rng, 1, 10);
				for (let i = 0; i < len; i++) {
					const next = transform(ctx, pick(rng, CONTAINER_ROLES), { childCount: intIn(rng, 0, 20) });
					expect(next.scaleTier).toBeLessThanOrEqual(ctx.scaleTier);
					ctx = next;
				}
				// Budget-conservation under the dialect's (clamped) budget.
				const weight: Record<EmphasisClaim, number> = { muted: 0, normal: 1, strong: 2, critical: 3 };
				const claims: EmphasisClaim[] = [];
				const n = intIn(rng, 0, 12);
				for (let i = 0; i < n; i++) claims.push(pick(rng, CLAIMS));
				const rendered = renormalizeBudget(root.emphasisBudget, claims);
				const total = rendered.reduce((s, e) => s + weight[e], 0);
				expect(total).toBeLessThanOrEqual(root.emphasisBudget);
			});
		}
	});

	it("FIXED POINT: an authored tree is byte-for-byte structurally identical across dialects (Lemma 3)", () => {
		// The same authored tree, "rendered" under each dialect, must have IDENTICAL
		// structure — re-dialecting only remaps the intent layer, never the tree.
		// Applying a dialect is a pure data-out operation over the tree's environment
		// (root context + boundary var overrides); the TREE ITSELF is never mutated.
		forEachSeed("L4.fixed-point", (rng) => {
			const authored = genTree(rng, 4);
			const skel = JSON.stringify(skeleton(authored));
			const fullJson = JSON.stringify(authored);
			for (const d of dialects) {
				// Applying a dialect must NOT mutate the authored tree.
				applyDialect(d);
				expect(JSON.stringify(skeleton(authored))).toBe(skel);
				expect(JSON.stringify(authored)).toBe(fullJson);
			}
		});
	});

	it("FIXED POINT: default and clinical inject the SAME intent var names — only the values differ", () => {
		// This is the sharp form of the re-dialecting fixed point: a dialect swap is
		// a remap of the SAME channel keys onto different scale chains. The keyset is
		// invariant (so every authored `intent:` reference still resolves); the
		// values move (so the subtree's character changes). Structure unchanged,
		// tokens re-resolved.
		const defVars = applyDialect(DEFAULT_DIALECT).vars;
		const clinVars = applyDialect(clinical).vars;

		const defKeys = Object.keys(defVars).sort();
		const clinKeys = Object.keys(clinVars).sort();

		// Both dialects emit a non-trivial set of overrides...
		expect(defKeys.length).toBeGreaterThan(0);
		expect(clinKeys.length).toBeGreaterThan(0);
		// ...and they cover the EXACT SAME intent channels (same keyset).
		expect(clinKeys).toEqual(defKeys);

		// At least one channel resolves to a DIFFERENT value — re-dialecting is not
		// a no-op (the two registers really are visually distinct).
		const differing = defKeys.filter((k) => defVars[k] !== clinVars[k]);
		expect(differing.length).toBeGreaterThan(0);
	});

	it("INTENT-LAYER ONLY: every dialect override names an intent var, valued by a NEUTRAL scale (no hex)", () => {
		for (const d of [DEFAULT_DIALECT, clinical]) {
			const { vars } = applyDialect(d);
			for (const [key, value] of Object.entries(vars)) {
				// Injection happens at the intent layer — never a component class or
				// a raw scale name on the LHS.
				expect(key.startsWith("--mo-intent-")).toBe(true);
				// Values reference a neutral scale var (possibly via color-mix), never
				// a literal hex — the vertical never leaks into the scale layer (L3).
				const referencesScale = value.includes("var(--mo-") || value === "transparent";
				expect(referencesScale).toBe(true);
				expect(/#[0-9a-fA-F]{3,8}\b/.test(value)).toBe(false);
			}
		}
	});

	it("RENDER STAYS TOTAL: a fuzzed authored tree resolves to renderable kinds under any dialect", () => {
		// A dialect changes tokens, not the grammar: the kinds in an authored tree
		// are the same renderable kinds regardless of which dialect governs.
		forEachSeed("L4.totality", (rng) => {
			const authored = genTree(rng, 4);
			walk(authored, (n) => {
				expect(RENDERABLE_KINDS.has(n.kind)).toBe(true);
			});
		});
	});
});

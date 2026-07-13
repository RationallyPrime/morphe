/**
 * Core machinery smoke tests — proves the keystone is coherent, not just typed.
 * These are the seeds of the Lemma-as-property-test discipline (§12 of the
 * proposal); downstream agents extend them with Hypothesis-style fuzzing.
 */

import { describe, expect, it } from "vitest";
import type { CompoundDef } from "./compounds/factory.js";
import {
	CompoundReferenceError,
	CompoundRegistry,
	restrictCompounds,
} from "./compounds/factory.js";
import {
	densityForCount,
	emphasisToStrokeStep,
	enterFrame,
	explicitClaim,
	ROOT_CONTEXT,
	renderedChildEmphasis,
	renormalizeBudget,
	THRESHOLDS,
	TOP_TIER_CAP,
	transform,
} from "./context/algebra.js";
import type { Node } from "./grammar/types.js";
import { GRAMMAR_VERSION } from "./grammar/version.js";

describe("context algebra — the four laws", () => {
	it("MONOTONE-DEPTH: scaleTier is non-increasing through non-Frame transforms", () => {
		let ctx = ROOT_CONTEXT;
		const seen = [ctx.scaleTier];
		for (const role of ["section", "panel", "list", "field-group"] as const) {
			ctx = transform(ctx, role, { childCount: 2 });
			seen.push(ctx.scaleTier);
		}
		for (let i = 1; i < seen.length; i++) {
			expect(seen[i]).toBeLessThanOrEqual(seen[i - 1] as number);
		}
	});

	it("MONOTONE-DEPTH: a Frame is the only thing that may reset scaleTier upward", () => {
		const deep = transform(transform(ROOT_CONTEXT, "toolbar"), "toolbar");
		expect(deep.scaleTier).toBeLessThan(ROOT_CONTEXT.scaleTier);
		const reset = enterFrame(deep);
		expect(reset.scaleTier).toBe(ROOT_CONTEXT.scaleTier);
		expect(reset.depth).toBe(0);
	});

	it("STABILITY: density only steps at the enumerated thresholds", () => {
		expect(densityForCount("regular", THRESHOLDS.densityCrowdAt - 1)).toBe("regular");
		expect(densityForCount("regular", THRESHOLDS.densityCrowdAt)).toBe("compact");
		// Below a threshold, adding a sibling does not change the tier.
		expect(densityForCount("spacious", 3)).toBe(densityForCount("spacious", 4));
	});

	it("BUDGET-CONSERVATION: rendered emphasis weight never exceeds B", () => {
		const weight = { muted: 0, normal: 1, strong: 2, critical: 3 } as const;
		const rendered = renormalizeBudget(3, ["critical", "critical", "critical", "strong"]);
		const total = rendered.reduce((s, e) => s + weight[e], 0);
		expect(total).toBeLessThanOrEqual(3);
	});

	it("BUDGET-CONSERVATION: at most TOP_TIER_CAP children render at top tier", () => {
		const rendered = renormalizeBudget(10, ["critical", "critical", "critical"]);
		const top = rendered.filter((e) => e === "critical").length;
		expect(top).toBeLessThanOrEqual(TOP_TIER_CAP);
	});

	it("LOCALITY: transform depends only on (parent, role, opts) — deterministic", () => {
		const a = transform(ROOT_CONTEXT, "panel", { childCount: 3 });
		const b = transform(ROOT_CONTEXT, "panel", { childCount: 3 });
		expect(a).toEqual(b);
	});
});

describe("emphasis subalgebra — renormalization is WIRED to the children (Budget-conservation)", () => {
	// Authored claims live on nodes; the PARENT renormalizes the whole sibling set
	// against B and grants each child its rendered emphasis (the law, applied where
	// the full set + budget are both known). These helpers are that wiring, made
	// pure so the wiring itself is testable without the Svelte runtime.
	const unmarked: Node = { kind: "stack", role: "list", children: [] };
	const leaf: Node = { kind: "text", value: "x", as: "body" };
	const strong: Node = { kind: "stack", role: "list", emphasis: "strong", children: [] };
	const critical: Node = { kind: "stack", role: "list", emphasis: "critical", children: [] };

	it("explicitClaim: an unmarked node has NO claim (it renders the free normal baseline)", () => {
		// Absent is NOT "muted": muted is a quiet STYLE, and defaulting plain content
		// to it would drop body text under the contrast floor. Only an `emphasis`
		// field is a claim that competes for budget.
		expect(explicitClaim(unmarked)).toBeUndefined();
		expect(explicitClaim(leaf)).toBeUndefined();
		expect(explicitClaim(strong)).toBe("strong");
		expect(explicitClaim(critical)).toBe("critical");
	});

	it("explicitClaim: Vary claims through its clamped default option", () => {
		const vary: Node = {
			kind: "vary",
			id: "default-claim",
			default: 999,
			options: [
				{ kind: "text", value: "plain" },
				{ kind: "text", value: "loud", emphasis: "strong" },
			],
		};
		expect(explicitClaim(vary)).toBe("strong");
		expect(renderedChildEmphasis(2, [unmarked, vary])).toEqual(["normal", "strong"]);
	});

	it("renderedChildEmphasis: unmarked siblings stay the normal baseline and don't compete for budget", () => {
		// The strong claim is the only competitor for B=2, so it renders strong; the
		// flanking unmarked siblings render the normal baseline for free (NOT muted —
		// they must never be quieted below the contrast floor).
		expect(renderedChildEmphasis(2, [unmarked, strong, unmarked])).toEqual([
			"normal",
			"strong",
			"normal",
		]);
	});

	it("renderedChildEmphasis: a plain list of unmarked children all render the normal baseline", () => {
		expect(renderedChildEmphasis(1, [unmarked, unmarked, unmarked, leaf])).toEqual([
			"normal",
			"normal",
			"normal",
			"normal",
		]);
	});

	it("renderedChildEmphasis: explicit over-claim is capped by the law (it reaches real nodes)", () => {
		// Three critical claims under B=3: the law caps top-tier to TOP_TIER_CAP and
		// keeps total weight <= B — proving renormalizeBudget is actually on the path.
		const rendered = renderedChildEmphasis(3, [critical, critical, critical]);
		expect(rendered.filter((e) => e === "critical").length).toBeLessThanOrEqual(TOP_TIER_CAP);
		const weight = { muted: 0, normal: 1, strong: 2, critical: 3 } as const;
		expect(rendered.reduce((s, e) => s + weight[e], 0)).toBeLessThanOrEqual(3);
	});

	it("emphasisToStrokeStep: stroke is a loudness channel — louder emphasis, heavier edge", () => {
		// muted/normal resolve to the hairline ramp step; strong/critical to the
		// emphasis step. Both are SCALE steps (the orbit value), never a raw px.
		expect(emphasisToStrokeStep("muted")).toBe("var(--mo-border-width)");
		expect(emphasisToStrokeStep("normal")).toBe("var(--mo-border-width)");
		expect(emphasisToStrokeStep("strong")).toBe("var(--mo-border-width-strong)");
		expect(emphasisToStrokeStep("critical")).toBe("var(--mo-border-width-strong)");
	});
});

describe("compound factory — algebraic closure (Lemma 1)", () => {
	const labeledStat: CompoundDef = {
		name: "labeled-stat",
		version: "1.0.0",
		grammarVersion: GRAMMAR_VERSION,
		params: {
			type: "object",
			properties: {
				label: { type: "string", default: "Untitled" },
				value: { type: "number", default: 0 },
			},
		},
		template: {
			kind: "stack",
			role: "panel",
			children: [
				{ kind: "text", value: "", as: "caption" }, // overwritten via param below
				{ kind: "param-ref", param: "label" },
				{ kind: "param-ref", param: "value" },
				{ kind: "slot", name: "footer" },
			],
		},
	};

	it("registers a valid compound through the gate", () => {
		const reg = new CompoundRegistry();
		const result = reg.register(labeledStat);
		expect(result.ok).toBe(true);
		expect(reg.has("labeled-stat")).toBe(true);
	});

	it("rejects a compound stamped for a different grammar version", () => {
		const reg = new CompoundRegistry();
		const result = reg.register({ ...labeledStat, name: "stale-stat", grammarVersion: "9.0.0" });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected registration to fail");
		expect(result.errors).toContain(
			`Compound "stale-stat" targets grammar 9.0.0; runtime grammar is ${GRAMMAR_VERSION}.`,
		);
		expect(reg.has("stale-stat")).toBe(false);
	});

	it("expands hygienically: ParamRefs resolve, Slots fill from the call site", () => {
		const reg = new CompoundRegistry();
		reg.register(labeledStat);
		const expanded = reg.expand({
			kind: "compound",
			name: "labeled-stat",
			args: { label: "Revenue", value: 42 },
			slots: { footer: [{ kind: "text", value: "YTD", as: "caption" }] },
		});
		const json = JSON.stringify(expanded);
		expect(json).toContain("Revenue");
		expect(json).toContain("42");
		expect(json).toContain("YTD");
		// No ParamRef or Slot leaves should survive.
		expect(json).not.toContain("param-ref");
		expect(json).not.toContain('"kind":"slot"');
	});

	it("rejects a cyclic compound at registration (acyclicity)", () => {
		const reg = new CompoundRegistry();
		const selfRef: CompoundDef = {
			name: "loop",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: { type: "object", properties: {} },
			template: {
				kind: "stack",
				role: "panel",
				children: [{ kind: "compound", name: "loop", args: {} }],
			},
		};
		const result = reg.register(selfRef);
		expect(result.ok).toBe(false);
		expect(reg.has("loop")).toBe(false);
	});

	it("rejects a template whose root claims emphasis", () => {
		const reg = new CompoundRegistry();
		const result = reg.register({
			name: "claimed-root",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: { type: "object", properties: {} },
			template: {
				kind: "stack",
				role: "panel",
				emphasis: "strong",
				children: [],
			},
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected registration to fail");
		expect(result.errors).toContain(
			"Template root must not carry an emphasis claim; claim at the call site (CompoundRef.emphasis).",
		);
		expect(reg.has("claimed-root")).toBe(false);
	});

	it("compounds may reference compounds (open under composition)", () => {
		const reg = new CompoundRegistry();
		reg.register(labeledStat);
		const card: CompoundDef = {
			name: "stat-card",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: { type: "object", properties: {} },
			template: {
				kind: "frame",
				role: "panel",
				children: [
					{ kind: "compound", name: "labeled-stat", args: { label: "Uptime", value: 99 } },
				],
			},
		};
		expect(reg.register(card).ok).toBe(true);
		const expanded = reg.expand({ kind: "stat-card" as never, name: "stat-card", args: {} });
		expect(JSON.stringify(expanded)).toContain("Uptime");
	});

	it("a default-args expansion lands in the grammar (render stays total)", () => {
		const reg = new CompoundRegistry();
		reg.register(labeledStat);
		const expanded: Node = reg.expand({
			kind: "compound",
			name: "labeled-stat",
			args: {},
		});
		expect(expanded.kind).toBe("stack");
	});

	it("enforces exact required args, types, and slot names at expansion", () => {
		const reg = new CompoundRegistry();
		const result = reg.register({
			name: "strict-card",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: {
				type: "object",
				properties: {
					title: { type: "node", required: true },
					count: { type: "number", default: 0 },
				},
			},
			template: {
				kind: "stack",
				role: "panel",
				children: [
					{ kind: "param-ref", param: "title" },
					{ kind: "param-ref", param: "count" },
					{ kind: "slot", name: "body" },
				],
			},
		});
		expect(result.ok).toBe(true);

		expect(() => reg.expand({ kind: "compound", name: "strict-card", args: {} })).toThrow(
			CompoundReferenceError,
		);
		expect(() =>
			reg.expand({
				kind: "compound",
				name: "strict-card",
				args: { title: { kind: "text", value: "Title" }, count: "many" },
			}),
		).toThrow('argument "count" must be number');
		expect(() =>
			reg.expand({
				kind: "compound",
				name: "strict-card",
				args: { title: { kind: "text", value: "Title" }, surprise: true },
				slots: { footer: [] },
			}),
		).toThrow('unknown argument "surprise"; unknown slot "footer"');
	});

	it("splices node-list params only at child-list positions", () => {
		const reg = new CompoundRegistry();
		expect(
			reg.register({
				name: "node-list",
				version: "1.0.0",
				grammarVersion: GRAMMAR_VERSION,
				params: {
					type: "object",
					properties: { items: { type: "node-list", required: true } },
				},
				template: {
					kind: "stack",
					role: "list",
					children: [{ kind: "param-ref", param: "items" }],
				},
			}).ok,
		).toBe(true);
		const expanded = reg.expand({
			kind: "compound",
			name: "node-list",
			args: {
				items: [
					{ kind: "text", value: "first" },
					{ kind: "text", value: "second" },
				],
			},
		});
		expect(expanded.kind).toBe("stack");
		if (expanded.kind !== "stack") throw new Error("expected a stack root");
		expect(expanded.children).toHaveLength(2);
	});

	it("rejects internally contradictory parameter definitions", () => {
		const reg = new CompoundRegistry();
		const contradictory = reg.register({
			name: "contradictory",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: {
				type: "object",
				properties: { title: { type: "string", required: true, default: "Title" } },
			},
			template: { kind: "param-ref", param: "missing" },
		});
		expect(contradictory.ok).toBe(false);
		if (contradictory.ok) throw new Error("expected registration to fail");
		expect(contradictory.errors).toContain(
			'Parameter "title" cannot be both required and defaulted.',
		);
		expect(contradictory.errors).toContain(
			'Template ParamRef "missing" has no declared parameter.',
		);
	});

	it("registers + fills slots in newer Action/Overlay kinds (totality of KNOWN_KINDS)", () => {
		const reg = new CompoundRegistry();
		const panelWithDisclosure: CompoundDef = {
			name: "panel-with-disclosure",
			version: "1.0.0",
			grammarVersion: GRAMMAR_VERSION,
			params: { type: "object", properties: {} },
			template: {
				kind: "frame",
				role: "panel",
				children: [
					// A button with a visible label — proves "button" is a KNOWN_KIND.
					{ kind: "button", label: "Toggle details", action: "toggle" },
					// A disclosure containing a slot — proves childrenOf/withChildren
					// descend into the overlay kind AND fill the nested slot.
					{
						kind: "disclosure",
						summary: "Details",
						children: [{ kind: "slot", name: "details" }],
					},
				],
			},
		};

		// KNOWN_KINDS fix: a template using button + disclosure registers cleanly.
		const result = reg.register(panelWithDisclosure);
		expect(result.ok).toBe(true);
		expect(reg.has("panel-with-disclosure")).toBe(true);

		// childrenOf/withChildren fix: the call-site fill lands INSIDE the
		// disclosure's children, not dropped at expansion.
		const expanded = reg.expand({
			kind: "compound",
			name: "panel-with-disclosure",
			args: {},
			slots: {
				details: [
					{ kind: "text", value: "First note", as: "body" },
					{ kind: "text", value: "Second note", as: "caption" },
				],
			},
		});

		expect(expanded.kind).toBe("frame");
		if (expanded.kind !== "frame") throw new Error("expected a frame root");
		const disclosure = expanded.children.find((c) => c.kind === "disclosure");
		expect(disclosure).toBeDefined();
		if (disclosure?.kind !== "disclosure") {
			throw new Error("expected a disclosure child");
		}
		const filledText = disclosure.children
			.filter((c): c is Extract<Node, { kind: "text" }> => c.kind === "text")
			.map((c) => c.value);
		expect(filledText).toEqual(["First note", "Second note"]);
		// No Slot leaf survived the expansion.
		expect(JSON.stringify(expanded)).not.toContain('"kind":"slot"');
	});
});

describe("compound lifecycle + dialect restriction (L1 minting / L4 G|D)", () => {
	/** A minimal valid def, parameterized by name (each test gets fresh ones). */
	const def = (name: string): CompoundDef => ({
		name,
		version: "1.0.0",
		grammarVersion: GRAMMAR_VERSION,
		params: { type: "object", properties: {} },
		template: {
			kind: "stack",
			role: "panel",
			children: [{ kind: "text", value: name }],
		},
	});

	it("candidate registration passes the SAME gate (the gate is the gate)", () => {
		const reg = new CompoundRegistry();
		const ok = reg.register(def("proposal"), { lifecycle: "candidate" });
		expect(ok.ok).toBe(true);
		expect(reg.lifecycleOf("proposal")).toBe("candidate");

		// And a gate-invalid def fails identically regardless of lifecycle.
		const cyclic: CompoundDef = {
			...def("loop2"),
			template: {
				kind: "stack",
				role: "panel",
				children: [{ kind: "compound", name: "loop2", args: {} }],
			},
		};
		expect(reg.register(cyclic, { lifecycle: "candidate" }).ok).toBe(false);
		expect(reg.register({ ...cyclic, name: "loop3" }).ok).toBe(false);
	});

	it("defaults to promoted, so everything registered today is unchanged", () => {
		const reg = new CompoundRegistry();
		reg.register(def("core-thing"));
		expect(reg.lifecycleOf("core-thing")).toBe("promoted");
		expect(reg.namesOf("promoted")).toEqual(["core-thing"]);
		expect(reg.namesOf("candidate")).toEqual([]);
	});

	it("promote flips visibility through an unrestricted view", () => {
		const reg = new CompoundRegistry();
		reg.register(def("proposal"), { lifecycle: "candidate" });
		const view = restrictCompounds(reg, { allow: [] });

		// Hidden while candidate (promoted is the default visible set)…
		expect(view.has("proposal")).toBe(false);
		expect(view.names).toEqual([]);

		// …visible after promotion. Same view object: the view reads the base live.
		expect(reg.promote("proposal")).toBe(true);
		expect(view.has("proposal")).toBe(true);
		expect(reg.promote("never-registered")).toBe(false);
	});

	it("a candidate renders where the dialect names it, or under the dev flag", () => {
		const reg = new CompoundRegistry();
		reg.register(def("proposal"), { lifecycle: "candidate" });

		const optedIn = restrictCompounds(reg, { allow: ["proposal"] });
		expect(optedIn.has("proposal")).toBe(true);

		const devPreview = restrictCompounds(reg, { allow: [], showCandidates: true });
		expect(devPreview.has("proposal")).toBe(true);
	});

	it("a non-empty allowlist treats out-of-dialect names as unknown (no throw at render)", () => {
		const reg = new CompoundRegistry();
		reg.register(def("inside"));
		reg.register(def("outside"));
		const view = restrictCompounds(reg, { allow: ["inside"] });

		// The renderer's totality path: has() is false, so it renders nothing —
		// it never calls expand() for an invisible name.
		expect(view.has("inside")).toBe(true);
		expect(view.has("outside")).toBe(false);
		expect(view.get("outside")).toBeUndefined();
		expect(view.names).toEqual(["inside"]);

		// expand() on an invisible name keeps the base's corrupt-call contract.
		expect(() => view.expand({ kind: "compound", name: "outside", args: {} })).toThrow(
			/Unknown compound/,
		);
	});

	it("an empty allowlist over promoted compounds is behavior-identical to the base", () => {
		const reg = new CompoundRegistry();
		reg.register(def("a"));
		reg.register(def("b"));
		const view = restrictCompounds(reg, { allow: [] });

		expect(view.names).toEqual(reg.names);
		for (const name of reg.names) {
			expect(view.has(name)).toBe(reg.has(name));
			expect(view.get(name)).toBe(reg.get(name));
			expect(view.expand({ kind: "compound", name, args: {} })).toEqual(
				reg.expand({ kind: "compound", name, args: {} }),
			);
		}
	});

	it("the base registry is never mutated by a view (two roots, two dialects)", () => {
		const reg = new CompoundRegistry();
		reg.register(def("a"));
		reg.register(def("b"));
		const narrow = restrictCompounds(reg, { allow: ["a"] });
		const wide = restrictCompounds(reg, { allow: [] });

		expect(narrow.has("b")).toBe(false);
		expect(wide.has("b")).toBe(true);
		expect(reg.has("b")).toBe(true);
		expect(reg.names).toEqual(["a", "b"]);
	});
});

describe("dialect application (Lemma 4)", () => {
	it("clamps priors into the design system's bounds", async () => {
		const { applyDialect } = await import("./dialects/provider.svelte.js");
		const { DEFAULT_DIALECT } = await import("./dialects/registry.js");
		const applied = applyDialect({
			id: "rogue",
			label: "Rogue",
			intents: DEFAULT_DIALECT.intents,
			priors: { rootBudget: 999, rootScaleTier: 4 },
			compounds: [],
		});
		expect(applied.rootContext.emphasisBudget).toBeLessThanOrEqual(6);
		expect(applied.attr).toBe("rogue");
	});

	it("default dialect produces the archive root context", async () => {
		const { applyDialect } = await import("./dialects/provider.svelte.js");
		const { DEFAULT_DIALECT } = await import("./dialects/registry.js");
		const applied = applyDialect(DEFAULT_DIALECT);
		expect(applied.attr).toBe("gallery");
		expect(applied.rootContext.density).toBe("regular");
	});
});

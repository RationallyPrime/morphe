/**
 * Core machinery smoke tests — proves the keystone is coherent, not just typed.
 * These are the seeds of the Lemma-as-property-test discipline (§12 of the
 * proposal); downstream agents extend them with Hypothesis-style fuzzing.
 */

import { describe, expect, it } from "vitest";
import {
	ROOT_CONTEXT,
	THRESHOLDS,
	TOP_TIER_CAP,
	densityForCount,
	enterFrame,
	renormalizeBudget,
	transform,
} from "./context/algebra.js";
import { CompoundRegistry } from "./compounds/factory.js";
import type { CompoundDef } from "./compounds/factory.js";
import type { Node } from "./grammar/types.js";

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

describe("compound factory — algebraic closure (Lemma 1)", () => {
	const labeledStat: CompoundDef = {
		name: "labeled-stat",
		version: "1.0.0",
		grammarVersion: "0.1.0",
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
			grammarVersion: "0.1.0",
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

	it("compounds may reference compounds (open under composition)", () => {
		const reg = new CompoundRegistry();
		reg.register(labeledStat);
		const card: CompoundDef = {
			name: "stat-card",
			version: "1.0.0",
			grammarVersion: "0.1.0",
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

	it("registers + fills slots in newer Action/Overlay kinds (totality of KNOWN_KINDS)", () => {
		const reg = new CompoundRegistry();
		const panelWithDisclosure: CompoundDef = {
			name: "panel-with-disclosure",
			version: "1.0.0",
			grammarVersion: "0.1.0",
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
		if (!disclosure || disclosure.kind !== "disclosure") {
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

describe("dialect application (Lemma 4)", () => {
	it("clamps priors into the design system's bounds", async () => {
		const { applyDialect } = await import("./dialects/provider.svelte.js");
		const applied = applyDialect({
			id: "rogue",
			label: "Rogue",
			intents: {},
			priors: { rootBudget: 999, rootScaleTier: 4 },
			compounds: [],
		});
		expect(applied.rootContext.emphasisBudget).toBeLessThanOrEqual(6);
		expect(applied.attr).toBe("rogue");
	});

	it("default dialect produces the archive root context", async () => {
		const { applyDialect } = await import("./dialects/provider.svelte.js");
		const { DEFAULT_DIALECT } = await import("./dialects/icelandic-archive.js");
		const applied = applyDialect(DEFAULT_DIALECT);
		expect(applied.attr).toBe("icelandic-archive");
		expect(applied.rootContext.density).toBe("regular");
	});
});

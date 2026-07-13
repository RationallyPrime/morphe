import { describe, expect, it } from "vitest";
import { parseLocalCompiledTree } from "./compiled-artifact.js";

const valid = {
	artifact_id: "capability-page.demo",
	revision_id: "rev-001",
	grammar_version: "0.1.0",
	producer_version: "0.1.0",
	presenter_version: "0.1.0",
	tree: { kind: "frame", role: "page", children: [{ kind: "spacer" }] },
	render_hints: { dialect: "gallery" },
	diagnostics: [],
	produced_at: "2026-07-13T00:00:00Z",
};

describe("parseLocalCompiledTree", () => {
	it("returns a recursively validated tree", () => {
		const result = parseLocalCompiledTree(valid, "capability-page.demo", "rev-001");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.tree.kind).toBe("frame");
	});

	it("rejects nested grammar failures", () => {
		const result = parseLocalCompiledTree(
			{
				...valid,
				tree: {
					kind: "frame",
					role: "page",
					children: [{ kind: "text", as: "heading" }],
				},
			},
			"capability-page.demo",
			"rev-001",
		);
		expect(result.ok).toBe(false);
	});

	it("rejects path metadata drift", () => {
		expect(parseLocalCompiledTree(valid, "capability-page.other", "rev-001")).toEqual({
			ok: false,
			reason: "compiled artifact id does not match its path",
		});
		expect(parseLocalCompiledTree(valid, "capability-page.demo", "rev-999")).toEqual({
			ok: false,
			reason: "compiled revision id does not match its path",
		});
	});

	it("rejects unknown dialect metadata", () => {
		expect(
			parseLocalCompiledTree(
				{ ...valid, render_hints: { dialect: "unknown" } },
				"capability-page.demo",
				"rev-001",
			),
		).toEqual({ ok: false, reason: "compiled artifact has an unknown dialect" });
	});

	it("rejects inherited object properties as dialect metadata", () => {
		expect(
			parseLocalCompiledTree(
				{ ...valid, render_hints: { dialect: "toString" } },
				"capability-page.demo",
				"rev-001",
			),
		).toEqual({ ok: false, reason: "compiled artifact has an unknown dialect" });
	});

	it("rejects a tree outside its declared dialect grammar", () => {
		const result = parseLocalCompiledTree(
			{
				...valid,
				render_hints: { dialect: "clinical" },
				tree: { kind: "compound", name: "consumer-private-card", args: {} },
			},
			"capability-page.demo",
			"rev-001",
		);
		expect(result).toEqual({
			ok: false,
			reason: 'compound "consumer-private-card" is not permitted by dialect "clinical"',
		});
	});

	it("fully validates known compound arguments under an unrestricted dialect", () => {
		const result = parseLocalCompiledTree(
			{
				...valid,
				tree: {
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: { kind: "text" },
						title: { kind: "text", value: "Valid title" },
					},
				},
			},
			"capability-page.demo",
			"rev-001",
		);
		expect(result).toEqual({
			ok: false,
			reason: 'argument "kicker" must contain schema-valid nodes',
		});
	});

	it("rejects malformed recursive compound args without throwing", () => {
		const result = parseLocalCompiledTree(
			{
				...valid,
				render_hints: { dialect: "clinical" },
				tree: {
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: { kind: "compound", name: "SignalCard" },
						title: { kind: "text", value: "Valid title" },
					},
				},
			},
			"capability-page.demo",
			"rev-001",
		);
		expect(result).toEqual({
			ok: false,
			reason: 'argument "kicker" must contain schema-valid nodes',
		});
	});
});

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
});

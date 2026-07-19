import { describe, expect, it } from "vitest";
import { validateNodeForDialect } from "$lib";
import { type IndexModel, indexTree } from "./index-presenter.js";

const MODEL: IndexModel = {
	title: "Krates ehf — Timaeus",
	grammarVersion: "0.2.0",
	sources: [
		{
			id: "taxis",
			title: "Taxis — workforce time",
			kind: "kernel",
			dialectId: "clinical",
			icon: "schedule",
			surfaces: [
				{ title: "Weekly roster", href: "/s/taxis/roster" },
				{ title: "Org overview", href: "/s/taxis/overview" },
			],
		},
		{
			id: "chreos",
			title: "Chreos — obligations",
			kind: "kernel",
			surfaces: [],
		},
	],
};

describe("indexTree", () => {
	it("renders one SignalCard per source with the declared measure", () => {
		const json = JSON.stringify(indexTree(MODEL));
		expect(json).toContain('"name":"SignalCard"');
		const cardCount = json.split('"name":"SignalCard"').length - 1;
		expect(cardCount).toBe(2);
		// The kernel card's measure is its declared-surface count.
		expect(json).toContain('"kind":"number","value":2');
	});

	it("carries the source dialect as the card signal and the icon in the kicker", () => {
		const json = JSON.stringify(indexTree(MODEL));
		expect(json).toContain('"label":"clinical"');
		expect(json).toContain('"kind":"icon","name":"schedule"');
	});

	it("links every declared surface", () => {
		const json = JSON.stringify(indexTree(MODEL));
		expect(json).toContain('"href":"/s/taxis/roster"');
		expect(json).toContain('"href":"/s/taxis/overview"');
	});

	it("is valid under an unrestricted dialect AND the clinical allowlist mask", () => {
		const tree = indexTree(MODEL);
		expect(validateNodeForDialect(tree, "timaeus").ok).toBe(true);
		expect(validateNodeForDialect(tree, "clinical").ok).toBe(true);
	});

	it("renders the empty state as an inline alert, never a bare page", () => {
		const tree = indexTree({ ...MODEL, sources: [] });
		const json = JSON.stringify(tree);
		expect(json).toContain('"kind":"inline-alert"');
		expect(json).toContain("No sources configured");
	});
});

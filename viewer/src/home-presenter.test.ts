import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import MorpheRoot from "$lib/render/MorpheRoot.svelte";
import { type HomePanelView, homeTree } from "./home-presenter.js";

/** A stand-in compiled pane tree (the shape the edge compiler grafts in). */
function paneTree(marker: string): Node {
	return {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: `${marker} lede`, as: "heading" },
			{ kind: "text", value: `${marker} body`, as: "body" },
			{ kind: "link", href: `/s/${marker}/detail`, label: `${marker} detail` },
		],
	};
}

function ssr(tree: Node): string {
	return render(MorpheRoot, { props: { tree } }).body;
}

/** Count `within` nodes by dimension anywhere in the tree. */
function countWithin(node: unknown, dimension: string): number {
	if (Array.isArray(node)) return node.reduce((n, c) => n + countWithin(c, dimension), 0);
	if (typeof node !== "object" || node === null) return 0;
	const record = node as Record<string, unknown>;
	let here = record.kind === "within" && record.dimension === dimension ? 1 : 0;
	for (const value of Object.values(record)) here += countWithin(value, dimension);
	return here;
}

const live: HomePanelView = {
	kind: "live",
	sourceId: "taxis",
	title: "Roster",
	tree: paneTree("taxis"),
	resolvedWindow: "westfjords:2026-W29",
};
const stale: HomePanelView = {
	kind: "stale",
	sourceId: "obolos",
	title: "Evidence",
	tree: paneTree("obolos"),
	staleAsOf: "09:14 UTC",
};
const dead: HomePanelView = { kind: "dead", sourceId: "krates", title: "Budget" };

describe("homeTree composition", () => {
	it("roots a single page frame and grafts every configured panel", () => {
		const tree = homeTree({ title: "Home", grammarVersion: "0.2.0", panels: [live, stale, dead] });
		expect(tree.kind).toBe("frame");
		const html = ssr(tree);
		// All three panels' ledes render.
		expect(html).toContain("Roster");
		expect(html).toContain("Evidence");
		expect(html).toContain("Budget");
	});

	it("achieves digest density via the substrate: density retier + collapse withhold per graft", () => {
		const tree = homeTree({ title: "Home", grammarVersion: "0.2.0", panels: [live, stale] });
		// One density Within and one collapse Within per grafted panel — never a CSS hack.
		expect(countWithin(tree, "density")).toBe(2);
		expect(countWithin(tree, "collapse")).toBe(2);

		const html = ssr(tree);
		// collapse → native labelled disclosure, collapsed by default.
		expect(html).toContain("<details");
		expect(html).toContain("Open full surface");
		expect(html).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);
		// density → compact context space step carried onto the graft (no layout box added).
		expect(html).toContain("--mo-ctx-space:var(--mo-space-3)");
		// the FULL compiled tree is still present inside the collapsed disclosure.
		expect(html).toContain("taxis body");
		expect(html).toContain("obolos body");
	});

	it("stamps a stale panel and captions a resolved window, both at provenance", () => {
		const html = ssr(homeTree({ title: "Home", grammarVersion: "0.2.0", panels: [live, stale] }));
		expect(html).toContain("resolved westfjords:2026-W29");
		expect(html).toContain("as of 09:14 UTC");
	});

	it("degrades a dead panel to a quiet cell naming the source, never blank", () => {
		const html = ssr(homeTree({ title: "Home", grammarVersion: "0.2.0", panels: [dead] }));
		expect(html).toContain("Source unavailable");
		expect(html).toContain("Budget could not be reached");
	});

	it("echoes the requested as_of in the masthead and links the catalog from the footer", () => {
		const html = ssr(
			homeTree({ title: "Home", grammarVersion: "0.2.0", asOf: "2026-07-15", panels: [live] }),
		);
		expect(html).toContain("as of 2026-07-15");
		expect(html).toContain("/surfaces");
		expect(html).toContain("Browse the full surface catalog");
	});

	it("renders an empty-state alert when no source declares a home panel", () => {
		const html = ssr(homeTree({ title: "Home", grammarVersion: "0.2.0", panels: [] }));
		expect(html).toContain("No home panels configured");
	});
});

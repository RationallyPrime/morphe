import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import MorpheRoot from "$lib/render/MorpheRoot.svelte";
import { type HomePanelView, homeTree } from "./home-presenter.js";

/** A stand-in compiled pane tree (the shape the edge compiler hands to home). */
function paneTree(marker: string): Node {
	return {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: `${marker} lede`, as: "heading", level: 1 },
			{ kind: "text", value: `${marker} body`, as: "body" },
			{ kind: "link", href: `/s/${marker}/detail`, label: `${marker} detail` },
		],
	};
}

function ssr(tree: Node): string {
	return render(MorpheRoot, { props: { tree } }).body;
}

function countMatching(
	node: unknown,
	predicate: (record: Record<string, unknown>) => boolean,
): number {
	if (Array.isArray(node)) {
		return node.reduce((count, child) => count + countMatching(child, predicate), 0);
	}
	if (typeof node !== "object" || node === null) return 0;
	const record = node as Record<string, unknown>;
	let count = predicate(record) ? 1 : 0;
	for (const value of Object.values(record)) count += countMatching(value, predicate);
	return count;
}

function containsReference(node: unknown, target: object): boolean {
	if (node === target) return true;
	if (Array.isArray(node)) return node.some((child) => containsReference(child, target));
	if (typeof node !== "object" || node === null) return false;
	return Object.values(node).some((child) => containsReference(child, target));
}

function findRecord(
	node: unknown,
	predicate: (record: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findRecord(child, predicate);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	if (typeof node !== "object" || node === null) return undefined;
	const record = node as Record<string, unknown>;
	if (predicate(record)) return record;
	for (const child of Object.values(record)) {
		const found = findRecord(child, predicate);
		if (found !== undefined) return found;
	}
	return undefined;
}

const live: HomePanelView = {
	kind: "live",
	sourceId: "taxis",
	sourceTitle: "Workforce",
	title: "Roster",
	href: "/s/taxis/roster",
	tree: paneTree("taxis"),
	resolvedWindow: "westfjords:2026-W29",
};
const liveAttention: HomePanelView = {
	kind: "live",
	sourceId: "misthos",
	sourceTitle: "Payroll",
	title: "Payroll run",
	href: "/s/misthos/run-summary",
	tree: {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "Review the payroll run", as: "heading", level: 1 },
			{ kind: "text", value: "signed payroll testimony", as: "body" },
			{ kind: "status", tone: "caution", signal: { text: "review" } },
			{
				kind: "inline-alert",
				tone: "caution",
				title: "PAYROLL_APPROVAL_REQUIRED",
				detail: "Two payslips need operator review.",
				repair: "Confirm approvals before release.",
			},
			{
				kind: "inline-alert",
				tone: "caution",
				title: "PAYROLL_APPROVAL_REQUIRED",
				detail: "Two payslips need operator review.",
				repair: "Confirm approvals before release.",
			},
			{
				kind: "inline-alert",
				tone: "info",
				title: "Informational only",
				detail: "Info is not an exception.",
			},
		],
	},
};
const calmLive: HomePanelView = {
	kind: "live",
	sourceId: "zygos",
	sourceTitle: "Books",
	title: "Ledger overview",
	href: "/s/zygos/overview",
	tree: {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "status", tone: "success", signal: { text: "Books balanced" } },
			{ kind: "inline-alert", tone: "info", title: "Period closed" },
		],
	},
};
const stale: HomePanelView = {
	kind: "stale",
	sourceId: "obolos",
	sourceTitle: "Treasury",
	title: "Evidence",
	href: "/s/obolos/evidence",
	tree: paneTree("obolos"),
	staleAsOf: "09:14 UTC",
};
const dead: HomePanelView = {
	kind: "dead",
	sourceId: "krates",
	sourceTitle: "Planning",
	title: "Budget",
	href: "/s/krates/budget",
};

describe("homeTree operator-first composition", () => {
	it("orders freshness and exceptions before domain navigation", () => {
		const tree = homeTree({ title: "Operations", grammarVersion: "0.3.0", panels: [live, stale] });
		const authored = JSON.stringify(tree);
		expect(authored.indexOf("Source freshness")).toBeLessThan(authored.indexOf("Needs attention"));
		expect(authored.indexOf("Needs attention")).toBeLessThan(authored.indexOf("Domains"));

		const html = ssr(tree);
		expect(html).toContain("1 source is not current");
		expect(html).toContain("1 current · 1 cached · 0 unavailable");
		expect(html).toContain("Evidence is using cached data");
	});

	it("lifts caution feedback from live authored testimony into Needs attention", () => {
		const original = structuredClone(liveAttention.tree);
		const tree = homeTree({
			title: "Operations",
			grammarVersion: "0.3.0",
			panels: [live, liveAttention],
		});
		const html = ssr(tree);
		expect(html).toContain("Needs attention");
		expect(html).toContain("Payroll run reports attention");
		const summary = findRecord(
			tree,
			(node) => node.kind === "inline-alert" && node.title === "Payroll run reports attention",
		);
		expect(summary?.detail).toBe(
			"Two payslips need operator review. — Confirm approvals before release.",
		);
		expect(String(summary?.detail)).not.toContain("PAYROLL_APPROVAL_REQUIRED");
		expect(String(summary?.detail)).not.toBe("review");
		expect(html).not.toContain("Informational only ·");
		expect(html).toContain("Review Payroll run");
		expect(html).toContain("Review the payroll run");
		expect(html).toContain("signed payroll testimony");
		expect(html).toContain("PAYROLL_APPROVAL_REQUIRED");
		expect(html).toContain("Current · 1 attention signal");
		expect(liveAttention.tree).toEqual(original);
		expect(containsReference(tree, liveAttention.tree)).toBe(false);
		const embedded = findRecord(
			tree,
			(node) =>
				node.kind === "stack" &&
				Array.isArray(node.children) &&
				node.children.some(
					(child) =>
						typeof child === "object" &&
						child !== null &&
						(child as Record<string, unknown>).kind === "text" &&
						(child as Record<string, unknown>).value === "Review the payroll run",
				),
		);
		const expectedEmbedded = structuredClone(original);
		const expectedTask = findRecord(
			expectedEmbedded,
			(node) => node.kind === "text" && node.value === "Review the payroll run",
		);
		if (expectedTask === undefined) throw new Error("test testimony needs a task heading");
		expectedTask.level = 2;
		expect(embedded).toEqual(expectedEmbedded);
		expect(
			findRecord(
				liveAttention.tree,
				(node) => node.kind === "text" && node.value === "Review the payroll run",
			)?.level,
		).toBe(1);
		expect(
			findRecord(tree, (node) => node.kind === "text" && node.value === "Review the payroll run")
				?.level,
		).toBe(2);
		expect(html.match(/<h1\b/g)).toHaveLength(1);
		expect(html).toMatch(/<h2[^>]*>Review the payroll run/);
	});

	it("ignores caution feedback in an inactive Vary option", () => {
		const calmDefault: HomePanelView = {
			kind: "live",
			sourceId: "choice",
			sourceTitle: "Choice source",
			title: "Choice pane",
			href: "/s/choice/pane",
			tree: {
				kind: "vary",
				id: "choice:home",
				default: 0,
				options: [
					{ kind: "status", tone: "success", signal: { text: "Ready" } },
					{
						kind: "inline-alert",
						tone: "caution",
						title: "INACTIVE_REVIEW",
						detail: "This inactive choice must not reach the queue.",
					},
				],
			},
		};

		const html = ssr(
			homeTree({ title: "Operations", grammarVersion: "0.3.0", panels: [calmDefault] }),
		);
		expect(html).toContain("The configured source is current");
		expect(html).not.toContain("Needs attention");
		expect(html).not.toContain("reports attention");
	});

	it("replaces equal raised panels with a plain declared-domain navigation list", () => {
		const tree = homeTree({
			title: "Operations",
			grammarVersion: "0.3.0",
			asOf: "2026-07-15",
			panels: [live, stale, dead],
		});
		expect(countMatching(tree, (node) => node.kind === "frame" && node.surface === "raised")).toBe(
			0,
		);

		const html = ssr(tree);
		expect(html).toContain('href="/s/taxis/roster?as_of=2026-07-15"');
		expect(html).toContain('href="/s/obolos/evidence?as_of=2026-07-15"');
		expect(html).toContain('href="/s/krates/budget?as_of=2026-07-15"');
		expect(html).toContain("Open Workforce");
		expect(html).toContain("Open Treasury");
		expect(html).toContain("Open Planning");
	});

	it("keeps stale testimony available but does not duplicate every live pane on home", () => {
		const tree = homeTree({ title: "Operations", grammarVersion: "0.3.0", panels: [live, stale] });
		// Only an exception keeps a compact, collapsed graft: live domains navigate instead.
		expect(
			countMatching(tree, (node) => node.kind === "within" && node.dimension === "density"),
		).toBe(1);
		expect(
			countMatching(tree, (node) => node.kind === "within" && node.dimension === "collapse"),
		).toBe(1);

		const html = ssr(tree);
		expect(html).toContain("Review cached Evidence");
		expect(html).toContain("obolos body");
		expect(html).not.toContain("taxis body");
		expect(html).toContain("--mo-ctx-space:var(--mo-space-3)");
	});

	it("keeps a truly calm all-live set out of the attention queue", () => {
		const html = ssr(
			homeTree({
				title: "Operations",
				grammarVersion: "0.3.0",
				panels: [live, calmLive],
			}),
		);
		expect(html).toContain("All 2 sources are current");
		expect(html).not.toContain("Needs attention");
		expect(html).not.toContain("reports attention");
		expect(html).toContain("Resolved westfjords:2026-W29");
	});

	it("names an unavailable source and says that no cached surface exists", () => {
		const html = ssr(homeTree({ title: "Operations", grammarVersion: "0.3.0", panels: [dead] }));
		expect(html).toContain("Budget is unavailable");
		expect(html).toContain("no cached surface is available");
	});

	it("keeps substrate detail progressive and the full catalog reachable", () => {
		const html = ssr(homeTree({ title: "Operations", grammarVersion: "0.3.0", panels: [live] }));
		expect(html).toContain("Technical details");
		expect(html).toContain("Grammar 0.3.0");
		expect(html).toContain('href="/surfaces"');
		expect(html).toContain("Browse every declared surface");
	});

	it("renders a product-facing empty state when no source declares a home pane", () => {
		const html = ssr(homeTree({ title: "Operations", grammarVersion: "0.3.0", panels: [] }));
		expect(html).toContain("No home sources configured");
		expect(html).not.toContain("MORPHE_SOURCES");
	});
});

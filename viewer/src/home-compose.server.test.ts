import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "$lib";
import { clearLastGood } from "./home-cache.server.js";
import { composeHomePanels, type HomePanelSource } from "./home-compose.server.js";
import type { PaneLoad, PaneLoadRequest } from "./pane-load.server.js";
import type { BoardConfig, SourceConfig, SurfaceEntry } from "./sources.js";

const entry: SurfaceEntry = {
	id: "roster",
	title: "Roster",
	path: "/orgs/1/surfaces/roster",
	representation: "source-v1",
	sourceSurfaceId: "taxis.roster:westfjords:2026-W29",
	routeOnly: false,
};

const source = {
	id: "taxis",
	title: "Taxis",
	kind: "kernel",
	baseUrl: "http://taxis:8205",
	governedParams: ["include_pii"],
	surfaces: [entry],
} as unknown as SourceConfig;

const roster: HomePanelSource[] = [{ source, entry, title: "Roster panel" }];
const board = {
	version: 2,
	board: "test-board",
	sources: new Map([[source.id, source]]),
	joins: [],
} as BoardConfig;

function paneLoad(tree: Node, resolvedWindow?: string): PaneLoad {
	return {
		surface: { artifactId: "taxis:roster", tree, dialectId: "ledger" },
		surfaceTitle: "Roster",
		temporalPolicy: "minute",
		...(resolvedWindow === undefined ? {} : { resolvedWindow }),
	};
}

const okTree: Node = { kind: "text", value: "roster body", as: "body" };
const noopFetch = (() => {
	throw new Error("fetch should not be called when loadPane is injected");
}) as unknown as typeof globalThis.fetch;

describe("composeHomePanels", () => {
	beforeEach(() => clearLastGood());

	it("yields a live panel and writes the last-good cache on success", async () => {
		const views = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => paneLoad(okTree, "westfjords:2026-W29"),
		});
		expect(views).toHaveLength(1);
		expect(views[0]).toMatchObject({
			kind: "live",
			sourceId: "taxis",
			sourceTitle: "Taxis",
			title: "Roster panel",
			href: "/s/taxis/roster",
			resolvedWindow: "westfjords:2026-W29",
		});
	});

	it("falls back to a STALE last-good compile when the kernel later fails", async () => {
		// First a successful admission seeds the cache...
		await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			now: () => new Date("2026-07-19T09:14:00Z"),
			loadPane: async () => paneLoad(okTree, "westfjords:2026-W29"),
		});
		// ...then the kernel refuses; stale beats blank.
		const views = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => {
				throw new Error("upstream 502");
			},
		});
		expect(views[0]).toMatchObject({
			kind: "stale",
			sourceId: "taxis",
			staleAsOf: "09:14 UTC",
			resolvedWindow: "westfjords:2026-W29",
		});
	});

	it("does not reuse a joined stale tree after the board policy changes", async () => {
		await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-with-worker-join",
			loadPane: async () => paneLoad(okTree),
		});
		const views = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-without-worker-join",
			loadPane: async () => {
				throw new Error("upstream unavailable");
			},
		});
		expect(views[0]?.kind).toBe("dead");
	});

	it.each([
		[
			"as_of",
			new URLSearchParams({ as_of: "2026-07-15" }),
			new URLSearchParams({ as_of: "2026-07-16" }),
		],
		[
			"temporal policy",
			new URLSearchParams({ temporal: "minute" }),
			new URLSearchParams({ temporal: "exact" }),
		],
		[
			"producer filter",
			new URLSearchParams({ worker_id: "worker-a" }),
			new URLSearchParams({ worker_id: "worker-b" }),
		],
	])("does not reuse stale testimony across a different %s", async (_name, first, second) => {
		await composeHomePanels({
			board,
			panels: roster,
			searchParams: first,
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => paneLoad(okTree),
		});
		const views = await composeHomePanels({
			board,
			panels: roster,
			searchParams: second,
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => {
				throw new Error("upstream unavailable");
			},
		});
		expect(views[0]?.kind).toBe("dead");
	});

	it("bounds request-keyed stale entries with LRU eviction", async () => {
		for (let index = 0; index <= 256; index += 1) {
			await composeHomePanels({
				board,
				panels: roster,
				searchParams: new URLSearchParams({ worker_id: `worker-${index}` }),
				fetch: noopFetch,
				dialectId: "ledger",
				boardPolicyKey: "board-a",
				loadPane: async () => paneLoad(okTree),
			});
		}
		const first = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams({ worker_id: "worker-0" }),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => {
				throw new Error("upstream unavailable");
			},
		});
		const newest = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams({ worker_id: "worker-256" }),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => {
				throw new Error("upstream unavailable");
			},
		});
		expect(first[0]?.kind).toBe("dead");
		expect(newest[0]?.kind).toBe("stale");
	});

	it("normalizes duplicate as_of values before fetch, join carry, and cache identity", async () => {
		const duplicate = new URLSearchParams("as_of=A&as_of=B");
		await composeHomePanels({
			board,
			panels: roster,
			searchParams: duplicate,
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async (request) => {
				expect(request.searchParams.getAll("as_of")).toEqual(["B"]);
				return paneLoad(okTree);
			},
		});
		const views = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams({ as_of: "B" }),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => {
				throw new Error("upstream unavailable");
			},
		});
		expect(views[0]?.kind).toBe("stale");
	});

	it("degrades to a DEAD cell when the kernel fails and nothing is cached", async () => {
		const views = await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async () => {
				throw new Error("upstream unreachable");
			},
		});
		expect(views[0]).toEqual({
			kind: "dead",
			sourceId: "taxis",
			sourceTitle: "Taxis",
			title: "Roster panel",
			href: "/s/taxis/roster",
		});
	});

	it("one dead kernel never blanks its live neighbours", async () => {
		const other = { ...source, id: "obolos", title: "Obolos" } as SourceConfig;
		const otherEntry = { ...entry, sourceSurfaceId: "obolos.evidence:x" };
		const views = await composeHomePanels({
			board,
			panels: [
				{ source, entry, title: "Roster panel" },
				{ source: other, entry: otherEntry, title: "Evidence panel" },
			],
			searchParams: new URLSearchParams(),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: async (request: PaneLoadRequest) => {
				if (request.source.id === "taxis") throw new Error("taxis down");
				return paneLoad(okTree);
			},
		});
		expect(views.map((v) => v.kind)).toEqual(["dead", "live"]);
	});

	it("fans the requested as_of and the home dialect to every panel fetch", async () => {
		const seen = vi.fn(async (request: PaneLoadRequest) => {
			expect(request.searchParams.get("as_of")).toBe("2026-07-15");
			expect(request.dialectOverride).toBe("ledger");
			return paneLoad(okTree);
		});
		await composeHomePanels({
			board,
			panels: roster,
			searchParams: new URLSearchParams({ as_of: "2026-07-15" }),
			fetch: noopFetch,
			dialectId: "ledger",
			boardPolicyKey: "board-a",
			loadPane: seen,
		});
		expect(seen).toHaveBeenCalledOnce();
	});
});

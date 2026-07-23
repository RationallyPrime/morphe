import { render } from "svelte/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaneLoad } from "./pane-load.server.js";
import { load } from "./routes/s/[source]/[surfaceId]/+page.server.js";
import PanePage from "./routes/s/[source]/[surfaceId]/+page.svelte";
import type { BoardConfig, SourceConfig } from "./sources.js";

const { bearerFor, loadSourcePane, loadBoard } = vi.hoisted(() => ({
	bearerFor: vi.fn(),
	loadSourcePane: vi.fn(),
	loadBoard: vi.fn(),
}));

vi.mock("$app/navigation", () => ({ goto: vi.fn() }));
vi.mock("./pane-load.server.js", () => ({ loadSourcePane }));
vi.mock("./sources.server.js", () => ({ bearerFor, loadBoard }));

const entry = {
	id: "roster",
	title: "Weekly roster",
	path: "/source/taxis-roster",
	representation: "source-v1",
	sourceSurfaceId: "taxis.roster:westfjords:2026-W29",
	routeOnly: false,
} as const;
const source = {
	id: "taxis",
	title: "Taxis fixture",
	kind: "kernel",
	baseUrl: "http://taxis.test",
	governedParams: [],
	surfaces: [entry],
} satisfies SourceConfig;
const board = {
	version: 2,
	board: "test-board",
	dimensions: { includePii: false, justification: "Public pane fixture" },
	sources: new Map([[source.id, source]]),
	joins: [],
} satisfies BoardConfig;

const pane = {
	surface: {
		artifactId: "taxis:roster",
		dialectId: "gallery",
		tree: { kind: "text", value: "Roster body", as: "body" },
	},
	surfaceTitle: entry.title,
	temporalPolicy: "minute",
} satisfies PaneLoad;

function event(url: string) {
	return {
		params: { source: source.id, surfaceId: entry.id },
		url: new URL(url),
		fetch: vi.fn(),
	} as never;
}

function pageData(asOf?: string) {
	return {
		...pane.surface,
		sourceTitle: source.title,
		surfaceTitle: pane.surfaceTitle,
		collectionHref: undefined,
		paneNav: [],
		temporalPolicy: pane.temporalPolicy,
		resolvedWindow: undefined,
		asOf,
	};
}

describe("source-v1 pane route as-of chrome", () => {
	beforeEach(() => {
		bearerFor.mockReset();
		loadBoard.mockReset();
		loadSourcePane.mockReset();
		bearerFor.mockReturnValue(undefined);
		loadBoard.mockReturnValue(board);
		loadSourcePane.mockResolvedValue(pane);
	});

	it("returns the requested as_of as pane page data", async () => {
		const result = await load(event("http://viewer.test/s/taxis/roster?as_of=2026-07-15"));

		expect(result).toMatchObject({ asOf: "2026-07-15" });
		expect(loadSourcePane).toHaveBeenCalledWith(
			expect.objectContaining({
				searchParams: expect.any(URLSearchParams),
			}),
		);
		expect(loadSourcePane.mock.calls[0]?.[0].searchParams.get("as_of")).toBe("2026-07-15");
	});

	it("returns an empty current-frontier selection when as_of is absent", async () => {
		const result = await load(event("http://viewer.test/s/taxis/roster"));

		expect(result).toHaveProperty("asOf", undefined);
		expect(loadSourcePane.mock.calls[0]?.[0].searchParams.has("as_of")).toBe(false);
	});

	it("renders the pane date control with route data and when the selection is empty", () => {
		const selected = render(PanePage, { props: { data: pageData("2026-07-15") } }).body;
		const current = render(PanePage, { props: { data: pageData() } }).body;

		expect(selected).toMatch(/<input type="date" value="2026-07-15"/);
		expect(current).toMatch(/<input type="date" value=""/);
	});
});

import { describe, expect, it, vi } from "vitest";
import { load } from "./routes/surfaces/+page.server.js";
import type { BoardConfig, SourceConfig, SurfaceEntry } from "./sources.js";

const { loadBoard } = vi.hoisted(() => ({ loadBoard: vi.fn() }));
vi.mock("./sources.server.js", () => ({ loadBoard }));

const listed: SurfaceEntry = {
	id: "employees",
	title: "Employees",
	path: "/orgs/o/surfaces/employees",
	representation: "source-v1",
	sourceSurfaceId: "taxis.employees:o:2026-07-22",
	governedParams: [],
	routeOnly: false,
};
const routeOnly: SurfaceEntry = {
	id: "employee",
	title: "Employee detail should stay hidden",
	path: "/orgs/o/surfaces/employee?worker_id=representative",
	representation: "source-v1",
	sourceSurfaceId: "taxis.employee:o:representative:2026-07-22",
	governedParams: [],
	routeOnly: true,
};
const source: SourceConfig = {
	id: "taxis",
	title: "Taxis",
	kind: "kernel",
	baseUrl: "http://taxis.test",
	governedParams: [],
	surfaces: [listed, routeOnly],
};
const board: BoardConfig = {
	version: 3,
	board: "test-board",
	dimensions: { includePii: false, justification: "Public catalog fixture" },
	sources: new Map([[source.id, source]]),
	joins: [],
};

describe("surface catalog route-only policy", () => {
	it("lists pins but keeps declared detail destinations out of catalog tiles and counts", () => {
		loadBoard.mockReturnValue(board);
		const result = load({ url: new URL("http://viewer.test/surfaces") } as never) as {
			tree: unknown;
		};
		const rendered = JSON.stringify(result.tree);
		expect(rendered).toContain("Employees");
		expect(rendered).not.toContain("Employee detail should stay hidden");
		expect(rendered).toContain("1 declared surfaces");
	});
});

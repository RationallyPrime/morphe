import { describe, expect, it } from "vitest";
import { paneNav } from "./pane-nav.js";
import type { SourceConfig, SurfaceEntry } from "./sources.js";

function entry(id: string, title: string, routeOnly = false): SurfaceEntry {
	return {
		id,
		title,
		path: `/surfaces/${id}`,
		representation: "source-v1",
		sourceSurfaceId: `taxis.${id}:demo`,
		routeOnly,
	};
}

function source(surfaces: readonly SurfaceEntry[]): SourceConfig {
	return {
		id: "taxis",
		title: "Workforce",
		kind: "kernel",
		baseUrl: "http://kernel.internal",
		governedParams: ["include_pii"],
		surfaces,
	};
}

describe("paneNav sibling trail", () => {
	it("lists every visible sibling as a link and the current pane as inert", () => {
		const nav = paneNav(
			source([entry("overview", "Overview"), entry("roster", "Roster"), entry("orgs", "Orgs")]),
			"overview",
		);
		expect(nav).toEqual([
			{ label: "Overview" },
			{ label: "Roster", href: "/s/taxis/roster" },
			{ label: "Orgs", href: "/s/taxis/orgs" },
		]);
	});

	it("carries as_of onto sibling links but never onto the current rung", () => {
		const nav = paneNav(
			source([entry("overview", "Overview"), entry("roster", "Roster")]),
			"overview",
			"2026-07-15",
		);
		expect(nav).toEqual([
			{ label: "Overview" },
			{ label: "Roster", href: "/s/taxis/roster?as_of=2026-07-15" },
		]);
	});

	it("never lists a route-only surface", () => {
		const nav = paneNav(
			source([
				entry("overview", "Overview"),
				entry("roster", "Roster"),
				entry("employee", "Employee", true),
			]),
			"overview",
		);
		expect(nav.map((item) => item.label)).toEqual(["Overview", "Roster"]);
	});

	it("contributes nothing when the current pane has no visible sibling", () => {
		expect(paneNav(source([entry("overview", "Overview")]), "overview")).toEqual([]);
		expect(
			paneNav(
				source([entry("overview", "Overview"), entry("employee", "Employee", true)]),
				"overview",
			),
		).toEqual([]);
	});

	it("offers the visible panes as plain links from a route-only pane", () => {
		// A drill destination (route_only) is not a nav position itself, but the
		// operator standing on it still gets the way across.
		const nav = paneNav(
			source([entry("roster", "Roster"), entry("employee", "Employee", true)]),
			"employee",
		);
		expect(nav).toEqual([{ label: "Roster", href: "/s/taxis/roster" }]);
	});

	it("contributes nothing for a source with no visible surfaces at all", () => {
		expect(paneNav(source([entry("employee", "Employee", true)]), "employee")).toEqual([]);
	});
});

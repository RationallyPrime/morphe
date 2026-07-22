import { describe, expect, it } from "vitest";
import { parseBoardConfig } from "./sources.js";

/** A minimal valid kernel source; `home_panel` is layered on per test. */
function kernelSource(homePanel?: unknown) {
	return {
		kind: "kernel",
		base_url: "http://taxis:8205/",
		title: "Taxis",
		source_trust: {
			issuer: "taxis",
			public_keys: {
				"taxis-2026-01": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			},
		},
		surfaces: [
			{
				id: "roster",
				title: "Roster",
				path: "/orgs/1/surfaces/roster",
				representation: "source-v1",
				surface_id: "taxis.roster:westfjords:2026-W29",
				route_only: false,
			},
		],
		...(homePanel === undefined ? {} : { home_panel: homePanel }),
	};
}

function parseOne(homePanel?: unknown) {
	return parseBoardConfig(
		JSON.stringify({
			version: 2,
			board: "home-panel-test",
			sources: { taxis: kernelSource(homePanel) },
			joins: [],
		}),
	);
}

describe("home_panel roster config (KRA-789)", () => {
	it("is absent by default — a source with no declaration simply skips home", () => {
		const result = parseOne();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.sources.get("taxis")?.homePanel).toBeUndefined();
	});

	it("parses a declared pane + title", () => {
		const result = parseOne({ pane: "roster", title: "This week's roster" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.sources.get("taxis")?.homePanel).toEqual({
			pane: "roster",
			title: "This week's roster",
		});
	});

	it("defaults the panel title to the source title when omitted", () => {
		const result = parseOne({ pane: "roster" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.sources.get("taxis")?.homePanel).toEqual({
			pane: "roster",
			title: "Taxis",
		});
	});

	it("fails config load when the declared pane is not a declared surface (boot validation)", () => {
		const result = parseOne({ pane: "not-a-surface", title: "X" });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.reason).toContain('home_panel pane "not-a-surface" is not a declared surface');
	});

	it("fails config load when home_panel is malformed", () => {
		const missingPane = parseOne({ title: "X" });
		expect(missingPane.ok).toBe(false);
		if (missingPane.ok) return;
		expect(missingPane.reason).toContain("home_panel needs a pane");

		const notObject = parseOne("roster");
		expect(notObject.ok).toBe(false);
		if (notObject.ok) return;
		expect(notObject.reason).toContain("home_panel must be an object");
	});
});

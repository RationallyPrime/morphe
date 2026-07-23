import { describe, expect, it } from "vitest";
import { paneRequestIdentity } from "./pane-load.server.js";
import type { BoardConfig, SourceConfig, SurfaceEntry } from "./sources.js";

const entry: SurfaceEntry = {
	id: "party",
	title: "Party",
	path: "/orgs/o-1/surfaces/party",
	representation: "source-v1",
	sourceSurfaceId: "chreos.party:o-1:p-7:2026-07-22",
	routeOnly: true,
};

function source(governedParams: readonly string[] = ["include_pii"]): SourceConfig {
	return {
		id: "chreos",
		title: "Chreos",
		kind: "kernel",
		baseUrl: "http://chreos.test",
		governedParams,
		surfaces: [entry],
	};
}

function board(includePii: boolean): BoardConfig {
	const mounted = source();
	return {
		version: 2,
		board: "request-identity",
		dimensions: {
			includePii,
			justification: includePii ? "Named operator demo" : "Public redacted demo",
		},
		sources: new Map([[mounted.id, mounted]]),
		joins: [],
	};
}

describe("paneRequestIdentity board dimensions", () => {
	it.each([
		"false",
		"garbage",
	])("lets board include_pii=true override hand-typed %s without carrying it", (handTyped) => {
		const identity = paneRequestIdentity(
			board(true),
			source(),
			entry,
			new URLSearchParams({ include_pii: handTyped, party_id: "p-7" }),
		);

		expect(identity.producerQuery.get("include_pii")).toBe("true");
		expect(identity.producerQuery.get("party_id")).toBe("p-7");
		expect(identity.forwarded.path).toBe("/orgs/o-1/surfaces/party?party_id=p-7&include_pii=true");
		expect(identity.forwarded.derived).toBe(true);
		expect(identity.carriedQuery.get("include_pii")).toBeNull();
		expect(identity.carriedQuery.get("party_id")).toBe("p-7");
	});

	it("sends no include_pii when the board dimension is false despite a user true", () => {
		const identity = paneRequestIdentity(
			board(false),
			source(),
			entry,
			new URLSearchParams({ include_pii: "true" }),
		);

		expect(identity.producerQuery.has("include_pii")).toBe(false);
		expect(identity.carriedQuery.has("include_pii")).toBe(false);
		expect(identity.forwarded).toEqual({
			path: "/orgs/o-1/surfaces/party",
			derived: false,
		});
	});

	it("makes the trusted injection part of cache identity", () => {
		const governed = paneRequestIdentity(board(true), source(), entry, new URLSearchParams());
		const redacted = paneRequestIdentity(board(false), source(), entry, new URLSearchParams());

		expect(governed.cacheKey).not.toBe(redacted.cacheKey);
		expect(governed.forwarded.derived).toBe(true);
	});

	it("does not inject include_pii for a source that explicitly opts out", () => {
		const identity = paneRequestIdentity(board(true), source([]), entry, new URLSearchParams());

		expect(identity.producerQuery.has("include_pii")).toBe(false);
		expect(identity.forwarded).toEqual({
			path: "/orgs/o-1/surfaces/party",
			derived: false,
		});
	});
});

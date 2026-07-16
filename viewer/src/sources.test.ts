import { describe, expect, it } from "vitest";
import { parseSourcesConfig } from "./sources.js";

const kernelSource = {
	kind: "kernel",
	base_url: "http://taxis:8205/",
	title: "Taxis",
	dialect_hint: "timaeus",
	token_env: "VIEWER_TAXIS_TOKEN",
	surfaces: [
		{ id: "orgs", title: "Organizations", path: "/surfaces/orgs" },
		{ id: "roster", path: "/orgs/1/surfaces/roster", dialect_hint: "ledger" },
	],
};

const storeSource = {
	kind: "store",
	base_url: "http://topos:8000/api/v1/surfaces",
	surfaces: [{ id: "digest", title: "Balance digest", artifact_id: "surface:digest:run-1" }],
};

describe("parseSourcesConfig", () => {
	it("returns an empty map when nothing is configured", () => {
		const result = parseSourcesConfig(undefined, undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.size).toBe(0);
	});

	it("synthesizes the legacy default store from MORPHE_ARTIFACT_BASE_URL", () => {
		const result = parseSourcesConfig(undefined, "http://topos:8000/api/v1/surfaces/");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const source = result.sources.get("default");
		expect(source?.kind).toBe("store");
		expect(source?.baseUrl).toBe("http://topos:8000/api/v1/surfaces");
	});

	it("parses a multi-source config with kernel and store sources", () => {
		const result = parseSourcesConfig(
			JSON.stringify({ taxis: kernelSource, default: storeSource }),
			undefined,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const taxis = result.sources.get("taxis");
		expect(taxis?.baseUrl).toBe("http://taxis:8205");
		expect(taxis?.tokenEnv).toBe("VIEWER_TAXIS_TOKEN");
		expect(taxis?.surfaces).toHaveLength(2);
		const roster = taxis?.surfaces[1];
		expect(roster && "path" in roster && roster.dialectHint).toBe("ledger");
		const orgs = taxis?.surfaces[0];
		expect(orgs?.title).toBe("Organizations");
		const digest = result.sources.get("default")?.surfaces[0];
		expect(digest && "artifactId" in digest && digest.artifactId).toBe("surface:digest:run-1");
	});

	it("MORPHE_SOURCES wins over the legacy env when both are set", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }), "http://legacy:1");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.has("default")).toBe(false);
	});

	it.each([
		["invalid JSON", "{nope"],
		["non-object root", JSON.stringify([kernelSource])],
		["path-unsafe source id", JSON.stringify({ "Bad Id!": kernelSource })],
		["missing kind", JSON.stringify({ taxis: { ...kernelSource, kind: undefined } })],
		["non-http base_url", JSON.stringify({ taxis: { ...kernelSource, base_url: "file:///x" } })],
		[
			"kernel surface with relative path",
			JSON.stringify({
				taxis: { ...kernelSource, surfaces: [{ id: "orgs", path: "surfaces/orgs" }] },
			}),
		],
		[
			"store surface without artifact_id",
			JSON.stringify({ default: { ...storeSource, surfaces: [{ id: "digest" }] } }),
		],
		[
			"duplicate surface ids",
			JSON.stringify({
				taxis: {
					...kernelSource,
					surfaces: [
						{ id: "orgs", path: "/a" },
						{ id: "orgs", path: "/b" },
					],
				},
			}),
		],
	])("rejects %s", (_label, raw) => {
		expect(parseSourcesConfig(raw, undefined).ok).toBe(false);
	});
});

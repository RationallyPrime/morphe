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

const sourceV1Kernel = {
	...kernelSource,
	source_trust: {
		issuer: "taxis",
		public_keys: {
			"taxis-2026-01": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		},
		max_age_seconds: 300,
		max_future_skew_seconds: 30,
	},
	surfaces: [
		{
			id: "roster",
			path: "/orgs/1/surfaces/roster",
			representation: "source-v1",
			surface_id: "taxis.roster:westfjords:2026-W29",
		},
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
		expect(roster && "path" in roster && roster.representation).toBe("legacy");
		const orgs = taxis?.surfaces[0];
		expect(orgs?.title).toBe("Organizations");
		const digest = result.sources.get("default")?.surfaces[0];
		expect(digest && "artifactId" in digest && digest.artifactId).toBe("surface:digest:run-1");
	});

	it("parses an explicitly pinned source-v1 representation", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: sourceV1Kernel }), undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const source = result.sources.get("taxis");
		expect(source?.sourceTrust?.issuer).toBe("taxis");
		expect(source?.sourceTrust?.publicKeys.get("taxis")?.get("taxis-2026-01")).toBe(
			"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		);
		const surface = source?.surfaces[0];
		expect(
			surface && "representation" in surface && surface.representation === "source-v1"
				? surface.sourceSurfaceId
				: null,
		).toBe("taxis.roster:westfjords:2026-W29");
	});

	it("MORPHE_SOURCES wins over the legacy env when both are set", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }), "http://legacy:1");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.has("default")).toBe(false);
	});

	it("parses a declared collection_root that names an existing surface", () => {
		const result = parseSourcesConfig(
			JSON.stringify({ taxis: { ...kernelSource, collection_root: "orgs" } }),
			undefined,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.collectionRoot).toBe("orgs");
	});

	it("leaves collectionRoot undefined when the source does not declare one", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }), undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.collectionRoot).toBeUndefined();
	});

	// governed_params is fail-closed: an undeclared source gets the Krepis
	// default deny (`include_pii`); only an explicit [] opts out.
	it("defaults governedParams to include_pii when undeclared", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }), undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.governedParams).toEqual(["include_pii"]);
	});

	it("parses a declared governed_params list, deduplicated", () => {
		const result = parseSourcesConfig(
			JSON.stringify({
				taxis: {
					...kernelSource,
					governed_params: ["include_pii", "as_of_sequence", "include_pii"],
				},
			}),
			undefined,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.governedParams).toEqual(["include_pii", "as_of_sequence"]);
	});

	it("honors an explicit empty governed_params as the deliberate opt-out", () => {
		const result = parseSourcesConfig(
			JSON.stringify({ taxis: { ...kernelSource, governed_params: [] } }),
			undefined,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.governedParams).toEqual([]);
	});

	it.each([
		["invalid JSON", "{nope"],
		["non-object root", JSON.stringify([kernelSource])],
		["path-unsafe source id", JSON.stringify({ "Bad Id!": kernelSource })],
		["missing kind", JSON.stringify({ taxis: { ...kernelSource, kind: undefined } })],
		["non-http base_url", JSON.stringify({ taxis: { ...kernelSource, base_url: "file:///x" } })],
		[
			"non-array governed_params",
			JSON.stringify({ taxis: { ...kernelSource, governed_params: "include_pii" } }),
		],
		[
			"governed_params with an empty entry",
			JSON.stringify({ taxis: { ...kernelSource, governed_params: ["include_pii", ""] } }),
		],
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
		[
			"source-v1 without trust pins",
			JSON.stringify({
				taxis: { ...kernelSource, surfaces: sourceV1Kernel.surfaces },
			}),
		],
		[
			"source-v1 without a concrete signed identity",
			JSON.stringify({
				taxis: {
					...sourceV1Kernel,
					surfaces: [{ id: "roster", path: "/roster", representation: "source-v1" }],
				},
			}),
		],
		[
			"malformed raw public key",
			JSON.stringify({
				taxis: {
					...sourceV1Kernel,
					source_trust: {
						...sourceV1Kernel.source_trust,
						public_keys: { bad: "not-a-key" },
					},
				},
			}),
		],
		[
			"collection_root naming an undeclared surface",
			JSON.stringify({ taxis: { ...kernelSource, collection_root: "ghost" } }),
		],
	])("rejects %s", (_label, raw) => {
		expect(parseSourcesConfig(raw, undefined).ok).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import { parseSourcesConfig } from "./sources.js";

const sourceTrust = {
	issuer: "taxis",
	public_keys: {
		"taxis-2026-01": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	},
	max_age_seconds: 300,
	max_future_skew_seconds: 30,
};

const kernelSource = {
	kind: "kernel",
	base_url: "http://taxis:8205/",
	title: "Taxis",
	dialect_hint: "timaeus",
	token_env: "VIEWER_TAXIS_TOKEN",
	source_trust: sourceTrust,
	surfaces: [
		{
			id: "orgs",
			title: "Organizations",
			path: "/surfaces/orgs",
			representation: "source-v1",
			surface_id: "taxis.orgs:westfjords:2026-W29",
		},
		{
			id: "roster",
			path: "/orgs/1/surfaces/roster",
			dialect_hint: "ledger",
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
		const result = parseSourcesConfig(undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.size).toBe(0);
	});

	it("parses a source-v1 kernel config", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const taxis = result.sources.get("taxis");
		expect(taxis?.kind).toBe("kernel");
		expect(taxis?.baseUrl).toBe("http://taxis:8205");
		expect(taxis?.tokenEnv).toBe("VIEWER_TAXIS_TOKEN");
		expect(taxis?.surfaces).toHaveLength(2);
		const roster = taxis?.surfaces[1];
		expect(roster?.dialectHint).toBe("ledger");
		expect(roster?.representation).toBe("source-v1");
		expect(roster?.sourceSurfaceId).toBe("taxis.roster:westfjords:2026-W29");
		const orgs = taxis?.surfaces[0];
		expect(orgs?.title).toBe("Organizations");
	});

	it("pins the source-v1 trust roots by issuer and key id", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const source = result.sources.get("taxis");
		expect(source?.sourceTrust?.issuer).toBe("taxis");
		expect(source?.sourceTrust?.publicKeys.get("taxis")?.get("taxis-2026-01")).toBe(
			"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		);
		expect(source?.sourceTrust?.maxAgeSeconds).toBe(300);
		expect(source?.sourceTrust?.maxFutureSkewSeconds).toBe(30);
	});

	// Stage-5 retirement (KRA-775): the store reader and the legacy
	// bare-CompiledSurface representation are gone — configs that declare either
	// fail closed with an error naming the retirement.
	it("rejects a store source with the retirement error", () => {
		const result = parseSourcesConfig(JSON.stringify({ default: storeSource }));
		expect(result).toEqual({
			ok: false,
			reason:
				"source default: store sources are retired (KRA-775 Stage 5) — the viewer admits kernel source-v1 only",
		});
	});

	it("rejects a kernel surface with no declared representation (the retired legacy default)", () => {
		const result = parseSourcesConfig(
			JSON.stringify({
				taxis: {
					...kernelSource,
					surfaces: [{ id: "orgs", title: "Organizations", path: "/surfaces/orgs" }],
				},
			}),
		);
		expect(result).toEqual({
			ok: false,
			reason:
				'source taxis: kernel surface orgs: the legacy representation is retired (KRA-775 Stage 5) — declare representation "source-v1"',
		});
	});

	it("rejects an explicit legacy representation with the retirement error", () => {
		const result = parseSourcesConfig(
			JSON.stringify({
				taxis: {
					...kernelSource,
					surfaces: [{ id: "orgs", path: "/surfaces/orgs", representation: "legacy" }],
				},
			}),
		);
		expect(result).toEqual({
			ok: false,
			reason:
				'source taxis: kernel surface orgs: the legacy representation is retired (KRA-775 Stage 5) — declare representation "source-v1"',
		});
	});

	it("rejects non-empty surfaces without source_trust", () => {
		const result = parseSourcesConfig(
			JSON.stringify({ taxis: { ...kernelSource, source_trust: undefined } }),
		);
		expect(result).toEqual({
			ok: false,
			reason: "source taxis: source-v1 surfaces require source_trust",
		});
	});

	it("parses a declared collection_root that names an existing surface", () => {
		const result = parseSourcesConfig(
			JSON.stringify({ taxis: { ...kernelSource, collection_root: "orgs" } }),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.collectionRoot).toBe("orgs");
	});

	it("leaves collectionRoot undefined when the source does not declare one", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.collectionRoot).toBeUndefined();
	});

	// governed_params is fail-closed: an undeclared source gets the Krepis
	// default deny (`include_pii`); only an explicit [] opts out.
	it("defaults governedParams to include_pii when undeclared", () => {
		const result = parseSourcesConfig(JSON.stringify({ taxis: kernelSource }));
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
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.sources.get("taxis")?.governedParams).toEqual(["include_pii", "as_of_sequence"]);
	});

	it("honors an explicit empty governed_params as the deliberate opt-out", () => {
		const result = parseSourcesConfig(
			JSON.stringify({ taxis: { ...kernelSource, governed_params: [] } }),
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
				taxis: {
					...kernelSource,
					surfaces: [
						{
							id: "orgs",
							path: "surfaces/orgs",
							representation: "source-v1",
							surface_id: "taxis.orgs:westfjords:2026-W29",
						},
					],
				},
			}),
		],
		[
			"unsupported representation",
			JSON.stringify({
				taxis: {
					...kernelSource,
					surfaces: [
						{
							id: "orgs",
							path: "/surfaces/orgs",
							representation: "source-v2",
							surface_id: "taxis.orgs:westfjords:2026-W29",
						},
					],
				},
			}),
		],
		[
			"duplicate surface ids",
			JSON.stringify({
				taxis: {
					...kernelSource,
					surfaces: [
						{ id: "orgs", path: "/a", representation: "source-v1", surface_id: "taxis.orgs:a" },
						{ id: "orgs", path: "/b", representation: "source-v1", surface_id: "taxis.orgs:b" },
					],
				},
			}),
		],
		[
			"source-v1 without trust pins",
			JSON.stringify({
				taxis: { ...kernelSource, source_trust: undefined },
			}),
		],
		[
			"source-v1 without a concrete signed identity",
			JSON.stringify({
				taxis: {
					...kernelSource,
					surfaces: [{ id: "roster", path: "/roster", representation: "source-v1" }],
				},
			}),
		],
		[
			"malformed raw public key",
			JSON.stringify({
				taxis: {
					...kernelSource,
					source_trust: {
						...sourceTrust,
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
		expect(parseSourcesConfig(raw).ok).toBe(false);
	});
});

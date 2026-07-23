import { describe, expect, it } from "vitest";
import { parseBoardConfig } from "./sources.js";

const sourceTrust = {
	issuer: "taxis",
	public_keys: {
		"taxis-2026-01": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	},
	max_age_seconds: 300,
	max_future_skew_seconds: 30,
};

function surface(
	id: string,
	family = `taxis.${id}`,
	options: { routeOnly?: boolean; path?: string } = {},
): Record<string, unknown> {
	return {
		id,
		title: id,
		path: options.path ?? `/surfaces/${id}`,
		representation: "source-v1",
		surface_id: `${family}:westfjords:2026-W29`,
		route_only: options.routeOnly ?? false,
	};
}

function kernelSource(
	id: string,
	surfaces: readonly Record<string, unknown>[] = [surface("orgs")],
	overrides: Record<string, unknown> = {},
) {
	return {
		kind: "kernel",
		base_url: `http://${id}:8205/`,
		title: id,
		dialect_hint: "timaeus",
		token_env: `VIEWER_${id.toUpperCase()}_TOKEN`,
		source_trust: { ...sourceTrust, issuer: id },
		surfaces,
		...overrides,
	};
}

function board(sources: Record<string, unknown>, joins: readonly unknown[] = [], extra = {}) {
	return JSON.stringify({
		version: 2,
		board: "timaeus-demo",
		dimensions: {
			include_pii: false,
			justification: "Public test board",
		},
		sources,
		joins,
		...extra,
	});
}

function admittedJoin(overrides: Record<string, unknown> = {}) {
	return {
		id: "employee-to-payslip",
		scope: "board",
		from: {
			source: "taxis",
			family: "taxis.employee",
			selector: { kind: "admitted-surface-id", instance_segment: 1 },
			paint: { path: "$.worker_id", mode: "scalar-value" },
		},
		target: {
			source: "misthos",
			pane: "payslip",
			query: { parameter: "worker_id" },
		},
		...overrides,
	};
}

const twoSources = {
	taxis: kernelSource("taxis", [surface("employee", "taxis.employee")]),
	misthos: kernelSource("misthos", [
		surface("run-summary", "misthos.run-summary"),
		surface("payslip", "misthos.payslip", { routeOnly: true }),
	]),
};

describe("parseBoardConfig source contract", () => {
	it("returns an explicit empty board only when the environment is unset", () => {
		const result = parseBoardConfig(undefined);
		expect(result).toEqual({
			ok: true,
			config: {
				version: 2,
				board: null,
				dimensions: null,
				sources: new Map(),
				joins: [],
			},
		});
		expect(parseBoardConfig("").ok).toBe(false);
	});

	it("parses the exact v2 root and source-v1 config", () => {
		const result = parseBoardConfig(
			board({
				taxis: kernelSource("taxis", [
					surface("orgs"),
					{
						...surface("roster", "taxis.roster"),
						dialect_hint: "ledger",
						title: undefined,
					},
				]),
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.board).toBe("timaeus-demo");
		expect(result.config.dimensions).toEqual({
			includePii: false,
			justification: "Public test board",
		});
		const taxis = result.config.sources.get("taxis");
		expect(taxis?.baseUrl).toBe("http://taxis:8205");
		expect(taxis?.tokenEnv).toBe("VIEWER_TAXIS_TOKEN");
		expect(taxis?.surfaces).toHaveLength(2);
		expect(taxis?.surfaces[1]).toMatchObject({
			id: "roster",
			dialectHint: "ledger",
			representation: "source-v1",
			sourceSurfaceId: "taxis.roster:westfjords:2026-W29",
			routeOnly: false,
		});
		expect(taxis?.surfaces[1]?.title).toBe("roster");
	});

	it("requires dimensions on every configured v2 board", () => {
		const configured = JSON.parse(board({ taxis: kernelSource("taxis") })) as Record<
			string,
			unknown
		>;
		delete configured.dimensions;
		const result = parseBoardConfig(JSON.stringify(configured));

		expect(result).toEqual({
			ok: false,
			reason: "MORPHE_SOURCES needs dimensions",
		});
	});

	it.each([
		["non-object", null],
		["missing fields", {}],
		["non-boolean include_pii", { include_pii: "true", justification: "Operator demo" }],
		["missing justification", { include_pii: true }],
		["empty justification", { include_pii: true, justification: "" }],
		["whitespace justification", { include_pii: true, justification: "   " }],
		["unknown field", { include_pii: true, justification: "Operator demo", surprise: true }],
	])("rejects %s dimensions", (_label, dimensions) => {
		expect(
			parseBoardConfig(
				board({ taxis: kernelSource("taxis") }, [], {
					dimensions,
				}),
			).ok,
		).toBe(false);
	});

	it("pins trust roots and preserves governed parameter behavior", () => {
		const result = parseBoardConfig(
			board({
				taxis: kernelSource("taxis", undefined, {
					governed_params: ["include_pii", "as_of_sequence", "include_pii"],
				}),
			}),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const source = result.config.sources.get("taxis");
		expect(source?.sourceTrust?.issuer).toBe("taxis");
		expect(source?.sourceTrust?.publicKeys.get("taxis")?.get("taxis-2026-01")).toBe(
			"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		);
		expect(source?.sourceTrust?.maxAgeSeconds).toBe(300);
		expect(source?.sourceTrust?.maxFutureSkewSeconds).toBe(30);
		expect(source?.governedParams).toEqual(["include_pii", "as_of_sequence"]);
	});

	it("defaults governed params and honors an explicit empty opt-out", () => {
		const defaults = parseBoardConfig(board({ taxis: kernelSource("taxis") }));
		expect(defaults.ok && defaults.config.sources.get("taxis")?.governedParams).toEqual([
			"include_pii",
		]);
		const optedOut = parseBoardConfig(
			board({
				taxis: kernelSource("taxis", undefined, { governed_params: [] }),
			}),
		);
		expect(optedOut.ok && optedOut.config.sources.get("taxis")?.governedParams).toEqual([]);
	});

	it.each([
		"?include_pii=true",
		"?%69nclude_pii=true",
	])("rejects board-governed PII authority baked into a configured path (%s)", (query) => {
		const result = parseBoardConfig(
			board({
				taxis: kernelSource(
					"taxis",
					[surface("orgs", "taxis.orgs", { path: `/surfaces/orgs${query}` })],
					{ governed_params: [] },
				),
			}),
		);

		expect(result).toEqual({
			ok: false,
			reason:
				'source taxis: kernel surface orgs path must not declare governed parameter "include_pii"',
		});
	});

	it("rejects flat/v1/partial roots and unknown keys without an alias path", () => {
		expect(parseBoardConfig(JSON.stringify({ taxis: kernelSource("taxis") })).ok).toBe(false);
		expect(
			parseBoardConfig(JSON.stringify({ version: 1, board: "old", sources: {}, joins: [] })).ok,
		).toBe(false);
		expect(parseBoardConfig(JSON.stringify({ version: 2, board: "x", sources: {} })).ok).toBe(
			false,
		);
		expect(parseBoardConfig(board({}, [], { dimensions: {} })).ok).toBe(false);
		expect(parseBoardConfig(board({})).ok).toBe(false);
	});

	it("requires route_only on every surface and rejects unknown nested keys", () => {
		const noRouteOnly = { ...surface("employee") } as Record<string, unknown>;
		delete noRouteOnly.route_only;
		expect(parseBoardConfig(board({ taxis: kernelSource("taxis", [noRouteOnly]) })).ok).toBe(false);
		expect(
			parseBoardConfig(
				board({
					taxis: kernelSource("taxis", [{ ...surface("employee"), surprise: true }]),
				}),
			).ok,
		).toBe(false);
		expect(
			parseBoardConfig(board({ taxis: kernelSource("taxis", undefined, { surprise: true }) })).ok,
		).toBe(false);
	});

	it("keeps route-only panes out of collection and home declarations", () => {
		const route = surface("employee", "taxis.employee", { routeOnly: true });
		expect(
			parseBoardConfig(
				board({
					taxis: kernelSource("taxis", [route], {
						collection_root: "employee",
					}),
				}),
			).ok,
		).toBe(false);
		expect(
			parseBoardConfig(
				board({
					taxis: kernelSource("taxis", [route], {
						home_panel: { pane: "employee" },
					}),
				}),
			).ok,
		).toBe(false);
	});

	it.each([
		["non-object root", JSON.stringify([])],
		[
			"path-unsafe board id",
			JSON.stringify({ version: 2, board: "Bad Id!", sources: {}, joins: [] }),
		],
		["path-unsafe source id", board({ "Bad Id!": kernelSource("taxis") })],
		["missing kind", board({ taxis: kernelSource("taxis", undefined, { kind: undefined }) })],
		[
			"non-http base_url",
			board({
				taxis: kernelSource("taxis", undefined, { base_url: "file:///x" }),
			}),
		],
		[
			"non-array governed_params",
			board({
				taxis: kernelSource("taxis", undefined, {
					governed_params: "include_pii",
				}),
			}),
		],
		[
			"invalid governed param",
			board({
				taxis: kernelSource("taxis", undefined, {
					governed_params: ["Bad param"],
				}),
			}),
		],
		[
			"relative path",
			board({
				taxis: kernelSource("taxis", [surface("orgs", "taxis.orgs", { path: "surfaces/orgs" })]),
			}),
		],
		[
			"unsupported representation",
			board({
				taxis: kernelSource("taxis", [{ ...surface("orgs"), representation: "source-v2" }]),
			}),
		],
		[
			"duplicate surface ids",
			board({
				taxis: kernelSource("taxis", [surface("orgs"), surface("orgs")]),
			}),
		],
		[
			"source-v1 without trust",
			board({
				taxis: kernelSource("taxis", undefined, { source_trust: undefined }),
			}),
		],
		[
			"missing signed identity",
			board({
				taxis: kernelSource("taxis", [{ ...surface("orgs"), surface_id: undefined }]),
			}),
		],
		[
			"malformed raw key",
			board({
				taxis: kernelSource("taxis", undefined, {
					source_trust: { ...sourceTrust, public_keys: { bad: "not-a-key" } },
				}),
			}),
		],
		[
			"undeclared collection",
			board({
				taxis: kernelSource("taxis", undefined, { collection_root: "ghost" }),
			}),
		],
	])("rejects %s", (_label, raw) => {
		expect(parseBoardConfig(raw).ok).toBe(false);
	});
});

describe("parseBoardConfig directional joins", () => {
	it("parses and camel-cases an admitted-surface-id join", () => {
		const result = parseBoardConfig(board(twoSources, [admittedJoin()]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.joins).toEqual([
			{
				id: "employee-to-payslip",
				scope: "board",
				from: {
					source: "taxis",
					family: "taxis.employee",
					selector: { kind: "admitted-surface-id", instanceSegment: 1 },
					paint: { path: "$.worker_id", mode: "scalar-value" },
				},
				target: {
					source: "misthos",
					pane: "payslip",
					queryParameter: "worker_id",
				},
			},
		]);
	});

	it("parses the external-ref/linked-ref-label matrix", () => {
		const join = admittedJoin({
			id: "run-worker-to-employee",
			from: {
				source: "misthos",
				family: "misthos.run-summary",
				selector: { kind: "external-ref", scheme: "workforce" },
				paint: { path: "$.rows[*].worker", mode: "linked-ref-label" },
			},
			target: {
				source: "taxis",
				pane: "employee",
				query: { parameter: "worker_id" },
			},
		});
		const sources = {
			...twoSources,
			taxis: kernelSource("taxis", [surface("employee", "taxis.employee", { routeOnly: true })]),
		};
		const result = parseBoardConfig(board(sources, [join]));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.joins[0]?.from.selector).toEqual({
			kind: "external-ref",
			scheme: "workforce",
		});
	});

	it("keeps a join dormant when only its target source is unmounted", () => {
		const result = parseBoardConfig(
			board(
				{
					taxis: kernelSource("taxis", [surface("employee", "taxis.employee")]),
				},
				[admittedJoin()],
			),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config.joins).toHaveLength(1);
	});

	it("requires a mounted from source and family", () => {
		expect(parseBoardConfig(board({}, [admittedJoin()])).ok).toBe(false);
		expect(
			parseBoardConfig(
				board({ taxis: kernelSource("taxis", [surface("roster", "taxis.roster")]) }, [
					admittedJoin(),
				]),
			).ok,
		).toBe(false);
	});

	it("requires a mounted target pane to exist and be route-only", () => {
		const ordinary = {
			...twoSources,
			misthos: kernelSource("misthos", [surface("payslip", "misthos.payslip")]),
		};
		expect(parseBoardConfig(board(ordinary, [admittedJoin()])).ok).toBe(false);
		const absent = {
			...twoSources,
			misthos: kernelSource("misthos", [surface("other", "misthos.other", { routeOnly: true })]),
		};
		expect(parseBoardConfig(board(absent, [admittedJoin()])).ok).toBe(false);
	});

	it("rejects governed and viewer-reserved target query parameters", () => {
		const governed = {
			...twoSources,
			misthos: kernelSource(
				"misthos",
				[surface("payslip", "misthos.payslip", { routeOnly: true })],
				{ governed_params: ["worker_id"] },
			),
		};
		expect(parseBoardConfig(board(governed, [admittedJoin()])).ok).toBe(false);
		for (const parameter of ["as_of", "dialect", "temporal"]) {
			const reserved = admittedJoin({
				target: {
					source: "misthos",
					pane: "payslip",
					query: { parameter },
				},
			});
			expect(parseBoardConfig(board(twoSources, [reserved])).ok).toBe(false);
		}
	});

	it("rejects duplicate ids and overlapping source/family/paint declarations", () => {
		expect(parseBoardConfig(board(twoSources, [admittedJoin(), admittedJoin()])).ok).toBe(false);
		const overlap = admittedJoin({
			id: "same-field-elsewhere",
			target: {
				source: "elsewhere",
				pane: "worker",
				query: { parameter: "worker_id" },
			},
		});
		expect(parseBoardConfig(board(twoSources, [admittedJoin(), overlap])).ok).toBe(false);
	});

	it("rejects selector/paint mismatch and malformed join atoms", () => {
		const mismatch = admittedJoin({
			from: {
				source: "taxis",
				family: "taxis.employee",
				selector: { kind: "external-ref", scheme: "workforce" },
				paint: { path: "$.worker_id", mode: "scalar-value" },
			},
		});
		expect(parseBoardConfig(board(twoSources, [mismatch])).ok).toBe(false);

		const cases = [
			admittedJoin({ id: "Bad id" }),
			admittedJoin({ scope: "org" }),
			admittedJoin({
				from: { ...(admittedJoin().from as object), family: "not-a-family" },
			}),
			admittedJoin({
				from: {
					...(admittedJoin().from as object),
					paint: { path: "worker_id", mode: "scalar-value" },
				},
			}),
			admittedJoin({
				target: {
					source: "misthos",
					pane: "payslip",
					query: { parameter: "Bad-param" },
				},
			}),
			{ ...admittedJoin(), surprise: true },
			admittedJoin({ target: { ...admittedJoin().target, surprise: true } }),
		];
		for (const join of cases) expect(parseBoardConfig(board(twoSources, [join])).ok).toBe(false);
	});
});

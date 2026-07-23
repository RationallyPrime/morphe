import { describe, expect, it } from "vitest";
import type { SurfaceNode } from "$lib/surface-edge/spec.js";
import { BoardLinkResolutionError, boardLinkPolicyKey, resolveBoardLinks } from "./board-links.js";
import type { BoardConfig, BoardJoin, SourceConfig } from "./sources.js";

function node(
	path: string,
	strategy: SurfaceNode["strategy"],
	options: Partial<SurfaceNode> = {},
): SurfaceNode {
	return {
		path,
		label: path,
		strategy,
		heading: false,
		children: [],
		items: [],
		diagnostics: [],
		...options,
	};
}

const DETAIL_JOIN: BoardJoin = {
	id: "employee-to-payslip",
	scope: "board",
	from: {
		source: "taxis",
		family: "taxis.employee",
		selector: { kind: "admitted-surface-id", instanceSegment: 1 },
		paint: { path: "$.header.employee", mode: "scalar-value" },
	},
	target: { source: "misthos", pane: "payslip", queryParameter: "worker_id" },
};

const EXTERNAL_JOIN: BoardJoin = {
	id: "run-worker-to-employee",
	scope: "board",
	from: {
		source: "misthos",
		family: "misthos.run-summary",
		selector: { kind: "external-ref", scheme: "workforce" },
		paint: { path: "$.rows[*].worker", mode: "linked-ref-label" },
	},
	target: { source: "taxis", pane: "employee", queryParameter: "worker_id" },
};

const OPTIONAL_EXTERNAL_JOIN: BoardJoin = {
	id: "instruction-to-obligation",
	scope: "board",
	from: {
		source: "obolos",
		family: "obolos.instruction",
		selector: { kind: "external-ref", scheme: "commitment" },
		paint: { path: "$.details.commitment", mode: "linked-ref-label" },
	},
	target: { source: "chreos", pane: "obligation", queryParameter: "obligation_id" },
};

function config(joins: readonly BoardJoin[], mounted = ["taxis", "misthos"]): BoardConfig {
	return {
		version: 2,
		board: "test-board",
		dimensions: { includePii: false, justification: "Public link fixture" },
		sources: new Map(
			mounted.map((id) => [
				id,
				{ id, governedParams: [], surfaces: [] } as unknown as SourceConfig,
			]),
		),
		joins,
	};
}

describe("board link resolution", () => {
	it("namespaces cached trees by the board dimensions", () => {
		const publicBoard = config([]);
		const governedBoard: BoardConfig = {
			...publicBoard,
			dimensions: { includePii: true, justification: "Named operator demo" },
		};

		expect(boardLinkPolicyKey(governedBoard)).not.toBe(boardLinkPolicyKey(publicBoard));
	});

	it("takes a detail key only from the admitted surface identity", () => {
		const spec = node("$", "record-card", {
			children: [node("$.header.employee", "scalar", { value: "Matthías" })],
		});
		const plan = resolveBoardLinks(
			config([DETAIL_JOIN]),
			"taxis",
			"taxis.employee:taxis-org:signed-worker:2026-07-22",
			spec,
			"2026-07-22",
		);
		expect(plan.paints.get("$.header.employee")).toEqual({
			href: "/s/misthos/payslip?worker_id=signed-worker&as_of=2026-07-22",
			mode: "scalar-value",
		});
	});

	it("resolves each exact signed workforce carrier independently", () => {
		const rows = node("$.rows", "table", {
			items: [
				node("$.rows[0]", "record-card", {
					children: [
						node("$.rows[0].worker", "linked-ref", {
							label: "Matthías",
							href: "workforce:///worker-1",
						}),
					],
				}),
				node("$.rows[1]", "record-card", {
					children: [
						node("$.rows[1].worker", "linked-ref", {
							label: "Anna",
							href: "workforce:///worker-2",
						}),
					],
				}),
			],
		});
		const plan = resolveBoardLinks(
			config([EXTERNAL_JOIN]),
			"misthos",
			"misthos.run-summary:misthos-org:run-1",
			node("$", "record-card", { children: [rows] }),
		);
		expect([...plan.paints]).toEqual([
			[
				"$.rows[1].worker",
				{ href: "/s/taxis/employee?worker_id=worker-2", mode: "linked-ref-label" },
			],
			[
				"$.rows[0].worker",
				{ href: "/s/taxis/employee?worker_id=worker-1", mode: "linked-ref-label" },
			],
		]);
	});

	it("resolves the exact signed instruction commitment carrier", () => {
		const obligationId = "00000000-0000-4000-8000-000000000823";
		const spec = node("$", "record-card", {
			children: [
				node("$.details", "record-card", {
					children: [
						node("$.details.commitment", "linked-ref", {
							label: "Purchase obligation",
							href: `commitment:///${obligationId}`,
						}),
					],
				}),
			],
		});
		const plan = resolveBoardLinks(
			config([OPTIONAL_EXTERNAL_JOIN], ["obolos", "chreos"]),
			"obolos",
			"obolos.instruction:obolos-org:instruction-1",
			spec,
		);

		expect(plan.paints.get("$.details.commitment")).toEqual({
			href: `/s/chreos/obligation?obligation_id=${obligationId}`,
			mode: "linked-ref-label",
		});
	});

	it("treats an existing empty collection as a valid zero-paint result", () => {
		const spec = node("$", "record-card", {
			children: [node("$.rows", "table", { items: [] })],
		});
		const plan = resolveBoardLinks(
			config([EXTERNAL_JOIN]),
			"misthos",
			"misthos.run-summary:misthos-org:run-1",
			spec,
		);
		expect(plan.paints.size).toBe(0);
	});

	it("treats an absent optional ExternalRef as a valid zero-paint result", () => {
		const spec = node("$", "record-card", {
			children: [
				node("$.details", "record-card", {
					children: [node("$.details.commitment", "linked-ref")],
				}),
			],
		});
		const plan = resolveBoardLinks(
			config([OPTIONAL_EXTERNAL_JOIN], ["obolos", "chreos"]),
			"obolos",
			"obolos.instruction:obolos-org:instruction-1",
			spec,
		);

		expect(plan.paints.size).toBe(0);
	});

	it("rejects an href-less ExternalRef that still claims a display value", () => {
		const spec = node("$", "record-card", {
			children: [
				node("$.details", "record-card", {
					children: [
						node("$.details.commitment", "linked-ref", {
							value: "Unresolved commitment",
						}),
					],
				}),
			],
		});

		expect(() =>
			resolveBoardLinks(
				config([OPTIONAL_EXTERNAL_JOIN], ["obolos", "chreos"]),
				"obolos",
				"obolos.instruction:obolos-org:instruction-1",
				spec,
			),
		).toThrow("is not a signed linked-ref carrier");
	});

	it("leaves a declaration dormant when its target source is unmounted", () => {
		const spec = node("$", "record-card", {
			children: [node("$.header.employee", "scalar", { value: "Matthías" })],
		});
		const plan = resolveBoardLinks(
			config([DETAIL_JOIN], ["taxis"]),
			"taxis",
			"taxis.employee:taxis-org:worker-1:2026-07-22",
			spec,
		);
		expect(plan.paints.size).toBe(0);
	});

	it.each([
		"workforce://host/worker-1",
		"workforce:///worker-1/extra",
		"workforce:///worker-1?query=yes",
		"workforce:///worker%2F1",
	])("rejects malformed or unsafe ExternalRef %s", (href) => {
		const spec = node("$", "record-card", {
			children: [
				node("$.rows", "table", {
					items: [
						node("$.rows[0]", "record-card", {
							children: [node("$.rows[0].worker", "linked-ref", { href })],
						}),
					],
				}),
			],
		});
		expect(() =>
			resolveBoardLinks(config([EXTERNAL_JOIN]), "misthos", "misthos.run-summary:org:run", spec),
		).toThrow(BoardLinkResolutionError);
	});

	it("fails closed when an active identity segment is missing", () => {
		const bad: BoardJoin = {
			...DETAIL_JOIN,
			from: {
				...DETAIL_JOIN.from,
				selector: { kind: "admitted-surface-id", instanceSegment: 9 },
			},
		};
		expect(() =>
			resolveBoardLinks(
				config([bad]),
				"taxis",
				"taxis.employee:org:worker:date",
				node("$", "record-card"),
			),
		).toThrow("no safe instance segment 9");
	});
});

import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import type { Node } from "../grammar/types.js";
import { buildSurface } from "./build.js";
import { compileSourceSurface, compileSourceSurfaceDetailed } from "./compile.js";
import { emitNode, emitNodeWithLinkPaints, type LinkPaint, SurfaceLinkPaintError } from "./emit.js";
import type { TrustedSourceSurface } from "./source.js";
import { type JsonSchema, surfaceNode } from "./spec.js";

const HASH = `sha256:${"0".repeat(64)}` as const;

function linksIn(root: Node): Array<{ readonly href: string; readonly label: string }> {
	const links: Array<{ readonly href: string; readonly label: string }> = [];
	const pending: unknown[] = [root];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === null || typeof current !== "object") continue;
		if (Array.isArray(current)) {
			pending.push(...current);
			continue;
		}
		const record = current as Record<string, unknown>;
		if (
			record.kind === "link" &&
			typeof record.href === "string" &&
			typeof record.label === "string"
		) {
			links.push({ href: record.href, label: record.label });
		}
		pending.push(...Object.values(record));
	}
	return links;
}

function paints(
	...entries: readonly (readonly [string, LinkPaint])[]
): ReadonlyMap<string, LinkPaint> {
	return new Map(entries);
}

const PEOPLE_SCHEMA: JsonSchema = {
	type: "object",
	"x-morphe": { order: ["employee", "manager"] },
	properties: {
		employee: { type: "string", title: "Employee" },
		manager: { type: "string", title: "Manager" },
	},
};

describe("host link paints", () => {
	it("keeps an empty paint set byte-identical to the default TS emitter", () => {
		const spec = buildSurface(PEOPLE_SCHEMA, { employee: "Ada", manager: "Ada" });
		const plain = emitNode(spec);
		const painted = emitNodeWithLinkPaints(spec, new Map());
		expect(JSON.stringify(painted)).toBe(JSON.stringify(plain));
	});

	it("paints only the exact scalar path and uses its displayed value as the label", () => {
		const spec = buildSurface(PEOPLE_SCHEMA, { employee: "Ada", manager: "Ada" });
		const node = emitNodeWithLinkPaints(
			spec,
			paints(["$.employee", { mode: "scalar-value", href: "/s/misthos/payslip?worker_id=w-1" }]),
		);
		expect(linksIn(node)).toEqual([{ href: "/s/misthos/payslip?worker_id=w-1", label: "Ada" }]);
		expect(JSON.stringify(node)).toContain('"value":"Ada"');
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("paints the EntityHeader identity promoted to the kicker", () => {
		const schema: JsonSchema = {
			type: "object",
			"x-morphe": { order: ["header"] },
			properties: {
				header: {
					type: "object",
					title: "Employee",
					"x-morphe": { strategy: "entity-header", order: ["employee"] },
					properties: { employee: { type: "string", title: "Employee" } },
				},
			},
		};
		const spec = buildSurface(schema, { header: { employee: "Arna" } }, { root: schema });
		const node = emitNodeWithLinkPaints(
			spec,
			paints([
				"$.header.employee",
				{ mode: "scalar-value", href: "/s/taxis/employee?worker_id=w-7" },
			]),
		);
		expect(linksIn(node)).toContainEqual({
			href: "/s/taxis/employee?worker_id=w-7",
			label: "Arna",
		});
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("retargets an exact linked-ref leaf while preserving its signed label", () => {
		const schema: JsonSchema = {
			type: "object",
			"x-morphe": { order: ["rows"] },
			properties: {
				rows: {
					type: "array",
					title: "Run rows",
					"x-morphe": { strategy: "table" },
					items: {
						type: "object",
						"x-morphe": { order: ["worker"] },
						properties: {
							worker: {
								type: "object",
								title: "Worker",
								"x-morphe": { strategy: "linked-ref" },
							},
						},
					},
				},
			},
		};
		const spec = buildSurface(
			schema,
			{ rows: [{ worker: { label: "Arna", href: "workforce:///w-7" } }] },
			{ root: schema },
		);
		const node = emitNodeWithLinkPaints(
			spec,
			paints([
				"$.rows[0].worker",
				{ mode: "linked-ref-label", href: "/s/taxis/employee?worker_id=w-7" },
			]),
		);
		expect(linksIn(node)).toEqual([{ href: "/s/taxis/employee?worker_id=w-7", label: "Arna" }]);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it.each([
		["missing exact path", "$.*", "scalar-value", "/s/taxis/employee", "LINK_PAINT_MISSING_PATH"],
		[
			"mode/type mismatch",
			"$.employee",
			"linked-ref-label",
			"/s/taxis/employee",
			"LINK_PAINT_MODE_MISMATCH",
		],
		[
			"external href",
			"$.employee",
			"scalar-value",
			"https://example.test/employee",
			"LINK_PAINT_UNSAFE_HREF",
		],
		[
			"protocol-relative href",
			"$.employee",
			"scalar-value",
			"//example.test/employee",
			"LINK_PAINT_UNSAFE_HREF",
		],
	] as const)("fails closed on %s", (_name, path, mode, href, code) => {
		const spec = buildSurface(PEOPLE_SCHEMA, { employee: "Ada", manager: "Grace" });
		try {
			emitNodeWithLinkPaints(spec, paints([path, { mode, href }]));
			throw new Error("expected link paint failure");
		} catch (error) {
			expect(error).toBeInstanceOf(SurfaceLinkPaintError);
			expect((error as SurfaceLinkPaintError).code).toBe(code);
		}
	});

	it("fails closed when a scalar is promoted through an unsupported lowering", () => {
		const metric = surfaceNode({
			path: "$.metric",
			label: "Metric",
			strategy: "scalar",
			value: "7",
		});
		const spec = surfaceNode({ path: "$", label: "Metrics", strategy: "kpi-row", items: [metric] });
		expect(() =>
			emitNodeWithLinkPaints(
				spec,
				paints(["$.metric", { mode: "scalar-value", href: "/s/metrics/detail" }]),
			),
		).toThrowError(SurfaceLinkPaintError);
		try {
			emitNodeWithLinkPaints(
				spec,
				paints(["$.metric", { mode: "scalar-value", href: "/s/metrics/detail" }]),
			);
		} catch (error) {
			expect((error as SurfaceLinkPaintError).code).toBe("LINK_PAINT_UNPAINTABLE");
		}
	});

	it("fails closed when the painted scalar has no visible link label", () => {
		const spec = surfaceNode({ path: "$", label: "Empty", strategy: "scalar", value: "" });
		try {
			emitNodeWithLinkPaints(
				spec,
				paints(["$", { mode: "scalar-value", href: "/s/empty/detail" }]),
			);
			throw new Error("expected link paint failure");
		} catch (error) {
			expect(error).toBeInstanceOf(SurfaceLinkPaintError);
			expect((error as SurfaceLinkPaintError).code).toBe("LINK_PAINT_UNPAINTABLE");
		}
	});
});

describe("detailed compilation", () => {
	it("retains the IR and frozen emit context without changing the narrow result", () => {
		const now = (): Date => new Date("2026-07-22T17:00:00Z");
		const source = {
			schema: PEOPLE_SCHEMA,
			data: { employee: "Ada", manager: "Grace" },
			diagnostics: [],
			sourceTestimonySha256: HASH,
			surfaceIdGate: "exact",
		} as unknown as TrustedSourceSurface;
		const narrow = compileSourceSurface(source, { temporalPolicy: "relative", now });
		const detailed = compileSourceSurfaceDetailed(source, { temporalPolicy: "relative", now });
		expect(detailed.tree).toEqual(narrow.tree);
		expect(detailed.diagnostics).toEqual(narrow.diagnostics);
		expect(detailed.receipt).toEqual(narrow.receipt);
		expect(detailed.ir.children.map((child) => child.path)).toEqual(["$.employee", "$.manager"]);
		expect(detailed.emitContext.temporalPolicy).toBe("relative");
		expect(detailed.emitContext.now()).toEqual(now());
		expect(detailed.emitContext.now()).not.toBe(detailed.emitContext.now());
		expect(Object.isFrozen(detailed.emitContext)).toBe(true);
		expect(narrow).not.toHaveProperty("ir");
		expect(narrow).not.toHaveProperty("emitContext");
	});
});

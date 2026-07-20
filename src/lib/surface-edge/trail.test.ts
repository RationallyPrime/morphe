import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import { PROMOTED_COMPOUNDS } from "../compounds/catalog.generated.js";
import { CompoundReferenceError, registry } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { buildSurface } from "./build.js";
import { emitNode } from "./emit.js";
import { EMPTY_HINT, parseHint } from "./hints.js";
import { resolveStrategy } from "./resolve.js";
import type { JsonSchema } from "./spec.js";

const TRAIL_SCHEMA: JsonSchema = {
	type: "array",
	title: "Trail",
	"x-morphe": { strategy: "trail", heading: false },
	items: {
		type: "object",
		"x-morphe": { order: ["when", "what", "state", "amount", "link", "ref"] },
		properties: {
			when: { type: "string", title: "When", "x-morphe": { temporal: "date-time-minute" } },
			what: { type: "string", title: "What" },
			state: { type: "string", title: "State", "x-morphe": { strategy: "status" } },
			amount: { type: "number", title: "Amount" },
			link: { type: "object", title: "Link", "x-morphe": { strategy: "linked-ref" } },
			ref: { type: "string", title: "Ref", "x-morphe": { role: "provenance" } },
		},
	},
};
const TRAIL_DATA = [
	{
		when: "2026-07-17T09:14:00Z",
		what: "Admitted",
		state: "posted",
		amount: 1250,
		link: { label: "Open", href: "/a/1" },
		ref: "evt-001",
	},
];

// The SAME expected tree the Python twin asserts verbatim
// (py/tests/test_surface_trail.py::EXPECTED_TRAIL).
const EXPECTED_TRAIL: Node = {
	kind: "stack",
	role: "section",
	children: [
		{
			kind: "compound",
			name: "TrailEntry",
			args: {
				summary: { kind: "text", value: "Admitted", as: "body" },
				stamp: { kind: "text", value: "2026-07-17 09:14 UTC", as: "caption", intent: "marginalia" },
			},
			slots: {
				// KRA-788 D3: state chips ride the event line; leftover fields keep
				// their caption (the label IS the subject) in the detail slot.
				signals: [{ kind: "status", tone: "neutral", signal: { text: "posted" } }],
				detail: [
					{
						kind: "stack",
						role: "field-group",
						children: [
							{ kind: "text", value: "Amount", as: "caption", intent: "neutral" },
							{ kind: "text", value: "1250.0", as: "body", numeric: true, polarity: "positive" },
						],
					},
				],
				ref: [{ kind: "link", href: "/a/1", label: "Open" }],
				provenance: [
					{
						kind: "compound",
						name: "ProvenanceFooter",
						args: {},
						slots: {
							facts: [
								{
									kind: "stack",
									role: "field-group",
									children: [
										{ kind: "text", value: "Ref", as: "caption", intent: "neutral" },
										{ kind: "text", value: "evt-001", as: "body", intent: "provenance" },
									],
								},
							],
							seals: [],
							links: [],
						},
					},
				],
			},
		},
	],
};

function trailPayload(node: Node) {
	if (node.kind !== "stack" || node.role !== "section") throw new Error("expected root task stack");
	expect(node.children[0]).toEqual({
		kind: "text",
		value: "Trail",
		as: "heading",
		level: 1,
	});
	const payload = node.children[1];
	if (payload?.kind !== "stack") throw new Error("expected trail payload");
	return payload;
}

describe("trail lowering (KRA-786)", () => {
	it("is hint-selected only — structural inference never returns it", () => {
		const arr: JsonSchema = {
			type: "array",
			items: { type: "object", properties: { a: { type: "string" } } },
		};
		expect(["table", "card-stack"]).toContain(resolveStrategy(arr, EMPTY_HINT));
		expect(resolveStrategy(arr, parseHint({ "x-morphe": { strategy: "trail" } }).hint)).toBe(
			"trail",
		);
	});

	it("leaves the hint-free floor unchanged — an array without the hint stays structural", () => {
		const { "x-morphe": _hint, ...floor } = TRAIL_SCHEMA;
		expect(["table", "card-stack"]).toContain(
			buildSurface(floor, TRAIL_DATA, { root: floor }).strategy,
		);
	});

	it("lowers each item to a promoted TrailEntry — byte-identical to the Python oracle", () => {
		const node = emitNode(buildSurface(TRAIL_SCHEMA, TRAIL_DATA, { root: TRAIL_SCHEMA }));
		expect(trailPayload(node)).toEqual(EXPECTED_TRAIL);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("keeps identifiers out of the summary — provenance is their only home", () => {
		const node = emitNode(buildSurface(TRAIL_SCHEMA, TRAIL_DATA, { root: TRAIL_SCHEMA }));
		const entry = trailPayload(node).children[0];
		if (entry?.kind !== "compound") throw new Error("expected a TrailEntry");
		expect((entry.args.summary as { value: string }).value).toBe("Admitted");
		const prov = entry.slots?.provenance?.[0];
		expect(prov).toMatchObject({ kind: "compound", name: "ProvenanceFooter" });
		expect(JSON.stringify(prov)).toContain("evt-001");
	});

	it("preserves promoted-arg and item diagnostics at the provenance head", () => {
		const node = emitNode(
			buildSurface(TRAIL_SCHEMA, TRAIL_DATA, {
				root: TRAIL_SCHEMA,
				diagnostics: [
					{ code: "EVT", severity: "warning", path: "$[0]", message: "event level" },
					{ code: "STAMP", severity: "info", path: "$[0].when", message: "stamp src" },
				],
			}),
		);
		const entry = trailPayload(node).children[0];
		if (entry?.kind !== "compound") throw new Error("expected a TrailEntry");
		const alerts = (entry.slots?.provenance ?? [])
			.filter((item) => item.kind === "inline-alert")
			.map((item) => (item.kind === "inline-alert" ? item.title : ""));
		expect(alerts).toEqual(["EVT", "STAMP"]);
	});
});

describe("TrailEntry factory gate", () => {
	it("registers the generated TrailEntry and expands its slots hygienically", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("TrailEntry");
		expect(registry.has("TrailEntry")).toBe(true);
		if (EXPECTED_TRAIL.kind !== "stack") throw new Error("fixture");
		const entry = EXPECTED_TRAIL.children[0];
		if (entry === undefined || entry.kind !== "compound") throw new Error("expected an entry");
		const json = JSON.stringify(registry.expand(entry));
		expect(json).not.toContain('"kind":"slot"');
		expect(json).not.toContain("param-ref");
		expect(json).toContain("evt-001");
	});

	it("rejects an invalid call (missing required summary) through the gate", () => {
		expect(() => registry.expand({ kind: "compound", name: "TrailEntry", args: {} })).toThrow(
			CompoundReferenceError,
		);
	});
});

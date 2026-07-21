import { describe, expect, it } from "vitest";
import { validateNodeDocument } from "../artifacts/surface.js";
import { PROMOTED_COMPOUNDS } from "../compounds/catalog.generated.js";
import { registry } from "../compounds/factory.js";
import type { Node } from "../grammar/types.js";
import { buildSurface } from "./build.js";
import { emitNode } from "./emit.js";
import { type JsonSchema, surfaceNode } from "./spec.js";

const PANE_SCHEMA: JsonSchema = {
	type: "object",
	title: "Obligation review",
	"x-morphe": {
		order: ["worklist", "description", "name", "receipt", "state", "seal", "proof"],
	},
	properties: {
		description: { type: "string", title: "Scope" },
		name: { type: "string", title: "Book" },
		receipt: {
			type: "string",
			title: "Receipt id",
			"x-morphe": { role: "provenance" },
		},
		state: {
			type: "string",
			title: "Attention",
			"x-morphe": { strategy: "status", intents: { blocked: "caution" } },
		},
		worklist: {
			type: "array",
			title: "Obligations",
			items: {
				type: "object",
				properties: { subject: { type: "string", title: "Subject" } },
			},
		},
		seal: {
			type: "string",
			title: "Testimony seal",
			"x-morphe": { role: "seal" },
		},
		proof: {
			type: "object",
			title: "Receipt",
			"x-morphe": { strategy: "linked-ref", role: "provenance" },
		},
	},
};

const PANE_DATA = {
	description: "Quarter close",
	name: "Main book",
	receipt: "receipt-798",
	state: "blocked",
	worklist: [{ subject: "VAT return" }],
	seal: "seal-798",
	proof: { label: "Open receipt", href: "/receipts/798" },
};

describe("operator-first surface compilation (KRA-798)", () => {
	it("matches the Python stage-one identity/context contract", () => {
		const spec = buildSurface(PANE_SCHEMA, PANE_DATA, { root: PANE_SCHEMA });
		const identity = spec.children.find((child) => child.path === "$.name");
		expect(identity).toMatchObject({ text_as: "caption", emphasis: "muted", intent: "folio" });

		const requiredOnly: JsonSchema = {
			type: "object",
			title: "Code review",
			required: ["code"],
			properties: { code: { type: "string" } },
		};
		const code = buildSurface(requiredOnly, { code: "LEDGER" }, { root: requiredOnly }).children[0];
		expect(code?.text_as).toBeUndefined();
		expect(code?.emphasis).toBeUndefined();
	});

	it("matches the Python stage-two decision order and D8 audit lanes", () => {
		const node = emitNode(buildSurface(PANE_SCHEMA, PANE_DATA, { root: PANE_SCHEMA }));
		expect(validateNodeDocument(node).ok).toBe(true);
		if (node.kind !== "frame") throw new Error("expected a page frame");
		const section = node.children[0];
		if (section?.kind !== "stack") throw new Error("expected a page section");

		expect(section.children[0]).toEqual({
			kind: "text",
			value: "Obligation review",
			as: "heading",
			level: 1,
		});
		expect(section.children[1]).toEqual({
			kind: "text",
			value: "Main book",
			as: "caption",
			emphasis: "muted",
			intent: "folio",
		});
		expect(section.children.slice(2, 5).map((child) => child.kind)).toEqual([
			"grid",
			"stack",
			"grid",
		]);
		const attention = section.children[2];
		if (attention?.kind !== "grid") throw new Error("expected labelled attention grid");
		expect(attention.children[1]?.kind).toBe("status");

		const footer = section.children.at(-1);
		if (footer?.kind !== "compound") throw new Error("expected provenance footer");
		expect(footer.name).toBe("ProvenanceFooter");
		expect(footer.slots?.facts?.map((child) => child.kind)).toEqual(["stack"]);
		expect(footer.slots?.seals?.map((child) => child.kind)).toEqual(["stack"]);
		expect(footer.slots?.links?.map((child) => child.kind)).toEqual(["link"]);

		const encoded = JSON.stringify(node);
		for (const signedValue of ["receipt-798", "seal-798", "Open receipt", "/receipts/798"]) {
			expect(encoded.match(new RegExp(signedValue.replaceAll("/", "\\/"), "g"))).toHaveLength(1);
		}
		expect(encoded).not.toContain('"as":"display"');
	});

	it("registers a native-disclosure ProvenanceFooter without a Frame reset", () => {
		expect(PROMOTED_COMPOUNDS.map((definition) => definition.name)).toContain("ProvenanceFooter");
		const expanded = registry.expand({
			kind: "compound",
			name: "ProvenanceFooter",
			args: { heading: { kind: "text", value: "Audit details", as: "caption" } },
			slots: { facts: [{ kind: "text", value: "receipt-798", as: "caption" }] },
		});
		expect(expanded.kind).toBe("disclosure");
		if (expanded.kind !== "disclosure") throw new Error("expected a disclosure");
		expect(expanded.summary).toBe("Audit proof");
		expect(expanded.children[0]).toEqual({
			kind: "text",
			value: "Audit details",
			as: "caption",
		});
		expect(JSON.stringify(expanded)).not.toContain('"kind":"frame"');
	});

	it("emits exactly one h1 claim for a root with nested records", () => {
		const schema: JsonSchema = {
			type: "object",
			title: "Root task",
			properties: {
				name: { type: "string" },
				nested: {
					type: "object",
					title: "Nested detail",
					"x-morphe": { collapse: false },
					properties: { value: { type: "string" } },
				},
			},
		};
		const node = emitNode(
			buildSurface(schema, { name: "Context", nested: { value: "detail" } }, { root: schema }),
		);
		const h1Nodes: Node[] = [];
		const visit = (value: unknown): void => {
			if (Array.isArray(value)) {
				for (const child of value) visit(child);
			} else if (value !== null && typeof value === "object") {
				const record = value as Record<string, unknown>;
				if (record.kind === "text" && record.level === 1) h1Nodes.push(value as Node);
				for (const child of Object.values(record)) visit(child);
			}
		};
		visit(node);
		expect(h1Nodes).toEqual([{ kind: "text", value: "Root task", as: "heading", level: 1 }]);
	});

	it("gives every closed root strategy exactly one task h1", () => {
		const strategies = [
			"scalar",
			"badge",
			"linked-ref",
			"diagnostic-node",
			"number",
			"status",
			"progress",
			"collapsed-section",
			"table",
			"card-stack",
			"kpi-row",
			"breakdown",
			"trail",
			"key-value",
		] as const;

		for (const strategy of strategies) {
			const node = emitNode(
				surfaceNode({
					path: "$",
					label: "Root task",
					strategy,
					value: strategy === "number" || strategy === "progress" ? 1 : "value",
					...(strategy === "linked-ref" ? { href: "/detail" } : {}),
					heading: false,
				}),
			);
			const h1Nodes: Node[] = [];
			const visit = (value: unknown): void => {
				if (Array.isArray(value)) {
					for (const child of value) visit(child);
				} else if (value !== null && typeof value === "object") {
					const record = value as Record<string, unknown>;
					if (record.kind === "text" && record.level === 1) h1Nodes.push(value as Node);
					for (const child of Object.values(record)) visit(child);
				}
			};
			visit(node);
			expect(h1Nodes, strategy).toEqual([
				{ kind: "text", value: "Root task", as: "heading", level: 1 },
			]);
			expect(validateNodeDocument(node).ok, strategy).toBe(true);
		}
	});

	it("lets explicit provenance outrank inferred name context", () => {
		const schema: JsonSchema = {
			type: "object",
			title: "Identity audit",
			properties: {
				name: {
					type: "string",
					title: "Organization id",
					"x-morphe": { role: "provenance" },
				},
			},
		};
		const node = emitNode(buildSurface(schema, { name: "org-798" }, { root: schema }));
		if (node.kind !== "frame") throw new Error("expected root frame");
		const section = node.children[0];
		if (section?.kind !== "stack") throw new Error("expected root section");
		expect(section.children).toHaveLength(2);
		const footer = section.children[1];
		if (footer?.kind !== "compound") throw new Error("expected provenance footer");
		expect(footer.name).toBe("ProvenanceFooter");
		expect(JSON.stringify(footer).match(/Organization id/g)).toHaveLength(1);
		expect(JSON.stringify(footer).match(/org-798/g)).toHaveLength(1);
	});

	it("keeps a nested provenance container and hoists its diagnostics exactly once", () => {
		const schema: JsonSchema = {
			type: "object",
			title: "Bundle review",
			"x-morphe": { order: ["proof"] },
			properties: {
				proof: {
					type: "object",
					title: "Receipt bundle",
					"x-morphe": { role: "provenance", order: ["receipt"] },
					properties: { receipt: { type: "string", title: "Receipt id" } },
				},
			},
		};
		const spec = buildSurface(
			schema,
			{ proof: { receipt: "bundle-receipt-798" } },
			{
				root: schema,
				diagnostics: [
					{
						code: "BUNDLE_RECEIPT_REVIEW",
						severity: "warning",
						path: "$.proof.receipt",
						message: "Review the nested receipt.",
					},
				],
			},
		);
		expect(spec.children[0]?.intent).toBe("provenance");

		const node = emitNode(spec);
		if (node.kind !== "frame") throw new Error("expected root frame");
		const section = node.children[0];
		if (section?.kind !== "stack") throw new Error("expected root section");
		const alert = section.children[1];
		const footer = section.children[2];
		if (alert?.kind !== "inline-alert") throw new Error("expected visible alert");
		if (footer?.kind !== "compound") throw new Error("expected provenance footer");
		const encoded = JSON.stringify(node);

		expect(alert.title).toBe("Receipt id: BUNDLE_RECEIPT_REVIEW");
		expect(footer.name).toBe("ProvenanceFooter");
		expect(JSON.stringify(footer)).not.toContain("BUNDLE_RECEIPT_REVIEW");
		expect(encoded.match(/BUNDLE_RECEIPT_REVIEW/g)).toHaveLength(1);
		expect(encoded.match(/Receipt bundle/g)).toHaveLength(1);
		expect(encoded.match(/bundle-receipt-798/g)).toHaveLength(1);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("does not repeat an intrinsic diagnostic node inside audit proof", () => {
		const schema: JsonSchema = {
			type: "object",
			title: "Bundle review",
			properties: {
				proof: {
					type: "object",
					title: "Receipt bundle",
					"x-morphe": { role: "provenance" },
					properties: { mystery: { title: "Mystery" } },
				},
			},
		};

		const node = emitNode(buildSurface(schema, { proof: { mystery: {} } }, { root: schema }));
		if (node.kind !== "frame") throw new Error("expected root frame");
		const section = node.children[0];
		if (section?.kind !== "stack") throw new Error("expected root section");
		const alert = section.children[1];
		const footer = section.children.at(-1);
		if (alert?.kind !== "inline-alert") throw new Error("expected visible alert");
		if (footer?.kind !== "compound") throw new Error("expected provenance footer");
		const encoded = JSON.stringify(node);

		expect(encoded.match(/UNRENDERABLE/g)).toHaveLength(1);
		expect(encoded.match(/unrenderable: unknown construct/g)).toHaveLength(1);
		expect(JSON.stringify(footer)).not.toContain("UNRENDERABLE");
		expect(JSON.stringify(footer)).not.toContain("unrenderable: unknown construct");
		expect(alert.title).toBe("Mystery: UNRENDERABLE");
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("puts a diagnosed child before the primary worklist", () => {
		const node = emitNode(
			surfaceNode({
				path: "$",
				label: "Decision review",
				strategy: "record-card",
				children: [
					surfaceNode({
						path: "$.worklist",
						label: "Worklist",
						strategy: "table",
						emphasis: "strong",
					}),
					surfaceNode({
						path: "$.detail",
						label: "Changed detail",
						strategy: "scalar",
						value: "changed",
						diagnostics: [
							{
								code: "FIELD_REVIEW",
								severity: "warning",
								path: "$.detail",
								message: "Review the changed detail.",
								repair_hint: "Confirm it before dispatch.",
							},
						],
					}),
				],
			}),
		);
		const encoded = JSON.stringify(node);
		expect(encoded.indexOf("FIELD_REVIEW")).toBeLessThan(encoded.indexOf("Worklist"));
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("keeps provenance diagnostics visible outside audit proof exactly once", () => {
		const node = emitNode(
			surfaceNode({
				path: "$",
				label: "Receipt review",
				strategy: "record-card",
				children: [
					surfaceNode({
						path: "$.receipt",
						label: "Receipt id",
						strategy: "scalar",
						value: "receipt-798",
						intent: "provenance",
						diagnostics: [
							{
								code: "SEAL_MISMATCH",
								severity: "warning",
								path: "$.receipt",
								message: "Receipt signature does not match.",
								repair_hint: "Request a fresh receipt.",
							},
						],
					}),
				],
			}),
		);
		if (node.kind !== "frame") throw new Error("expected root frame");
		const section = node.children[0];
		if (section?.kind !== "stack") throw new Error("expected root section");
		const alert = section.children[1];
		const footer = section.children[2];
		if (alert?.kind !== "inline-alert") throw new Error("expected visible alert");
		if (footer?.kind !== "compound") throw new Error("expected provenance footer");
		expect(alert.title).toBe("Receipt id: SEAL_MISMATCH");
		expect(alert.repair).toBe("Request a fresh receipt.");
		expect(JSON.stringify(footer)).not.toContain("SEAL_MISMATCH");
		expect(JSON.stringify(node).match(/SEAL_MISMATCH/g)).toHaveLength(1);
		expect(JSON.stringify(node).match(/receipt-798/g)).toHaveLength(1);
		expect(validateNodeDocument(node).ok).toBe(true);
	});

	it("puts trail provenance diagnostics before the closed footer exactly once", () => {
		const node = emitNode(
			surfaceNode({
				path: "$",
				label: "Audit trail",
				strategy: "trail",
				items: [
					surfaceNode({
						path: "$.events[0]",
						label: "Event",
						strategy: "record-card",
						children: [
							surfaceNode({
								path: "$.events[0].receipt",
								label: "Receipt",
								strategy: "scalar",
								value: "event-receipt-798",
								intent: "provenance",
								diagnostics: [
									{
										code: "EVENT_RECEIPT_REVIEW",
										severity: "warning",
										path: "$.events[0].receipt",
										message: "Review the event receipt.",
									},
								],
							}),
						],
					}),
				],
			}),
		);
		const encoded = JSON.stringify(node);
		expect(encoded.match(/EVENT_RECEIPT_REVIEW/g)).toHaveLength(1);
		expect(encoded.match(/event-receipt-798/g)).toHaveLength(1);
		expect(encoded.indexOf("EVENT_RECEIPT_REVIEW")).toBeLessThan(
			encoded.indexOf("ProvenanceFooter"),
		);
		expect(validateNodeDocument(node).ok).toBe(true);
	});
});

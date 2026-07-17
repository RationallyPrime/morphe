import { hasVisibleLabelText } from "../grammar/labels.js";
import type {
	CompoundRef,
	Grid,
	InlineAlert,
	Node,
	NumberNode,
	Spacer,
	Stack,
	Text,
} from "../grammar/types.js";
import {
	type CompilerDiagnostic,
	pythonScalarText,
	pythonStrip,
	type SurfaceNode,
	scalarNumberKind,
} from "./spec.js";

const LEAF_STRATEGIES = new Set([
	"scalar",
	"badge",
	"linked-ref",
	"diagnostic-node",
	"number",
	"status",
	"progress",
]);
const CONTAINER_STRATEGIES = new Set([
	"record-card",
	"collapsed-section",
	"table",
	"card-stack",
	"kpi-row",
]);
const STATUS_TONES = new Set(["success", "caution", "info", "neutral"]);

export interface EmitLimits {
	readonly maxSpecDepth: number;
	readonly maxEmittedNodes: number;
}

export const DEFAULT_EMIT_LIMITS: EmitLimits = Object.freeze({
	maxSpecDepth: 64,
	maxEmittedNodes: 250_000,
});

export class SurfaceEmitLimitError extends Error {
	constructor(
		readonly code: "COMPILER_DEPTH_LIMIT" | "COMPILER_EMITTED_NODE_LIMIT",
		message: string,
	) {
		super(message);
	}
}

function limitsWith(overrides?: Partial<EmitLimits>): EmitLimits {
	return { ...DEFAULT_EMIT_LIMITS, ...overrides };
}

function assertSpecDepth(root: SurfaceNode, maxDepth: number): void {
	const pending: Array<{ readonly node: SurfaceNode; readonly depth: number }> = [
		{ node: root, depth: 0 },
	];
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		if (current.depth > maxDepth) {
			throw new SurfaceEmitLimitError(
				"COMPILER_DEPTH_LIMIT",
				`surface IR depth exceeds ${maxDepth}`,
			);
		}
		for (const child of [...current.node.children, ...current.node.items]) {
			pending.push({ node: child, depth: current.depth + 1 });
		}
	}
}

function emittedNodeCount(root: Node, limit: number): number {
	let count = 0;
	const pending: unknown[] = [root];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === null || typeof current !== "object") continue;
		if (Array.isArray(current)) {
			pending.push(...current);
			continue;
		}
		const record = current as Record<string, unknown>;
		if (typeof record.kind === "string") {
			count += 1;
			if (count > limit) return count;
		}
		pending.push(...Object.values(record));
	}
	return count;
}

/** Mechanical SurfaceNode -> grammar Node lowering with explicit output bounds. */
export function emitNode(spec: SurfaceNode, overrides?: Partial<EmitLimits>): Node {
	const limits = limitsWith(overrides);
	assertSpecDepth(spec, limits.maxSpecDepth);
	const node = emit(spec);
	if (emittedNodeCount(node, limits.maxEmittedNodes) > limits.maxEmittedNodes) {
		throw new SurfaceEmitLimitError(
			"COMPILER_EMITTED_NODE_LIMIT",
			`emitted tree exceeds ${limits.maxEmittedNodes} nodes`,
		);
	}
	return node;
}

function emit(spec: SurfaceNode): Node {
	if (LEAF_STRATEGIES.has(spec.strategy)) return leaf(spec);
	if (spec.strategy === "collapsed-section") return collapsible(spec);
	if (spec.strategy === "table") return table(spec);
	if (spec.strategy === "kpi-row") return kpiRow(spec);
	if (spec.strategy === "card-stack") {
		const fields = spec.items.map(field);
		return section(spec, fields.length > 0 ? fields : [emptyCollection(spec)]);
	}
	return frame(spec);
}

function leaf(spec: SurfaceNode): Node {
	switch (spec.strategy) {
		case "scalar":
			return scalar(spec);
		case "badge":
			return badge(spec);
		case "linked-ref":
			return link(spec);
		case "number":
			return numberNode(spec);
		case "status":
			return status(spec);
		case "progress":
			return progress(spec);
		default:
			return diagnosticNode(spec);
	}
}

function scalar(spec: SurfaceNode): Text {
	return {
		kind: "text",
		value: pythonScalarText(spec.value ?? null, scalarNumberKind(spec)),
		as: spec.text_as ?? "body",
		...(spec.emphasis === undefined ? {} : { emphasis: spec.emphasis }),
		...(spec.intent === undefined ? {} : { intent: spec.intent }),
		...(spec.numeric ? { numeric: true } : {}),
		...(spec.polarity === undefined ? {} : { polarity: spec.polarity }),
	};
}

function badge(spec: SurfaceNode): Node {
	return {
		kind: "badge",
		label: pythonScalarText(spec.value ?? null, scalarNumberKind(spec)),
		intent: spec.intent ?? "neutral",
	};
}

function link(spec: SurfaceNode): Node {
	if (!spec.href) {
		return { kind: "text", value: pythonScalarText(spec.value ?? null), as: "body" };
	}
	return {
		kind: "link",
		href: spec.href,
		label: spec.label,
		...(spec.intent === undefined ? {} : { intent: spec.intent }),
	};
}

function status(spec: SurfaceNode): Node {
	return {
		kind: "status",
		tone: statusTone(spec.intent),
		signal: {
			text: normalizeVisibleLabelText(pythonScalarText(spec.value ?? null), "—"),
		},
	};
}

function progress(spec: SurfaceNode): Node {
	return {
		kind: "progress",
		label: normalizeVisibleLabelText(spec.label, "Progress"),
		...(spec.value === null || spec.value === undefined ? {} : { value: spec.value as number }),
		...(spec.intent === undefined ? {} : { intent: spec.intent }),
	};
}

function diagnosticNode(spec: SurfaceNode): InlineAlert {
	return {
		kind: "inline-alert",
		tone: "caution",
		title: spec.label,
		detail: pythonScalarText(spec.value ?? null),
	};
}

function numberNode(spec: SurfaceNode): NumberNode {
	return {
		kind: "number",
		value: spec.value as number,
		...(spec.number_format === undefined ? {} : { format: spec.number_format }),
		...(spec.currency === undefined ? {} : { currency: spec.currency }),
		...(spec.intent === undefined ? {} : { intent: spec.intent }),
		...(spec.emphasis === undefined ? {} : { emphasis: spec.emphasis }),
	};
}

function statusTone(intent: string | undefined): "success" | "caution" | "info" | "neutral" {
	return intent !== undefined && STATUS_TONES.has(intent)
		? (intent as "success" | "caution" | "info" | "neutral")
		: "neutral";
}

function kpiRow(spec: SurfaceNode): Node {
	if (spec.items.length === 0) return section(spec, [emptyCollection(spec)]);
	const grid: Grid = {
		kind: "grid",
		role: "list",
		minTrack: "narrow",
		children: spec.items.map(signalCard),
	};
	return section(spec, [grid]);
}

function signalCard(item: SurfaceNode): Node {
	if (item.strategy === "diagnostic-node") return leaf(item);
	const kicker: Text = {
		kind: "text",
		value: item.kicker ?? "",
		as: "caption",
		intent: "folio",
	};
	const title: Text = { kind: "text", value: item.label, as: "subheading" };
	let measure: Node;
	if (item.strategy === "number") {
		measure = { ...numberNode(item), emphasis: "strong" };
	} else {
		measure = {
			kind: "text",
			value: pythonScalarText(item.value ?? null, scalarNumberKind(item)),
			as: "body",
			emphasis: "strong",
			...(item.intent === undefined ? {} : { intent: item.intent }),
		};
	}
	return {
		kind: "compound",
		name: "SignalCard",
		args: { kicker, title, measure },
		slots: { body: item.diagnostics.map(alert) },
	} satisfies CompoundRef;
}

function frame(spec: SurfaceNode): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		children: [section(spec, fields(spec.children))],
	};
}

function collapsible(spec: SurfaceNode): Node {
	const target = section(spec, fields(spec.children), false);
	const emphasized: Stack =
		spec.emphasis === undefined ? target : { ...target, emphasis: spec.emphasis };
	return {
		kind: "within",
		id: spec.path,
		dimension: "collapse",
		range: [0, 1],
		default: spec.collapse ? 1 : 0,
		summary: normalizeVisibleLabelText(spec.label, "Details"),
		target: emphasized,
	};
}

function table(spec: SurfaceNode): Node {
	if (spec.items.length === 0) return section(spec, [emptyCollection(spec)]);
	const columns = spec.children.length > 0 ? spec.children : (spec.items[0]?.children ?? []);
	const body = spec.items.flatMap((item) => tableRow(item, columns.length));
	const rows = columns.length > 0 ? [tableHeader(columns), ...body] : body;
	const grid: Grid = {
		kind: "grid",
		role: "list",
		children: rows,
		...(columns.length > 0 ? { columns: columns.map(() => "flexible" as const), ruled: true } : {}),
	};
	return section(spec, [grid]);
}

function tableHeader(columns: readonly SurfaceNode[]): Grid {
	return { kind: "grid", role: "inline", children: columns.map(headerCell) };
}

function headerCell(column: SurfaceNode): Text {
	return {
		...caption(column.label),
		...(column.intent === undefined ? {} : { intent: column.intent }),
	};
}

function tableRow(row: SurfaceNode, columnCount: number): Node[] {
	const cells = row.children.length > 0 ? row.children.map(tableCell) : [tableCell(row)];
	while (cells.length < columnCount) cells.push(emptyCell());
	const grid: Grid = { kind: "grid", role: "inline", children: cells };
	const alerts = row.strategy === "diagnostic-node" ? [] : row.diagnostics.map(alert);
	return [grid, ...alerts];
}

function tableCell(spec: SurfaceNode): Node {
	if (CONTAINER_STRATEGIES.has(spec.strategy)) return emit(spec);
	const lowered = leaf(spec);
	// Empty Text intentionally renders with display:none. In a grid that removes
	// the item box and auto-placement shifts every following cell one track left.
	// Spacer is the grammar's data-free, aria-hidden structural placeholder.
	const inner = lowered.kind === "text" && lowered.value === "" ? emptyCell() : lowered;
	const alerts = spec.strategy === "diagnostic-node" ? [] : spec.diagnostics.map(alert);
	return alerts.length === 0
		? inner
		: { kind: "stack", role: "field-group", children: [inner, ...alerts] };
}

function emptyCell(): Spacer {
	return { kind: "spacer", size: "xs" };
}

function section(spec: SurfaceNode, children: readonly Node[], includeHeading = true): Stack {
	const head = includeHeading && spec.heading ? [heading(spec.label, spec.emphasis)] : [];
	return {
		kind: "stack",
		role: "section",
		children: [...head, ...spec.diagnostics.map(alert), ...children],
	};
}

function heading(label: string, emphasis: SurfaceNode["emphasis"]): Text {
	return {
		kind: "text",
		value: label,
		as: "heading",
		...(emphasis === undefined ? {} : { emphasis }),
	};
}

function fields(specs: readonly SurfaceNode[]): Node[] {
	const nodes: Node[] = [];
	const pending: SurfaceNode[] = [];
	for (const spec of specs) {
		if (definitionCandidate(spec)) {
			pending.push(spec);
			continue;
		}
		flushDefinitions(nodes, pending);
		nodes.push(field(spec));
	}
	flushDefinitions(nodes, pending);
	return nodes;
}

function flushDefinitions(nodes: Node[], pending: SurfaceNode[]): void {
	if (pending.length === 0) return;
	nodes.push(definitionGrid(pending));
	pending.length = 0;
}

function definitionCandidate(spec: SurfaceNode): boolean {
	if (spec.strategy === "diagnostic-node" || spec.strategy === "progress") return false;
	return LEAF_STRATEGIES.has(spec.strategy) && spec.text_as === undefined;
}

function definitionGrid(specs: readonly SurfaceNode[]): Grid {
	const children: Node[] = [];
	for (const spec of specs) children.push(caption(spec.label), definitionValue(spec));
	return {
		kind: "grid",
		role: "field-group",
		columns: ["content", "flexible"],
		children,
	};
}

function definitionValue(spec: SurfaceNode): Node {
	const inner = leaf(spec);
	const alerts = spec.strategy === "diagnostic-node" ? [] : spec.diagnostics.map(alert);
	return alerts.length === 0
		? inner
		: { kind: "stack", role: "field-group", children: [inner, ...alerts] };
}

function field(spec: SurfaceNode): Node {
	const inner = emit(spec);
	if (CONTAINER_STRATEGIES.has(spec.strategy)) return inner;
	const alerts = spec.strategy === "diagnostic-node" ? [] : spec.diagnostics.map(alert);
	if (spec.text_as !== undefined || spec.strategy === "progress") {
		return alerts.length === 0
			? inner
			: { kind: "stack", role: "field-group", children: [inner, ...alerts] };
	}
	return {
		kind: "stack",
		role: "field-group",
		children: [caption(spec.label), inner, ...alerts],
	};
}

function emptyCollection(spec: SurfaceNode): Text {
	const label = pythonStrip(spec.label).toLowerCase();
	return {
		kind: "text",
		value: `No ${label || "items"}.`,
		as: "caption",
		intent: "neutral",
	};
}

function caption(label: string): Text {
	return { kind: "text", value: label, as: "caption", intent: "neutral" };
}

function alert(diagnostic: CompilerDiagnostic): InlineAlert {
	return {
		kind: "inline-alert",
		tone: diagnostic.severity === "info" ? "info" : "caution",
		title: diagnostic.code,
		detail: diagnostic.message,
	};
}

function normalizeVisibleLabelText(value: string, fallback: string): string {
	// Pin Python's exact whitespace semantics during the migration parity window.
	const normalized = pythonStrip(value);
	if (hasVisibleLabelText(normalized)) return normalized;
	const normalizedFallback = pythonStrip(fallback);
	if (!hasVisibleLabelText(normalizedFallback)) {
		throw new TypeError("visible-label fallback must contain a perceivable code point");
	}
	return normalizedFallback;
}

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
	DEFAULT_TEMPORAL_POLICY,
	displayScalarText,
	pythonScalarText,
	pythonStrip,
	type SurfaceNode,
	scalarNumberKind,
	type TemporalPolicy,
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
	"entity-header",
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

/**
 * Per-compile presentation context threaded through the pure lowering. Carries the
 * temporal policy and the render-time clock `relative` reads. Threaded explicitly (no
 * module-level state) so a compile is reentrant and deterministic per (spec, context).
 */
export interface EmitContext {
	readonly temporalPolicy: TemporalPolicy;
	readonly now: () => Date;
}

export const DEFAULT_EMIT_CONTEXT: EmitContext = Object.freeze({
	temporalPolicy: DEFAULT_TEMPORAL_POLICY,
	now: (): Date => new Date(),
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
export function emitNode(
	spec: SurfaceNode,
	overrides?: Partial<EmitLimits>,
	context: EmitContext = DEFAULT_EMIT_CONTEXT,
): Node {
	const limits = limitsWith(overrides);
	assertSpecDepth(spec, limits.maxSpecDepth);
	const node = emit(spec, context);
	if (emittedNodeCount(node, limits.maxEmittedNodes) > limits.maxEmittedNodes) {
		throw new SurfaceEmitLimitError(
			"COMPILER_EMITTED_NODE_LIMIT",
			`emitted tree exceeds ${limits.maxEmittedNodes} nodes`,
		);
	}
	return node;
}

function emit(spec: SurfaceNode, ctx: EmitContext): Node {
	if (LEAF_STRATEGIES.has(spec.strategy)) return leaf(spec, ctx);
	if (spec.strategy === "collapsed-section") return collapsible(spec, ctx);
	if (spec.strategy === "table") return table(spec, ctx);
	if (spec.strategy === "kpi-row") return kpiRow(spec, ctx);
	if (spec.strategy === "entity-header") return entityHeader(spec, ctx);
	if (spec.strategy === "card-stack") {
		const built = spec.items.map((item) => field(item, ctx));
		return section(spec, built.length > 0 ? built : [emptyCollection(spec)]);
	}
	return frame(spec, ctx);
}

function leaf(spec: SurfaceNode, ctx: EmitContext): Node {
	switch (spec.strategy) {
		case "scalar":
			return scalar(spec, ctx);
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

function scalar(spec: SurfaceNode, ctx: EmitContext): Text {
	return {
		kind: "text",
		value: displayScalarText(
			spec.value ?? null,
			scalarNumberKind(spec),
			ctx.temporalPolicy,
			ctx.now,
		),
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

function kpiRow(spec: SurfaceNode, ctx: EmitContext): Node {
	if (spec.items.length === 0) return section(spec, [emptyCollection(spec)]);
	// The SignalCard tiles ride the promoted StatBand compound: the band owns the
	// auto-fit narrow-track grid (no `columns` means it wraps) that packs the KPI band.
	// The factory splices the `tiles` slot inline as the grid's children.
	const band: CompoundRef = {
		kind: "compound",
		name: "StatBand",
		args: {},
		slots: { tiles: spec.items.map((item) => signalCard(item, ctx)) },
	};
	return section(spec, [band]);
}

function signalCard(item: SurfaceNode, ctx: EmitContext): Node {
	if (item.strategy === "diagnostic-node") return leaf(item, ctx);
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
			value: displayScalarText(
				item.value ?? null,
				scalarNumberKind(item),
				ctx.temporalPolicy,
				ctx.now,
			),
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

function isTitleCandidate(child: SurfaceNode): boolean {
	// See the Python twin: in practice this selects the first string scalar; the
	// heading/display register clause stays for an explicitly authored one.
	if (child.strategy !== "scalar") return false;
	return (
		child.text_as === "display" || child.text_as === "heading" || typeof child.value === "string"
	);
}

function slotLeaf(spec: SurfaceNode, ctx: EmitContext): Node {
	const inner = leaf(spec, ctx);
	const alerts = spec.strategy === "diagnostic-node" ? [] : spec.diagnostics.map(alert);
	return alerts.length === 0
		? inner
		: { kind: "stack", role: "field-group", children: [inner, ...alerts] };
}

function entityHeader(spec: SurfaceNode, ctx: EmitContext): Node {
	// One deterministic classification pass in document order, mirroring the Python
	// twin exactly: explicit `role: provenance` wins; then first number is the key
	// figure; then status/badge feed signal; then the first title candidate; the
	// rest are meta facts.
	const kicker: Text = { kind: "text", value: spec.label, as: "caption", intent: "folio" };
	const provenance: Node[] = [];
	const signal: Node[] = [];
	const metaChildren: SurfaceNode[] = [];
	let keyFigure: SurfaceNode | undefined;
	let titleChild: SurfaceNode | undefined;
	for (const child of spec.children) {
		if (child.intent === "provenance") {
			provenance.push(slotLeaf(child, ctx));
		} else if (child.strategy === "number" && keyFigure === undefined) {
			keyFigure = child;
		} else if (child.strategy === "status" || child.strategy === "badge") {
			signal.push(slotLeaf(child, ctx));
		} else if (titleChild === undefined && isTitleCandidate(child)) {
			titleChild = child;
		} else {
			metaChildren.push(child);
		}
	}
	const title: Text = {
		kind: "text",
		value:
			titleChild === undefined
				? spec.label
				: displayScalarText(
						titleChild.value ?? null,
						scalarNumberKind(titleChild),
						ctx.temporalPolicy,
						ctx.now,
					),
		as: "heading",
	};
	const args: Record<string, Node> = { kicker, title };
	if (keyFigure !== undefined) {
		args.keyFigure = { ...numberNode(keyFigure), emphasis: "strong" };
	}
	// Diagnostics on the node itself and on the two children promoted to BARE args
	// (title, keyFigure) would otherwise lose their alert path. Surface them all at
	// the head of the meta row, in document order, so nothing signed is dropped (D8).
	const promoted: SurfaceNode[] = [
		spec,
		...(titleChild === undefined ? [] : [titleChild]),
		...(keyFigure === undefined ? [] : [keyFigure]),
	];
	const headAlerts = promoted.flatMap((node) => node.diagnostics.map(alert));
	const meta: Node[] = [...headAlerts, ...fields(metaChildren, ctx)];
	return {
		kind: "compound",
		name: "EntityHeader",
		args,
		slots: { signal, meta, provenance },
	} satisfies CompoundRef;
}

function frame(spec: SurfaceNode, ctx: EmitContext): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		children: [section(spec, fields(spec.children, ctx))],
	};
}

function collapsible(spec: SurfaceNode, ctx: EmitContext): Node {
	const target = section(spec, fields(spec.children, ctx), false);
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

function table(spec: SurfaceNode, ctx: EmitContext): Node {
	if (spec.items.length === 0) return section(spec, [emptyCollection(spec)]);
	const columns = spec.children.length > 0 ? spec.children : (spec.items[0]?.children ?? []);
	const body = spec.items.flatMap((item) => tableRow(item, columns.length, ctx));
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

function tableRow(row: SurfaceNode, columnCount: number, ctx: EmitContext): Node[] {
	const cells =
		row.children.length > 0
			? row.children.map((cell) => tableCell(cell, ctx))
			: [tableCell(row, ctx)];
	while (cells.length < columnCount) cells.push(emptyCell());
	const grid: Grid = { kind: "grid", role: "inline", children: cells };
	const alerts = row.strategy === "diagnostic-node" ? [] : row.diagnostics.map(alert);
	return [grid, ...alerts];
}

function tableCell(spec: SurfaceNode, ctx: EmitContext): Node {
	if (CONTAINER_STRATEGIES.has(spec.strategy)) return emit(spec, ctx);
	const lowered = leaf(spec, ctx);
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

function fields(specs: readonly SurfaceNode[], ctx: EmitContext): Node[] {
	const nodes: Node[] = [];
	const pending: SurfaceNode[] = [];
	for (const spec of specs) {
		if (definitionCandidate(spec)) {
			pending.push(spec);
			continue;
		}
		flushDefinitions(nodes, pending, ctx);
		nodes.push(field(spec, ctx));
	}
	flushDefinitions(nodes, pending, ctx);
	return nodes;
}

function flushDefinitions(nodes: Node[], pending: SurfaceNode[], ctx: EmitContext): void {
	if (pending.length === 0) return;
	nodes.push(definitionGrid(pending, ctx));
	pending.length = 0;
}

function definitionCandidate(spec: SurfaceNode): boolean {
	if (spec.strategy === "diagnostic-node" || spec.strategy === "progress") return false;
	return LEAF_STRATEGIES.has(spec.strategy) && spec.text_as === undefined;
}

function definitionGrid(specs: readonly SurfaceNode[], ctx: EmitContext): Grid {
	const children: Node[] = [];
	for (const spec of specs) children.push(caption(spec.label), definitionValue(spec, ctx));
	return {
		kind: "grid",
		role: "field-group",
		columns: ["content", "flexible"],
		children,
	};
}

function definitionValue(spec: SurfaceNode, ctx: EmitContext): Node {
	const inner = leaf(spec, ctx);
	const alerts = spec.strategy === "diagnostic-node" ? [] : spec.diagnostics.map(alert);
	return alerts.length === 0
		? inner
		: { kind: "stack", role: "field-group", children: [inner, ...alerts] };
}

function field(spec: SurfaceNode, ctx: EmitContext): Node {
	const inner = emit(spec, ctx);
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

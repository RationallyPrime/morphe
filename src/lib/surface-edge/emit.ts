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
	"breakdown",
	"trail",
	"key-value",
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
	if (spec.strategy === "breakdown") return breakdown(spec, ctx);
	if (spec.strategy === "trail") return trail(spec, ctx);
	if (spec.strategy === "key-value") return keyValue(spec, ctx);
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
	// The corner signal (KRA-757 §3.2): a status/badge child authored on the cell
	// rides the card's `signal` slot — the band carries state, not just numbers.
	const signal = item.children
		.filter((child) => child.strategy === "status" || child.strategy === "badge")
		.map((child) => slotLeaf(child, ctx));
	return {
		kind: "compound",
		name: "SignalCard",
		args: { kicker, title, measure },
		// Signed KPI diagnostics stay visible through the body slot.
		slots: { signal, body: item.diagnostics.map(alert) },
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

function breakdownNumeric(child: SurfaceNode): number | null {
	// A row is numeric iff its built value is a real number (never a bool). A
	// non-numeric child keeps its value but degrades its progress to indeterminate.
	return typeof child.value === "number" ? child.value : null;
}

function breakdownRow(
	child: SurfaceNode,
	value: number | null,
	positiveSum: number,
	ctx: EmitContext,
): Node[] {
	// One proportion row: label + progress + value cluster (D8 keeps child alerts).
	const label: Text = { kind: "text", value: child.label, as: "caption", intent: "neutral" };
	const progressNode: Node = {
		kind: "progress",
		label: normalizeVisibleLabelText(child.label, "Proportion"),
		// IEEE-754 double division — identical in both compilers; clamped like the
		// `progress` strategy so a negative share degrades to an empty bar, not a lie.
		...(value !== null && positiveSum > 0
			? { value: Math.min(1, Math.max(0, value / positiveSum)) }
			: {}),
	};
	// A numeric child leads with a number node; a non-numeric one shows its natural
	// leaf (a NumberNode cannot hold a non-numeric value), with progress indeterminate.
	const valueNode = value !== null ? numberNode(child) : leaf(child, ctx);
	const cluster: Node = {
		kind: "cluster",
		role: "inline",
		align: "baseline",
		children: [label, progressNode, valueNode],
	};
	const alerts = child.strategy === "diagnostic-node" ? [] : child.diagnostics.map(alert);
	return [cluster, ...alerts];
}

function breakdown(spec: SurfaceNode, ctx: EmitContext): Node {
	const numbers = spec.children.map(breakdownNumeric);
	let positiveSum = 0;
	for (const n of numbers) {
		if (n !== null && n > 0) positiveSum += n;
	}
	const rows: Node[] = [];
	spec.children.forEach((child, index) => {
		rows.push(...breakdownRow(child, numbers[index] ?? null, positiveSum, ctx));
	});
	const args: Record<string, Node> = {};
	if (spec.heading) {
		args.title = { kind: "text", value: spec.label, as: "heading" };
	}
	// Node-level diagnostics ride the head of the rows slot so nothing signed is dropped.
	const headAlerts = spec.diagnostics.map(alert);
	return {
		kind: "compound",
		name: "Breakdown",
		args,
		slots: { rows: [...headAlerts, ...rows] },
	} satisfies CompoundRef;
}

function trailEntry(item: SurfaceNode, ctx: EmitContext): Node {
	// One event row -> one TrailEntry compound, mirroring the Python twin exactly.
	// Classification is deterministic and HINT-KEYED only (never name-based):
	// role:provenance -> provenance slot; a linked-ref child -> ref slot; a
	// status/badge child -> signals (the event's state chips); the first
	// temporal-hinted child -> stamp; the first string scalar among the rest ->
	// summary; EVERYTHING ELSE -> detail. Every valid event field has exactly one
	// home — nothing authored disappears (KRA-788 D3).
	let stamp: SurfaceNode | undefined;
	let summaryChild: SurfaceNode | undefined;
	const signals: Node[] = [];
	const detail: Node[] = [];
	const ref: Node[] = [];
	const provenance: Node[] = [];
	for (const child of item.children) {
		if (child.intent === "provenance") {
			provenance.push(slotLeaf(child, ctx));
		} else if (child.strategy === "linked-ref") {
			ref.push(slotLeaf(child, ctx));
		} else if (child.strategy === "status" || child.strategy === "badge") {
			signals.push(slotLeaf(child, ctx));
		} else if (stamp === undefined && child.temporal !== undefined) {
			stamp = child;
		} else if (summaryChild === undefined && isTitleCandidate(child)) {
			summaryChild = child;
		} else {
			// A detail field keeps its caption (the label IS the subject — an
			// unlabelled amount means nothing) and its own diagnostics; containers
			// self-head through the ordinary field path.
			detail.push(field(child, ctx));
		}
	}
	let summaryValue: string;
	if (summaryChild !== undefined) {
		summaryValue = displayScalarText(
			summaryChild.value ?? null,
			scalarNumberKind(summaryChild),
			ctx.temporalPolicy,
			ctx.now,
		);
	} else if (item.children.length === 0 && typeof item.value === "string") {
		summaryValue = displayScalarText(
			item.value,
			scalarNumberKind(item),
			ctx.temporalPolicy,
			ctx.now,
		);
	} else {
		summaryValue = item.label;
	}
	const args: Record<string, Node> = {
		summary: { kind: "text", value: summaryValue, as: "body" },
	};
	if (stamp !== undefined) {
		args.stamp = {
			kind: "text",
			value: displayScalarText(
				stamp.value ?? null,
				scalarNumberKind(stamp),
				ctx.temporalPolicy,
				ctx.now,
			),
			as: "caption",
			intent: "marginalia",
		};
	}
	// The event object itself and the children promoted to BARE args (stamp, summary)
	// would otherwise lose their alert path. Surface them at the provenance-footer head,
	// in document order, so nothing signed is dropped (D8).
	const promoted: SurfaceNode[] = [
		item,
		...(stamp === undefined ? [] : [stamp]),
		...(summaryChild === undefined ? [] : [summaryChild]),
	];
	const headAlerts = promoted.flatMap((node) =>
		node.strategy === "diagnostic-node" ? [] : node.diagnostics.map(alert),
	);
	return {
		kind: "compound",
		name: "TrailEntry",
		args,
		slots: { signals, detail, ref, provenance: [...headAlerts, ...provenance] },
	} satisfies CompoundRef;
}

function trail(spec: SurfaceNode, ctx: EmitContext): Node {
	const entries = spec.items.map((item) => trailEntry(item, ctx));
	return section(spec, entries.length > 0 ? entries : [emptyCollection(spec)]);
}

function keyValue(spec: SurfaceNode, ctx: EmitContext): Node {
	// Tier the object's children by HINT only (never name), mirroring the Python
	// twin: a child carrying an emphasis hint is a primary field; a role:provenance
	// child is a provenance field; everything else is secondary. Each tier renders
	// through the SAME definition-grid idiom the hint-free floor uses.
	const primary: SurfaceNode[] = [];
	const secondary: SurfaceNode[] = [];
	const provenance: SurfaceNode[] = [];
	for (const child of spec.children) {
		if (child.intent === "provenance") {
			provenance.push(child);
		} else if (child.emphasis !== undefined) {
			primary.push(child);
		} else {
			secondary.push(child);
		}
	}
	const nodeAlerts = spec.diagnostics.map(alert);
	const primaryFill: Node[] = [
		...nodeAlerts,
		...(primary.length > 0 ? [definitionGrid(primary, ctx)] : []),
	];
	return {
		kind: "compound",
		name: "KeyValuePanel",
		args: {},
		slots: {
			primary: primaryFill,
			secondary: secondary.length > 0 ? [definitionGrid(secondary, ctx)] : [],
			provenance: provenance.length > 0 ? [definitionGrid(provenance, ctx)] : [],
		},
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
	// Both row- and cell-level diagnostics stay visible (D8) as SIBLINGS of the row
	// grid, never wrappers: only a direct-child grid adopts the table's subgrid
	// tracks, so a wrapped row/cell lands in the first track and stacks vertically.
	// A cell diagnostic wrapped INSIDE its cell also inherits InlineAlert's inline
	// min-size floor and paints over dense neighbours (KRA-796). Lifting it to the
	// row lane lets the Grid rule span it 1/-1 across the full row instead. Row
	// diagnostics come first, then leaf cell diagnostics in cell order.
	if (row.strategy === "diagnostic-node") return [grid];
	const rowAlerts = row.diagnostics.map(alert);
	const cellAlerts = row.children.length > 0 ? liftedCellAlerts(row.children) : [];
	return [grid, ...rowAlerts, ...cellAlerts];
}

function liftedCellAlerts(cells: readonly SurfaceNode[]): InlineAlert[] {
	// Container cells self-head and render their own diagnostics; a diagnostic-node
	// cell already IS its alert. Only leaf cells' diagnostics lift to the row lane,
	// each carrying its field label so the copy stays anchored once it leaves the cell.
	const alerts: InlineAlert[] = [];
	for (const cell of cells) {
		if (CONTAINER_STRATEGIES.has(cell.strategy) || cell.strategy === "diagnostic-node") continue;
		for (const diagnostic of cell.diagnostics) alerts.push(labeledAlert(cell.label, diagnostic));
	}
	return alerts;
}

function tableCell(spec: SurfaceNode, ctx: EmitContext): Node {
	if (CONTAINER_STRATEGIES.has(spec.strategy)) return emit(spec, ctx);
	const lowered = leaf(spec, ctx);
	// Empty Text intentionally renders with display:none. In a grid that removes
	// the item box and auto-placement shifts every following cell one track left.
	// Spacer is the grammar's data-free, aria-hidden structural placeholder.
	//
	// Leaf cells render just their inner content — cell diagnostics are lifted to
	// the row diagnostics lane by `tableRow` (KRA-796), never wrapped here.
	return lowered.kind === "text" && lowered.value === "" ? emptyCell() : lowered;
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
	// The producer-authored next action renders as honest structure (KRA-757 §3.8):
	// authored vocabulary is never dead vocabulary, and the human action never
	// blurs into the machine detail.
	return {
		kind: "inline-alert",
		tone: diagnostic.severity === "info" ? "info" : "caution",
		title: diagnostic.code,
		detail: diagnostic.message,
		...(diagnostic.repair_hint === undefined ? {} : { repair: diagnostic.repair_hint }),
	};
}

function labeledAlert(label: string, diagnostic: CompilerDiagnostic): InlineAlert {
	// A cell diagnostic lifted out of its cell loses its spatial tie to the field,
	// so the title names the field it refers to: "<Field label>: <code>" (KRA-796).
	return {
		kind: "inline-alert",
		tone: diagnostic.severity === "info" ? "info" : "caution",
		title: label ? `${label}: ${diagnostic.code}` : diagnostic.code,
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

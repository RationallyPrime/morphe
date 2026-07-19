import type { IntentRef } from "../grammar/types.js";
import { type MorpheHint, type ParsedHint, parseHint } from "./hints.js";
import { isSchema, resolveRef, schemaType, unwrapNullable } from "./refs.js";
import { resolveStrategy } from "./resolve.js";
import {
	type CompilerDiagnostic,
	type JsonSchema,
	type NumberFormat,
	type Polarity,
	pythonJsonRepr,
	pythonScalarText,
	pythonStrip,
	type ScalarValue,
	type Strategy,
	type SurfaceNode,
	surfaceNode,
} from "./spec.js";

export const MAX_RECORD_DEPTH = 6;

export interface CompilerBuildLimits {
	readonly maxRecursionDepth: number;
	readonly maxSurfaceNodes: number;
}

export const DEFAULT_COMPILER_BUILD_LIMITS: CompilerBuildLimits = Object.freeze({
	maxRecursionDepth: 64,
	maxSurfaceNodes: 50_000,
});

export type DiagnosticInput = Omit<CompilerDiagnostic, "repair_hint"> & {
	readonly repair_hint?: string | null;
};

export interface BuildSurfaceOptions {
	readonly root?: JsonSchema;
	readonly diagnostics?: readonly DiagnosticInput[];
	readonly limits?: Partial<CompilerBuildLimits>;
}

type Presentation = "identity" | "primary-collection" | null;

interface BuildContext {
	readonly root: JsonSchema;
	readonly diagnostics: ReadonlyMap<string, readonly CompilerDiagnostic[]>;
	readonly path: string;
	readonly label: string;
	readonly depth: number;
	readonly seen: ReadonlySet<string>;
	readonly presentation: Presentation;
	readonly budget: BuildBudget;
}

interface Plan {
	readonly resolved: JsonSchema;
	readonly strategy: Strategy;
	readonly label: string;
	readonly hint: MorpheHint;
	readonly diagnostics: readonly CompilerDiagnostic[];
	readonly schemaId: string | null;
}

class BuildLimitSignal extends Error {
	constructor(
		readonly code: "COMPILER_DEPTH_LIMIT" | "COMPILER_NODE_LIMIT",
		readonly path: string,
		message: string,
	) {
		super(message);
	}
}

class BuildBudget {
	private nodes = 0;

	constructor(readonly limits: CompilerBuildLimits) {}

	enter(context: BuildContext): void {
		if (context.depth > this.limits.maxRecursionDepth) {
			throw new BuildLimitSignal(
				"COMPILER_DEPTH_LIMIT",
				context.path,
				`surface recursion exceeds ${this.limits.maxRecursionDepth}`,
			);
		}
		this.nodes += 1;
		if (this.nodes > this.limits.maxSurfaceNodes) {
			throw new BuildLimitSignal(
				"COMPILER_NODE_LIMIT",
				context.path,
				`surface IR exceeds ${this.limits.maxSurfaceNodes} nodes`,
			);
		}
	}
}

const RECORD_STRATEGIES = new Set<Strategy>(["record-card", "collapsed-section"]);
const COLLECTION_STRATEGIES = new Set<Strategy>(["table", "card-stack", "kpi-row", "trail"]);
const PROMOTABLE_STRATEGIES = new Set<Strategy>(["table", "card-stack"]);
const IDENTITY_KEYS = ["name", "title"] as const;
const NUMERIC_TEXT = /^\(?[+-]?\d(?:[\d _.,]*\d)?\)?$/;
const WELL_FORMED_CURRENCY = /^[A-Za-z]{3}$/;

function limitsWith(overrides?: Partial<CompilerBuildLimits>): CompilerBuildLimits {
	return { ...DEFAULT_COMPILER_BUILD_LIMITS, ...overrides };
}

function normalizedDiagnostic(diagnostic: DiagnosticInput): CompilerDiagnostic {
	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		path: diagnostic.path,
		message: diagnostic.message,
		...(typeof diagnostic.repair_hint === "string" ? { repair_hint: diagnostic.repair_hint } : {}),
	};
}

function diagnosticsByPath(
	diagnostics: readonly DiagnosticInput[] = [],
): ReadonlyMap<string, readonly CompilerDiagnostic[]> {
	const grouped = new Map<string, CompilerDiagnostic[]>();
	for (const diagnostic of diagnostics) {
		const normalized = normalizedDiagnostic(diagnostic);
		const entries = grouped.get(normalized.path) ?? [];
		entries.push(normalized);
		grouped.set(normalized.path, entries);
	}
	return grouped;
}

function limitSurface(signal: BuildLimitSignal): SurfaceNode {
	const diagnostic: CompilerDiagnostic = {
		code: signal.code,
		severity: "warning",
		path: signal.path,
		message: signal.message,
	};
	return surfaceNode({
		path: signal.path,
		label: "Surface limit",
		strategy: "diagnostic-node",
		value: signal.message,
		diagnostics: [diagnostic],
	});
}

/** Trusted JSON Schema + data -> deterministic, typed SurfaceNode IR. */
export function buildSurface(
	schema: JsonSchema,
	data: unknown,
	options: BuildSurfaceOptions = {},
): SurfaceNode {
	const limits = limitsWith(options.limits);
	const budget = new BuildBudget(limits);
	const context: BuildContext = {
		root: options.root ?? schema,
		diagnostics: diagnosticsByPath(options.diagnostics),
		path: "$",
		label: "",
		depth: 0,
		seen: new Set(),
		presentation: null,
		budget,
	};
	try {
		return build(schema, data, context);
	} catch (error) {
		if (error instanceof BuildLimitSignal) return limitSurface(error);
		throw error;
	}
}

function childContext(
	context: BuildContext,
	key: string,
	schemaId: string | null,
	presentation: Presentation,
): BuildContext {
	const seen = new Set(context.seen);
	if (schemaId !== null) seen.add(schemaId);
	return {
		...context,
		path: `${context.path}.${key}`,
		label: key,
		depth: context.depth + 1,
		seen,
		presentation,
	};
}

function itemContext(context: BuildContext, index: number, baseLabel: string): BuildContext {
	return {
		...context,
		path: `${context.path}[${index}]`,
		label: `${baseLabel} ${index}`,
		depth: context.depth + 1,
		presentation: null,
	};
}

function build(schema: JsonSchema, data: unknown, context: BuildContext): SurfaceNode {
	context.budget.enter(context);
	const plan = makePlan(schema, context);
	if (plan.strategy === "entity-header") {
		// Object-shaped, hint-selected only. Same terminating guard as a record.
		if (
			context.depth >= MAX_RECORD_DEPTH ||
			(plan.schemaId !== null && context.seen.has(plan.schemaId))
		) {
			return surfaceNode({
				path: context.path,
				label: plan.label,
				strategy: "linked-ref",
				diagnostics: plan.diagnostics,
			});
		}
		return buildEntityHeader(plan, data, context);
	}
	if (plan.strategy === "breakdown") {
		// Object- or array-shaped, hint-selected only. Same terminating guard as a record.
		if (
			context.depth >= MAX_RECORD_DEPTH ||
			(plan.schemaId !== null && context.seen.has(plan.schemaId))
		) {
			return surfaceNode({
				path: context.path,
				label: plan.label,
				strategy: "linked-ref",
				diagnostics: plan.diagnostics,
			});
		}
		return buildBreakdown(plan, data, context);
	}
	if (RECORD_STRATEGIES.has(plan.strategy)) {
		if (
			context.depth >= MAX_RECORD_DEPTH ||
			(plan.schemaId !== null && context.seen.has(plan.schemaId))
		) {
			return surfaceNode({
				path: context.path,
				label: plan.label,
				strategy: "linked-ref",
				diagnostics: plan.diagnostics,
			});
		}
		return buildRecord(plan, data, context);
	}
	if (COLLECTION_STRATEGIES.has(plan.strategy)) return buildCollection(plan, data, context);
	return buildLeaf(plan, data, context);
}

function hintFor(schema: JsonSchema, resolved: JsonSchema): ParsedHint {
	if (!Object.hasOwn(schema, "x-morphe")) return parseHint(resolved);
	const local = parseHint(schema);
	const target = parseHint(resolved);
	const rawLocal = schema["x-morphe"];
	const explicitHidden =
		isRecord(rawLocal) && Object.hasOwn(rawLocal, "hidden") && typeof rawLocal.hidden === "boolean";
	const order = local.hint.order ?? target.hint.order;
	// Call-site hints own presentation, but cannot accidentally shadow the
	// referenced class's disclosure boundary or signed object order.
	return {
		...local,
		hint: {
			...local.hint,
			hidden: explicitHidden ? local.hint.hidden : target.hint.hidden,
			...(order === undefined ? {} : { order }),
		},
	};
}

function unknownHintDiagnostics(keys: readonly string[], path: string): CompilerDiagnostic[] {
	if (keys.length === 0) return [];
	return [
		{
			code: "UNKNOWN_HINT",
			severity: "info",
			path,
			message: `ignored unknown x-morphe ${keys.length === 1 ? "key" : "keys"}: ${keys.join(", ")}`,
		},
	];
}

function makePlan(schema: JsonSchema, context: BuildContext): Plan {
	const resolved = unwrapNullable(resolveRef(schema, context.root), context.root);
	const parsed = hintFor(schema, resolved);
	const label = labelFor(schema, parsed.hint.label, context.label || segment(context.path));
	return {
		resolved,
		strategy: resolveStrategy(resolved, parsed.hint, context.root),
		label,
		hint: parsed.hint,
		diagnostics: [
			...(context.diagnostics.get(context.path) ?? []),
			...unknownHintDiagnostics(parsed.unknownKeys, context.path),
		],
		schemaId: referenceId(resolved) ?? referenceId(schema),
	};
}

function orderedProperties(
	properties: JsonSchema,
	order: readonly string[] | undefined,
): Array<readonly [string, JsonSchema]> {
	const keys = Object.keys(properties);
	const selected: string[] = [];
	const seen = new Set<string>();
	for (const key of order ?? []) {
		if (seen.has(key) || !Object.hasOwn(properties, key)) continue;
		seen.add(key);
		selected.push(key);
	}
	const remainder = keys.filter((key) => !seen.has(key)).sort();
	return [...selected, ...remainder].map((key) => {
		const value = properties[key];
		return [key, isSchema(value) ? value : {}] as const;
	});
}

function buildRecord(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	const strategy: Strategy =
		context.depth === 0 && plan.strategy === "record-card" ? "record-card" : "collapsed-section";
	const properties = isSchema(plan.resolved.properties) ? plan.resolved.properties : {};
	const pairs = orderedProperties(properties, plan.hint.order).filter(
		([, childSchema]) => !hidden(childSchema, context.root),
	);
	const identityKey = context.depth === 0 ? identityField(pairs, plan.resolved, context) : null;
	const primaryKey = context.depth === 0 ? primaryCollectionField(pairs, context) : null;
	const children = pairs.map(([key, childSchema]) =>
		build(
			childSchema,
			getValue(data, key),
			childContext(context, key, plan.schemaId, childPresentation(key, identityKey, primaryKey)),
		),
	);
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy,
		heading: plan.hint.heading,
		...(strategy === "collapsed-section" ? { collapse: plan.hint.collapse !== false } : {}),
		children,
		diagnostics: plan.diagnostics,
	});
}

function buildEntityHeader(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	// The detail-pane lede: build children plainly (no identity / primary-collection
	// promotion — those are record-only). Child classification lives in emit so it
	// stays identical across both compilers.
	const properties = isSchema(plan.resolved.properties) ? plan.resolved.properties : {};
	const pairs = orderedProperties(properties, plan.hint.order).filter(
		([, childSchema]) => !hidden(childSchema, context.root),
	);
	const children = pairs.map(([key, childSchema]) =>
		build(childSchema, getValue(data, key), childContext(context, key, plan.schemaId, null)),
	);
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: "entity-header",
		heading: plan.hint.heading,
		children,
		diagnostics: plan.diagnostics,
	});
}

function buildBreakdown(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	// Labeled proportion rows. Build the container's children plainly (object
	// properties or array items); emit reads each child's numeric value, computes the
	// fraction, and composes one Breakdown compound. Classification lives in emit so it
	// stays identical across both compilers.
	let children: SurfaceNode[];
	if (schemaType(plan.resolved) === "array") {
		const itemsSchema = isSchema(plan.resolved.items) ? plan.resolved.items : {};
		const rows = Array.isArray(data) ? data : [];
		children = rows.map((row, index) =>
			build(itemsSchema, row, itemContext(context, index, plan.label)),
		);
	} else {
		const properties = isSchema(plan.resolved.properties) ? plan.resolved.properties : {};
		const pairs = orderedProperties(properties, plan.hint.order).filter(
			([, childSchema]) => !hidden(childSchema, context.root),
		);
		children = pairs.map(([key, childSchema]) =>
			build(childSchema, getValue(data, key), childContext(context, key, plan.schemaId, null)),
		);
	}
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: "breakdown",
		heading: plan.hint.heading,
		children,
		diagnostics: plan.diagnostics,
	});
}

function buildCollection(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	if (plan.strategy === "kpi-row") return buildKpiRow(plan, data, context);
	const itemsSchema = isSchema(plan.resolved.items) ? plan.resolved.items : {};
	const rows = Array.isArray(data) ? data : [];
	const columns =
		plan.strategy === "table" ? tableColumns(itemsSchema, context) : ([] as SurfaceNode[]);
	const items = rows.map((row, index) =>
		build(itemsSchema, row, itemContext(context, index, plan.label)),
	);
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: plan.strategy,
		heading: plan.hint.heading,
		...(context.presentation === "primary-collection" ? { emphasis: "strong" as const } : {}),
		children: columns,
		items,
		diagnostics: plan.diagnostics,
	});
}

function buildKpiRow(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	const rows = Array.isArray(data) ? data : [];
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: "kpi-row",
		heading: plan.hint.heading,
		items: rows.map((row, index) => buildKpiCell(row, itemContext(context, index, plan.label))),
		diagnostics: plan.diagnostics,
	});
}

function buildKpiCell(row: unknown, context: BuildContext): SurfaceNode {
	const sourceDiagnostics = context.diagnostics.get(context.path) ?? [];
	if (!isRecord(row)) {
		const message = "unrenderable: kpi-row item is not a record";
		const diagnostic: CompilerDiagnostic = {
			code: "UNRENDERABLE",
			severity: "warning",
			path: context.path,
			message,
		};
		return surfaceNode({
			path: context.path,
			label: context.label,
			strategy: "diagnostic-node",
			value: message,
			diagnostics: [...sourceDiagnostics, diagnostic],
		});
	}
	const presentation = cellPresentation(row);
	const number = coerceNumber(row.value);
	const kicker = stringOrNull(row.kicker);
	const [numberFormat, currency] = currencyPresentation(presentation.format, presentation.currency);
	return surfaceNode({
		path: context.path,
		label: stringOrNull(row.label) || context.label,
		strategy: number === null ? "scalar" : "number",
		value: number ?? asScalar(row.value),
		...(presentation.role === undefined ? {} : { intent: presentation.role }),
		...(numberFormat === undefined ? {} : { number_format: numberFormat }),
		...(number === null && presentation.temporal !== undefined
			? { temporal: presentation.temporal }
			: {}),
		...(currency === undefined ? {} : { currency }),
		...(kicker === null ? {} : { kicker }),
		diagnostics: sourceDiagnostics,
	});
}

function cellPresentation(cell: Readonly<Record<string, unknown>>): MorpheHint {
	const schema: JsonSchema = {
		"x-morphe": {
			role: cell.intent ?? null,
			format: cell.format ?? null,
			temporal: cell.temporal ?? null,
			currency: cell.currency ?? null,
		},
	};
	return parseHint(schema).hint;
}

function tableColumns(itemsSchema: JsonSchema, context: BuildContext): SurfaceNode[] {
	const resolved = resolveRef(itemsSchema, context.root);
	const properties = isSchema(resolved.properties) ? resolved.properties : {};
	const order = hintFor(itemsSchema, resolved).hint.order;
	return orderedProperties(properties, order)
		.filter(([, childSchema]) => !hidden(childSchema, context.root))
		.map(([key, childSchema]) => tableColumn(key, childSchema, context));
}

function tableColumn(key: string, schema: JsonSchema, context: BuildContext): SurfaceNode {
	const resolved = resolveRef(schema, context.root);
	const hint = hintFor(schema, resolved).hint;
	const label = labelFor(schema, hint.label, key);
	return surfaceNode({
		path: `${context.path}.${key}`,
		label,
		strategy: "scalar",
		value: label,
		...(hint.role === undefined ? {} : { intent: hint.role }),
	});
}

function hidden(schema: JsonSchema, root: JsonSchema): boolean {
	return hintFor(schema, resolveRef(schema, root)).hint.hidden;
}

function buildLeaf(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	if (plan.strategy === "linked-ref") {
		const [label, href] = linkedRef(plan.label, data);
		const dataLabel = linkedRefDataLabel(data);
		return surfaceNode({
			path: context.path,
			label,
			strategy: "linked-ref",
			...(href === null ? {} : { href }),
			...(dataLabel === null ? {} : { value: dataLabel }),
			...(plan.hint.role === undefined ? {} : { intent: plan.hint.role }),
			diagnostics: plan.diagnostics,
		});
	}
	if (plan.strategy === "diagnostic-node") {
		const message = `unrenderable: ${schemaType(plan.resolved) ?? "unknown construct"}`;
		const diagnostic: CompilerDiagnostic = {
			code: "UNRENDERABLE",
			severity: "warning",
			path: context.path,
			message,
		};
		return surfaceNode({
			path: context.path,
			label: plan.label,
			strategy: "diagnostic-node",
			value: message,
			diagnostics: [...plan.diagnostics, diagnostic],
		});
	}
	if (plan.strategy === "number") return numberLeaf(plan, data, context);
	if (plan.strategy === "progress") return progressLeaf(plan, data, context);
	if (plan.strategy === "status") return statusLeaf(plan, data, context);

	const value = asScalar(data);
	const [numeric, polarity] = numericPresentation(value);
	const identity = context.presentation === "identity" && plan.strategy === "scalar";
	const scalarKind =
		typeof value === "number" ? scalarNumberKindFor(plan.resolved, value) : "integer";
	const intent =
		plan.strategy === "badge" ? valueIntent(plan.hint, value, scalarKind) : plan.hint.role;
	return surfaceNode(
		{
			path: context.path,
			label: plan.label,
			strategy: plan.strategy,
			value,
			...(intent === undefined ? {} : { intent }),
			...(identity ? { text_as: "display" as const } : {}),
			...(identity
				? { emphasis: "critical" as const }
				: plan.strategy === "scalar" && plan.hint.emphasis !== undefined
					? { emphasis: plan.hint.emphasis }
					: {}),
			...(plan.strategy === "scalar" && numeric !== null ? { numeric } : {}),
			...(plan.strategy === "scalar" && polarity !== null ? { polarity } : {}),
			...(plan.strategy === "scalar" && plan.hint.temporal !== undefined
				? { temporal: plan.hint.temporal }
				: {}),
			diagnostics: plan.diagnostics,
		},
		typeof value === "number" ? { scalarNumberKind: scalarKind } : {},
	);
}

function numberLeaf(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	const number = coerceNumber(data);
	if (number === null) {
		const value = asScalar(data);
		const scalarKind =
			typeof value === "number" ? scalarNumberKindFor(plan.resolved, value) : undefined;
		const [numeric, polarity] = numericPresentation(value);
		return surfaceNode(
			{
				path: context.path,
				label: plan.label,
				strategy: "scalar",
				value,
				...(plan.hint.role === undefined ? {} : { intent: plan.hint.role }),
				...(plan.hint.emphasis === undefined ? {} : { emphasis: plan.hint.emphasis }),
				...(numeric === null ? {} : { numeric }),
				...(polarity === null ? {} : { polarity }),
				...(plan.hint.temporal === undefined ? {} : { temporal: plan.hint.temporal }),
				diagnostics: plan.diagnostics,
			},
			scalarKind === undefined ? {} : { scalarNumberKind: scalarKind },
		);
	}
	const [format, currency] = currencyPresentation(plan.hint.format, plan.hint.currency);
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: "number",
		value: number,
		...(plan.hint.role === undefined ? {} : { intent: plan.hint.role }),
		...(plan.hint.emphasis === undefined ? {} : { emphasis: plan.hint.emphasis }),
		...(format === undefined ? {} : { number_format: format }),
		...(currency === undefined ? {} : { currency }),
		diagnostics: plan.diagnostics,
	});
}

function progressLeaf(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	const number = coerceNumber(data);
	const fraction = number === null ? null : Math.min(1, Math.max(0, number));
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: "progress",
		value: fraction,
		...(plan.hint.role === undefined ? {} : { intent: plan.hint.role }),
		diagnostics: plan.diagnostics,
	});
}

function statusLeaf(plan: Plan, data: unknown, context: BuildContext): SurfaceNode {
	const value = asScalar(data);
	const scalarKind =
		typeof value === "number" ? scalarNumberKindFor(plan.resolved, value) : "integer";
	const text = value === null ? "" : pythonScalarText(value, scalarKind);
	const intent = valueIntent(plan.hint, value, scalarKind);
	return surfaceNode({
		path: context.path,
		label: plan.label,
		strategy: "status",
		value: text,
		...(intent === undefined ? {} : { intent }),
		diagnostics: plan.diagnostics,
	});
}

function valueIntent(
	hint: MorpheHint,
	value: unknown,
	numberKind: "integer" | "number" = "integer",
): IntentRef | undefined {
	const key = value === null ? "" : scalarIntentKey(value, numberKind);
	return hint.intents !== undefined && Object.hasOwn(hint.intents, key)
		? hint.intents[key]
		: hint.role;
}

function scalarIntentKey(value: unknown, numberKind: "integer" | "number"): string {
	if (typeof value === "boolean") return value ? "True" : "False";
	if (typeof value === "number") return pythonScalarText(value, numberKind);
	return String(value);
}

function scalarNumberKindFor(schema: JsonSchema, value: number): "integer" | "number" {
	const declared = schemaType(schema);
	if (declared === "number") return "number";
	if (declared === "integer") return "integer";
	return Number.isInteger(value) ? "integer" : "number";
}

function currencyPresentation(
	format: NumberFormat | undefined,
	currency: string | undefined,
): readonly [NumberFormat | undefined, string | undefined] {
	if (format === "currency" && (currency === undefined || !WELL_FORMED_CURRENCY.test(currency))) {
		return ["plain", undefined];
	}
	return [format, currency];
}

/** Python numeric coercion with the KRA-762 finite/safe totality repair. */
function coerceNumber(value: unknown): number | null {
	if (typeof value === "boolean") return null;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return null;
		return Number.isInteger(value) && !Number.isSafeInteger(value) ? null : value;
	}
	if (typeof value !== "string") return null;
	const text = pythonStrip(value);
	if (text.length === 0) return null;
	const normalized = text.replaceAll("_", "");
	if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null;
	const number = Number(normalized);
	if (!Number.isFinite(number)) return null;
	// Decimal and exponent spellings can round to an unsafe integral IEEE-754
	// value too (for example, 9007199254740993.0). Never render that lossy
	// integral coercion as if it preserved the signed source value.
	if (Number.isInteger(number) && !Number.isSafeInteger(number)) return null;
	return number;
}

function labelFor(schema: JsonSchema, hintLabel: string | undefined, fallback: string): string {
	if (hintLabel) return hintLabel;
	return typeof schema.title === "string" ? schema.title : fallback;
}

function referenceId(schema: JsonSchema): string | null {
	const value = schema.$id ?? schema.$ref;
	return typeof value === "string" ? value : null;
}

function segment(path: string): string {
	return path.slice(path.lastIndexOf(".") + 1);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getValue(data: unknown, key: string): unknown {
	return isRecord(data) && Object.hasOwn(data, key) ? data[key] : null;
}

function childPresentation(
	key: string,
	identityKey: string | null,
	primaryKey: string | null,
): Presentation {
	if (key === identityKey) return "identity";
	if (key === primaryKey) return "primary-collection";
	return null;
}

function identityField(
	pairs: readonly (readonly [string, JsonSchema])[],
	schema: JsonSchema,
	context: BuildContext,
): string | null {
	for (const key of IDENTITY_KEYS) {
		const match = pairs.find(([candidate]) => candidate === key)?.[1];
		if (match !== undefined && scalarish(match, context)) return key;
	}
	if (!Array.isArray(schema.required)) return null;
	for (const key of schema.required) {
		if (typeof key !== "string") continue;
		const match = pairs.find(([candidate]) => candidate === key)?.[1];
		if (match !== undefined && scalarish(match, context)) return key;
	}
	return null;
}

function primaryCollectionField(
	pairs: readonly (readonly [string, JsonSchema])[],
	context: BuildContext,
): string | null {
	return (
		pairs.find(([, schema]) => PROMOTABLE_STRATEGIES.has(strategyFor(schema, context)))?.[0] ?? null
	);
}

function scalarish(schema: JsonSchema, context: BuildContext): boolean {
	return strategyFor(schema, context) === "scalar";
}

function strategyFor(schema: JsonSchema, context: BuildContext): Strategy {
	const resolved = resolveRef(schema, context.root);
	return resolveStrategy(resolved, hintFor(schema, resolved).hint, context.root);
}

function linkedRef(fallback: string, data: unknown): readonly [string, string | null] {
	if (isRecord(data)) {
		return [stringOrNull(data.label) || fallback, stringOrNull(data.href)];
	}
	if (typeof data === "string") return [fallback, data];
	return [fallback, null];
}

function linkedRefDataLabel(data: unknown): string | null {
	return isRecord(data) ? stringOrNull(data.label) : null;
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function numericPresentation(value: ScalarValue): readonly [boolean | null, Polarity | null] {
	if (typeof value === "boolean" || value === null) return [null, null];
	if (typeof value === "number") return [true, value < 0 ? "negative" : "positive"];
	const text = pythonStrip(value);
	if (text.length === 0 || !NUMERIC_TEXT.test(text)) return [null, null];
	return [true, text.startsWith("-") || text.startsWith("(") ? "negative" : "positive"];
}

function asScalar(data: unknown): ScalarValue {
	if (typeof data === "number" && !Number.isFinite(data)) return pythonJsonRepr(data);
	if (
		typeof data === "string" ||
		typeof data === "number" ||
		typeof data === "boolean" ||
		data === null ||
		data === undefined
	) {
		return data === undefined ? null : data;
	}
	return pythonJsonRepr(data);
}

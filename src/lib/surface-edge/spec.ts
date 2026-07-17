import canonicalize from "canonicalize";
import type { Sha256 } from "../artifacts/source-types.generated.js";
import type { EmphasisClaim, IntentRef, Node } from "../grammar/types.js";

export type Strategy =
	| "scalar"
	| "badge"
	| "record-card"
	| "collapsed-section"
	| "linked-ref"
	| "table"
	| "card-stack"
	| "diagnostic-node"
	| "number"
	| "status"
	| "progress"
	| "kpi-row";

export type NumberFormat = "plain" | "integer" | "currency" | "percent" | "compact";
export type TemporalFormat = "date-time-minute";
export type TextAs = "display" | "heading" | "subheading" | "body" | "caption";
export type Polarity = "positive" | "negative";
export type ScalarValue = string | number | boolean | null;

export interface CompilerDiagnostic {
	readonly code: string;
	readonly severity: "error" | "warning" | "info";
	readonly path: string;
	readonly message: string;
	readonly repair_hint?: string;
}

/**
 * The resolved, recursive compiler IR. Its serialized field names intentionally
 * match the Python `SurfaceNode` migration oracle.
 */
export interface SurfaceNode {
	readonly path: string;
	readonly label: string;
	readonly strategy: Strategy;
	readonly value?: ScalarValue;
	readonly intent?: IntentRef;
	readonly text_as?: TextAs;
	readonly emphasis?: EmphasisClaim;
	readonly numeric?: boolean;
	readonly polarity?: Polarity;
	readonly href?: string;
	readonly collapse?: boolean;
	readonly number_format?: NumberFormat;
	readonly temporal?: TemporalFormat;
	readonly currency?: string;
	readonly kicker?: string;
	readonly heading: boolean;
	readonly children: readonly SurfaceNode[];
	readonly items: readonly SurfaceNode[];
	readonly diagnostics: readonly CompilerDiagnostic[];
}

export type JsonSchema = Readonly<Record<string, unknown>>;

/** Dialect policy belongs to the later delivery receipt, not pure compilation. */
export interface CompilationReceipt {
	readonly sourceTestimonySha256: Sha256;
	readonly compilerVersion: string;
	readonly compilerBuildSha256: Sha256;
	readonly grammarVersion: string;
	readonly treeSha256: Sha256;
	readonly diagnosticsSha256: Sha256;
}

export interface CompilationResult {
	readonly tree: Node;
	readonly diagnostics: readonly CompilerDiagnostic[];
	readonly receipt: CompilationReceipt;
}

type ScalarNumberKind = "integer" | "number";
const SCALAR_NUMBER_KIND = Symbol("morphe.surface.scalar-number-kind");
const NON_JCS_SCALAR = "unrenderable: scalarized value is outside the RFC 8785 domain";

type SurfaceNodeWithMetadata = SurfaceNode & {
	readonly [SCALAR_NUMBER_KIND]?: ScalarNumberKind;
};

export type SurfaceNodeInit = Omit<SurfaceNode, "heading" | "children" | "items" | "diagnostics"> &
	Partial<Pick<SurfaceNode, "heading" | "children" | "items" | "diagnostics">>;

/** Construct an oracle-shaped IR node with Python's explicit default fields. */
export function surfaceNode(
	init: SurfaceNodeInit,
	metadata: { readonly scalarNumberKind?: ScalarNumberKind } = {},
): SurfaceNode {
	const { value, ...fields } = init;
	const node: SurfaceNodeWithMetadata = {
		...fields,
		...(value === null || value === undefined ? {} : { value }),
		heading: init.heading ?? true,
		children: init.children ?? [],
		items: init.items ?? [],
		diagnostics: init.diagnostics ?? [],
	};
	if (metadata.scalarNumberKind !== undefined) {
		Object.defineProperty(node, SCALAR_NUMBER_KIND, {
			value: metadata.scalarNumberKind,
			enumerable: false,
		});
	}
	return node;
}

export function scalarNumberKind(node: SurfaceNode): ScalarNumberKind | undefined {
	return (node as SurfaceNodeWithMetadata)[SCALAR_NUMBER_KIND];
}

const PYTHON_WHITESPACE = new Set([
	0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001,
	0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f,
	0x205f, 0x3000,
]);

/** Exact Python `str.strip()` whitespace semantics for migration parity. */
export function pythonStrip(value: string): string {
	const characters = Array.from(value);
	let start = 0;
	let end = characters.length;
	while (start < end && PYTHON_WHITESPACE.has(characters[start]?.codePointAt(0) ?? -1)) start += 1;
	while (end > start && PYTHON_WHITESPACE.has(characters[end - 1]?.codePointAt(0) ?? -1)) end -= 1;
	return characters.slice(start, end).join("");
}

function pythonExponentText(value: number): string {
	return value.toExponential().replace(/e([+-])(\d+)$/, (_match, sign: string, digits: string) => {
		return `e${sign}${digits.padStart(2, "0")}`;
	});
}

function pythonFloatText(value: number): string {
	if (Object.is(value, -0)) return "-0.0";
	const magnitude = Math.abs(value);
	if (magnitude !== 0 && (magnitude < 1e-4 || magnitude >= 1e16)) {
		return pythonExponentText(value);
	}
	return Number.isInteger(value) ? `${String(value)}.0` : String(value);
}

/** Python-compatible scalar spelling used by the migration oracle's text lowering. */
export function pythonScalarText(value: ScalarValue, numberKind?: ScalarNumberKind): string {
	if (value === null) return "";
	if (typeof value === "boolean") return value ? "True" : "False";
	if (typeof value !== "number") return value;
	if (numberKind === "number") return pythonFloatText(value);
	if (numberKind === "integer") {
		if (!Number.isFinite(value)) return NON_JCS_SCALAR;
		return canonicalize(value) ?? NON_JCS_SCALAR;
	}
	return String(value);
}

const RFC3339_TIMESTAMP =
	/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/**
 * Render compiler-generated RFC 3339 text at stable minute precision.
 *
 * SurfaceNode and signed-source values stay exact. Only emitted scalar text uses this
 * locale-free floor, keeping Python and TypeScript tree bytes in parity.
 */
export function displayScalarText(
	value: ScalarValue,
	temporal: TemporalFormat | undefined,
	numberKind?: ScalarNumberKind,
): string {
	const rendered = pythonScalarText(value, numberKind);
	if (temporal !== "date-time-minute" || typeof value !== "string") return rendered;
	const match = RFC3339_TIMESTAMP.exec(value);
	if (match === null) return rendered;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6]);
	const zone = match[7];
	if (zone === undefined || !validTimestampParts(year, month, day, hour, minute, second, zone)) {
		return rendered;
	}

	const zoneText = zone.toLowerCase() === "z" || zone === "+00:00" ? "UTC" : zone;
	return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]} ${zoneText}`;
}

function validTimestampParts(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second: number,
	zone: string,
): boolean {
	if (month < 1 || month > 12 || hour < 0 || hour > 23) return false;
	if (minute < 0 || minute > 59 || second < 0 || second > 59) return false;
	const days = [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (day < 1 || day > (days[month - 1] ?? 0)) return false;
	if (zone.toLowerCase() === "z") return true;
	const offsetHour = Number(zone.slice(1, 3));
	const offsetMinute = Number(zone.slice(4, 6));
	return offsetHour >= 0 && offsetHour <= 23 && offsetMinute >= 0 && offsetMinute <= 59;
}

function leapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isWellFormedUnicode(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const unit = value.charCodeAt(index);
		if (unit >= 0xd800 && unit <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
			index += 1;
		} else if (unit >= 0xdc00 && unit <= 0xdfff) {
			return false;
		}
	}
	return true;
}

function isJcsValue(value: unknown): boolean {
	const pending: unknown[] = [value];
	const seen = new WeakSet<object>();
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === null || typeof current === "boolean") continue;
		if (typeof current === "string") {
			if (!isWellFormedUnicode(current)) return false;
			continue;
		}
		if (typeof current === "number") {
			if (!Number.isFinite(current)) return false;
			continue;
		}
		if (typeof current !== "object" || current === null || seen.has(current)) return false;
		seen.add(current);
		if (Array.isArray(current)) {
			if (Object.keys(current).length !== current.length) return false;
			for (let index = 0; index < current.length; index += 1) {
				if (!Object.hasOwn(current, index)) return false;
				pending.push(current[index]);
			}
			continue;
		}
		const prototype = Object.getPrototypeOf(current);
		if (prototype !== Object.prototype && prototype !== null) return false;
		for (const key of Reflect.ownKeys(current)) {
			if (typeof key !== "string" || !isWellFormedUnicode(key)) return false;
			const descriptor = Object.getOwnPropertyDescriptor(current, key);
			if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor))
				return false;
			pending.push(descriptor.value);
		}
	}
	return true;
}

/** Canonical text for explicitly scalarized JSON containers. */
export function pythonJsonRepr(value: unknown): string {
	try {
		if (!isJcsValue(value)) return NON_JCS_SCALAR;
		return canonicalize(value) ?? NON_JCS_SCALAR;
	} catch {
		// Raw admission rejects non-JCS values. This sentinel keeps direct compiler
		// calls total without introducing host-language or member-order drift.
		return NON_JCS_SCALAR;
	}
}

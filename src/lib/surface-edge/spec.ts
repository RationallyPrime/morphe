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
	| "kpi-row"
	| "entity-header"
	| "breakdown"
	| "trail"
	| "key-value";

export type NumberFormat = "plain" | "integer" | "currency" | "percent" | "compact";
/**
 * The producer's SEMANTIC instant marker, carried on the hint and the SurfaceNode.
 * It says "this value is an instant"; it never dictates presentation. Presentation is
 * the viewer's {@link TemporalPolicy}, applied at emit time.
 */
export type TemporalFormat = "date-time-minute";

/**
 * The viewer-selected presentation policy for instant-typed scalar values.
 *
 * A compiler option, not a renderer reformat: one formatting truth, deterministic per
 * (source, policy), so receipts stay honest. `exact` keeps full RFC 3339; `minute` and
 * `date` floor the locale-free display text; `relative` renders against render time and
 * is viewer-only — it must never enter a persisted or attested artifact, and the
 * compile receipt records which policy produced a tree.
 */
export type TemporalPolicy = "exact" | "minute" | "date" | "relative";

/** The default policy: minute precision for every instant, with exact one toggle away. */
export const DEFAULT_TEMPORAL_POLICY: TemporalPolicy = "minute";

/**
 * Which surface-identity gate mode admitted this testimony.
 *
 * `exact` — the effective upstream request equalled the configured/pinned path, so
 * the admitted `surface_id` had to equal the expected id verbatim. `family` — the
 * request was a derived drill-through instance (forwarded params beyond the
 * configured path's own query), so the pinned identity check was relaxed to a
 * family-prefix match on `surface_id` ALONE while every other trust check stayed
 * strict. Recorded on the receipt for attestation honesty.
 */
export type SurfaceIdGateMode = "exact" | "family";

/** The default gate mode: a pinned request demands verbatim identity. */
export const DEFAULT_SURFACE_ID_GATE: SurfaceIdGateMode = "exact";

/**
 * The surface_id family grammar (KRA-777): `<source>.<pane>:<instance…>`.
 *
 * The FAMILY token — the `<source>.<pane>` slot the admission gate keys family-mode on —
 * is everything before the FIRST `:`; it MUST carry a `.` and no `:`. Enforcing that here
 * closes the loki6 finding: a producer emitting `<source>:<pane>:<instance>` can no longer
 * collapse every pane of a source into a single `<source>` family. Source and pane are
 * lowercase; instance segments (one or more, `:`-separated) allow mixed case for week
 * stamps (`2026-W29`), uuids, and dates.
 *
 * This string is THE grammar for the TypeScript side and MUST equal the schema `pattern`
 * emitted from `SourceSurfaceArtifactV1.surface_id` (Python `SURFACE_ID_PATTERN`); the
 * `source-contract` test pins that parity so the schema gate and this runtime parse rule
 * can never drift apart.
 */
export const SURFACE_ID_PATTERN = "^[a-z0-9_-]+\\.[a-z0-9_-]+(?::[A-Za-z0-9_-]+)+$";
const SURFACE_ID_RE = new RegExp(SURFACE_ID_PATTERN);

/** Whether `surfaceId` parses under the family grammar. */
export function isValidSurfaceId(surfaceId: string): boolean {
	return SURFACE_ID_RE.test(surfaceId);
}

/**
 * The `<source>.<pane>` family token, or `null` when `surfaceId` is malformed.
 *
 * The family is the segment before the first `:`. Deriving it through this parser — not a
 * bare `indexOf(":")` slice — is what keeps family-mode admission safe: a
 * `<source>:<pane>:…` id has no valid family and returns `null` instead of silently
 * collapsing to `<source>`.
 */
export function surfaceFamily(surfaceId: string): string | null {
	if (!isValidSurfaceId(surfaceId)) return null;
	return surfaceId.slice(0, surfaceId.indexOf(":"));
}
export type TextAs = "display" | "heading" | "subheading" | "body" | "caption";
export type Polarity = "positive" | "negative";
export type ScalarValue = string | number | boolean | null;

export interface CompilerDiagnostic {
	readonly code: string;
	readonly severity: "error" | "warning" | "info";
	readonly path: string;
	readonly message: string;
	readonly repair_hint?: string;
	/** Producer-relative drill-through to the offending entries; the host's link-rewrite gate resolves or strips it. */
	readonly href?: string;
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
	readonly gloss?: string;
	readonly kicker_gloss?: string;
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
	/**
	 * The temporal presentation policy this tree was compiled under. Recorded so a
	 * downstream consumer can tell an exact/minute/date tree (safe to cache) from a
	 * `relative` one (render-time-dependent, never to be persisted or attested).
	 */
	readonly temporalPolicy: TemporalPolicy;
	/**
	 * Which surface-identity gate mode admitted the testimony this tree was compiled
	 * from. `exact` for a pinned request, `family` for a derived drill-through instance
	 * whose `surface_id` matched only the expected id's family prefix (see
	 * {@link SurfaceIdGateMode}). Attestation honesty: it records the relaxation that
	 * was in effect, never that the concrete id happened to match verbatim.
	 */
	readonly surfaceIdGate: SurfaceIdGateMode;
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

const RELATIVE_UNITS: readonly (readonly [number, number, string])[] = [
	[60, 1, "sec"],
	[3_600, 60, "min"],
	[86_400, 3_600, "hr"],
	[604_800, 86_400, "day"],
	[2_629_800, 604_800, "wk"],
	[31_557_600, 2_629_800, "mo"],
	[Number.POSITIVE_INFINITY, 31_557_600, "yr"],
];

/**
 * Render an RFC 3339 instant relative to render time (e.g. "3 mins ago", "in 2 hrs").
 *
 * Deterministic given (value, now): no locale, no `Date.now()` read of its own — the
 * clock is injected so a compile is reproducible for a fixed instant. Viewer-only by
 * contract; the receipt flags a tree built under this policy as non-persistable.
 */
function relativeScalarText(value: string, now: Date): string {
	const then = Date.parse(value);
	if (!Number.isFinite(then)) return value;
	const deltaSeconds = (now.getTime() - then) / 1000;
	const past = deltaSeconds >= 0;
	const magnitude = Math.abs(deltaSeconds);
	if (magnitude < 5) return "just now";
	for (const [limit, divisor, label] of RELATIVE_UNITS) {
		if (magnitude < limit) {
			const count = Math.max(1, Math.floor(magnitude / divisor));
			const unit = count === 1 ? label : `${label}s`;
			return past ? `${count} ${unit} ago` : `in ${count} ${unit}`;
		}
	}
	return value;
}

/**
 * Lower one scalar value to its display text under a temporal presentation policy.
 *
 * Instant detection is by SHAPE (RFC 3339), never by the producer's semantic hint: a
 * provenance-role instant carries no hint yet is still an instant, so the founder's
 * raw-microsecond System Time is caught here. The SurfaceNode and signed-source values
 * stay exact — only this emitted display text bends to the policy:
 *  - `exact`   → the full RFC 3339 value, unchanged (the parity/copy affordance).
 *  - `minute`  → the locale-free "YYYY-MM-DD HH:MM UTC" floor (Python-oracle parity).
 *  - `date`    → the calendar date alone.
 *  - `relative`→ render-time-relative text (viewer-only; receipt-flagged).
 *
 * A string that is not a well-formed RFC 3339 instant is never reinterpreted; it
 * returns its exact spelling under every policy.
 */
export function displayScalarText(
	value: ScalarValue,
	numberKind: ScalarNumberKind | undefined,
	policy: TemporalPolicy,
	now: () => Date,
): string {
	const rendered = pythonScalarText(value, numberKind);
	if (policy === "exact" || typeof value !== "string") return rendered;
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
	switch (policy) {
		case "date":
			return `${match[1]}-${match[2]}-${match[3]}`;
		case "minute":
			return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]} ${zoneText}`;
		case "relative":
			return relativeScalarText(value, now());
	}
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

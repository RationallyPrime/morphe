import type { EmphasisClaim, IntentRef } from "../grammar/types.js";
import type { JsonSchema, NumberFormat, Strategy } from "./spec.js";

const STRATEGIES = new Set<Strategy>([
	"scalar",
	"badge",
	"record-card",
	"collapsed-section",
	"linked-ref",
	"table",
	"card-stack",
	"diagnostic-node",
	"number",
	"status",
	"progress",
	"kpi-row",
]);
const NUMBER_FORMATS = new Set<NumberFormat>([
	"plain",
	"integer",
	"currency",
	"percent",
	"compact",
]);
const INTENTS = new Set<IntentRef>([
	"primary-action",
	"neutral",
	"provenance",
	"evidence",
	"accession",
	"caution",
	"success",
	"info",
	"folio",
	"marginalia",
	"seal",
]);
const EMPHASES = new Set<EmphasisClaim>(["muted", "normal", "strong", "critical"]);
const KNOWN_HINT_KEYS = new Set([
	"strategy",
	"label",
	"role",
	"collapse",
	"hidden",
	"heading",
	"format",
	"currency",
	"intents",
	"emphasis",
	"order",
]);

export interface MorpheHint {
	readonly strategy?: Strategy;
	readonly label?: string;
	readonly role?: IntentRef;
	readonly collapse?: boolean;
	readonly hidden: boolean;
	readonly heading: boolean;
	readonly format?: NumberFormat;
	readonly currency?: string;
	readonly intents?: Readonly<Record<string, IntentRef>>;
	readonly emphasis?: EmphasisClaim;
	/** Signed deterministic property order; remainder keys use a sorted floor. */
	readonly order?: readonly string[];
}

export interface ParsedHint {
	readonly hint: MorpheHint;
	readonly unknownKeys: readonly string[];
}

export const EMPTY_HINT: MorpheHint = Object.freeze({ hidden: false, heading: true });

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

const INVALID = Symbol("invalid-morphe-hint");

function optionalMember<T>(
	raw: Readonly<Record<string, unknown>>,
	key: string,
	predicate: (value: unknown) => value is T,
): T | undefined | typeof INVALID {
	const value = raw[key];
	if (value === undefined || value === null) return undefined;
	return predicate(value) ? value : INVALID;
}

function defaultedMember<T>(
	raw: Readonly<Record<string, unknown>>,
	key: string,
	predicate: (value: unknown) => value is T,
): T | undefined | typeof INVALID {
	const value = raw[key];
	if (value === undefined) return undefined;
	return predicate(value) ? value : INVALID;
}

function isStrategy(value: unknown): value is Strategy {
	return typeof value === "string" && STRATEGIES.has(value as Strategy);
}

function isNumberFormat(value: unknown): value is NumberFormat {
	return typeof value === "string" && NUMBER_FORMATS.has(value as NumberFormat);
}

function isIntent(value: unknown): value is IntentRef {
	return typeof value === "string" && INTENTS.has(value as IntentRef);
}

function isEmphasis(value: unknown): value is EmphasisClaim {
	return typeof value === "string" && EMPHASES.has(value as EmphasisClaim);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function intentMap(
	value: unknown,
): Readonly<Record<string, IntentRef>> | undefined | typeof INVALID {
	if (value === undefined || value === null) return undefined;
	if (!isRecord(value)) return INVALID;
	const intents: Record<string, IntentRef> = Object.create(null) as Record<string, IntentRef>;
	for (const [key, intent] of Object.entries(value)) {
		if (!isIntent(intent)) return INVALID;
		intents[key] = intent;
	}
	return intents;
}

function orderList(value: unknown): readonly string[] | undefined | typeof INVALID {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) return INVALID;
	return value;
}

/**
 * Parse the forward-open `x-morphe` block. Unknown keys retain all known
 * siblings and are reported separately; an invalid presentation value selects
 * the hint-free floor while preserving signed property order.
 */
export function parseHint(schema: JsonSchema): ParsedHint {
	const raw = schema["x-morphe"];
	if (!isRecord(raw)) return { hint: EMPTY_HINT, unknownKeys: [] };
	const unknownKeys = Object.keys(raw)
		.filter((key) => !KNOWN_HINT_KEYS.has(key))
		.sort();

	const strategy = optionalMember(raw, "strategy", isStrategy);
	const label = optionalMember(raw, "label", isString);
	const role = optionalMember(raw, "role", isIntent);
	const collapse = optionalMember(raw, "collapse", isBoolean);
	const hidden = defaultedMember(raw, "hidden", isBoolean);
	const heading = defaultedMember(raw, "heading", isBoolean);
	const format = optionalMember(raw, "format", isNumberFormat);
	const currency = optionalMember(raw, "currency", isString);
	const intents = intentMap(raw.intents);
	const emphasis = optionalMember(raw, "emphasis", isEmphasis);
	const parsedOrder = orderList(raw.order);
	// A present-but-malformed signed order uses an empty authenticated prefix;
	// orderedProperties then appends every known key in its deterministic sorted
	// floor. Missing order stays undefined for the bounded legacy path.
	const order = parsedOrder === INVALID ? ([] as const) : parsedOrder;
	if (
		strategy === INVALID ||
		label === INVALID ||
		role === INVALID ||
		collapse === INVALID ||
		hidden === INVALID ||
		heading === INVALID ||
		format === INVALID ||
		currency === INVALID ||
		intents === INVALID ||
		emphasis === INVALID
	) {
		return {
			hint: order === undefined ? EMPTY_HINT : { ...EMPTY_HINT, order },
			unknownKeys,
		};
	}

	return {
		hint: {
			hidden: hidden ?? false,
			heading: heading ?? true,
			...(strategy === undefined ? {} : { strategy }),
			...(label === undefined ? {} : { label }),
			...(role === undefined ? {} : { role }),
			...(collapse === undefined ? {} : { collapse }),
			...(format === undefined ? {} : { format }),
			...(currency === undefined ? {} : { currency }),
			...(intents === undefined ? {} : { intents }),
			...(emphasis === undefined ? {} : { emphasis }),
			...(order === undefined ? {} : { order }),
		},
		unknownKeys,
	};
}

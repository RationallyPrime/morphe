import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA } from "../artifacts/source-schema.generated.js";
import type {
	Diagnostic,
	JsonObject,
	JsonValue,
	SourceSurfaceArtifactV1,
} from "../artifacts/source-types.generated.js";

export interface SourceValidationLimits {
	readonly maxDepth: number;
	readonly maxValues: number;
	readonly maxCollectionEntries: number;
	readonly maxStringLength: number;
	readonly maxDefinitions: number;
	readonly maxReferences: number;
}

export const DEFAULT_SOURCE_VALIDATION_LIMITS: SourceValidationLimits = Object.freeze({
	maxDepth: 64,
	maxValues: 50_000,
	maxCollectionEntries: 10_000,
	maxStringLength: 262_144,
	maxDefinitions: 2_048,
	maxReferences: 4_096,
});

export interface NormalizedDiagnostic extends Diagnostic {
	readonly repair_hint: string | null;
	readonly href: string | null;
}

export type NormalizedSourceSurfaceArtifact = Omit<
	SourceSurfaceArtifactV1,
	"valid_until" | "diagnostics" | "required_capabilities"
> & {
	readonly valid_until: string | null;
	readonly diagnostics: readonly NormalizedDiagnostic[];
	readonly required_capabilities: readonly string[];
};

export type SchemaValidationResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly reason: string };

const OUTER_SCHEMA_ISSUE_LIMIT = 4;

// Pydantic emits a pattern beside `anyOf: [string, null]` for optional canonical
// timestamps. That is valid Draft 2020-12 but Ajv's strictTypes lint rejects the
// sibling pattern, so keep schema strictness while disabling that non-normative lint.
const outerAjv = new Ajv2020({
	allErrors: false,
	strict: true,
	strictTypes: false,
	validateFormats: false,
});
const validateOuter = outerAjv.compile(
	SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA,
) as ValidateFunction<SourceSurfaceArtifactV1>;

function limitsWith(overrides?: Partial<SourceValidationLimits>): SourceValidationLimits {
	return { ...DEFAULT_SOURCE_VALIDATION_LIMITS, ...overrides };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pointerOf(error: ErrorObject): string {
	return error.instancePath.length > 0 ? `$source${error.instancePath}` : "$source";
}

function outerFailure(errors: readonly ErrorObject[] | null | undefined): string {
	const rendered = (errors ?? [])
		.slice(0, OUTER_SCHEMA_ISSUE_LIMIT)
		.map((error) => `${pointerOf(error)} ${error.message ?? "is invalid"}`);
	return rendered.length > 0
		? `source envelope failed its generated schema: ${rendered.join("; ")}`
		: "source envelope failed its generated schema";
}

/** Bound a generic JSON value before generated-schema or recursive compiler work. */
export function inspectSourceComplexity(
	root: unknown,
	overrides?: Partial<SourceValidationLimits>,
): string | null {
	const limits = limitsWith(overrides);
	const pending: Array<{
		readonly value: unknown;
		readonly path: string;
		readonly depth: number;
	}> = [{ value: root, path: "$source", depth: 0 }];
	const seen = new WeakSet<object>();
	let values = 0;

	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		values += 1;
		if (values > limits.maxValues) {
			return `source exceeds the maximum of ${limits.maxValues} values at ${current.path}`;
		}
		if (current.depth > limits.maxDepth) {
			return `source exceeds the maximum depth of ${limits.maxDepth} at ${current.path}`;
		}
		if (typeof current.value === "string" && current.value.length > limits.maxStringLength) {
			return `source string exceeds ${limits.maxStringLength} characters at ${current.path}`;
		}
		if (typeof current.value !== "object" || current.value === null) continue;
		if (seen.has(current.value)) return `source is not a JSON tree at ${current.path}`;
		seen.add(current.value);

		if (Array.isArray(current.value)) {
			if (current.value.length > limits.maxCollectionEntries) {
				return `source array exceeds ${limits.maxCollectionEntries} entries at ${current.path}`;
			}
			for (let index = current.value.length - 1; index >= 0; index -= 1) {
				pending.push({
					value: current.value[index],
					path: `${current.path}[${index}]`,
					depth: current.depth + 1,
				});
			}
			continue;
		}

		const entries = Object.entries(current.value);
		if (entries.length > limits.maxCollectionEntries) {
			return `source object exceeds ${limits.maxCollectionEntries} properties at ${current.path}`;
		}
		for (let index = entries.length - 1; index >= 0; index -= 1) {
			const entry = entries[index];
			if (!entry) continue;
			if (entry[0].length > limits.maxStringLength) {
				return `source key exceeds ${limits.maxStringLength} characters at ${current.path}`;
			}
			pending.push({
				value: entry[1],
				path: `${current.path}.${entry[0]}`,
				depth: current.depth + 1,
			});
		}
	}

	return null;
}

function normalizeDiagnostic(diagnostic: Diagnostic): NormalizedDiagnostic {
	return {
		code: diagnostic.code,
		severity: diagnostic.severity,
		path: diagnostic.path,
		message: diagnostic.message,
		repair_hint: diagnostic.repair_hint ?? null,
		href: diagnostic.href ?? null,
	};
}

/** Apply Pydantic wire defaults without letting Ajv mutate untrusted input. */
export function validateSourceEnvelope(
	value: unknown,
): SchemaValidationResult<NormalizedSourceSurfaceArtifact> {
	if (!validateOuter(value)) return { ok: false, reason: outerFailure(validateOuter.errors) };
	const document = value as SourceSurfaceArtifactV1;
	return {
		ok: true,
		value: {
			...document,
			valid_until: document.valid_until ?? null,
			diagnostics: (document.diagnostics ?? []).map(normalizeDiagnostic),
			required_capabilities: [...(document.required_capabilities ?? [])],
		},
	};
}

const SCHEMA_MAP_KEYWORDS = ["$defs", "properties", "patternProperties", "dependentSchemas"];
const SCHEMA_ARRAY_KEYWORDS = ["allOf", "anyOf", "oneOf", "prefixItems"];
const SCHEMA_VALUE_KEYWORDS = [
	"additionalProperties",
	"contains",
	"contentSchema",
	"else",
	"if",
	"items",
	"not",
	"propertyNames",
	"then",
	"unevaluatedItems",
	"unevaluatedProperties",
];

function pushSchemaChildren(schema: Record<string, unknown>, pending: unknown[]): void {
	for (const keyword of SCHEMA_MAP_KEYWORDS) {
		const map = schema[keyword];
		if (isRecord(map)) pending.push(...Object.values(map));
	}
	for (const keyword of SCHEMA_ARRAY_KEYWORDS) {
		const values = schema[keyword];
		if (Array.isArray(values)) pending.push(...values);
	}
	for (const keyword of SCHEMA_VALUE_KEYWORDS) pending.push(schema[keyword]);
}

function schemaGraphChildren(
	root: JsonObject,
	schema: Record<string, unknown>,
): Record<string, unknown>[] {
	const values: unknown[] = [];
	pushSchemaChildren(schema, values);
	if (typeof schema.$ref === "string") {
		const resolved = resolveLocalReference(root, schema.$ref);
		if (resolved.ok) values.push(resolved.value);
	}
	return values.filter(isRecord);
}

/** Reject graph recursion that would make the total compiler omit finite signed data. */
function recursiveLocalReferenceReason(root: JsonObject): string | null {
	type Frame = {
		readonly schema: Record<string, unknown>;
		readonly exit: boolean;
	};
	const state = new WeakMap<object, "visiting" | "done">();
	const stack: Frame[] = [{ schema: root, exit: false }];

	while (stack.length > 0) {
		const frame = stack.pop();
		if (!frame) break;
		if (frame.exit) {
			state.set(frame.schema, "done");
			continue;
		}
		const prior = state.get(frame.schema);
		if (prior === "visiting") return "source schema contains a recursive local $ref cycle";
		if (prior === "done") continue;

		state.set(frame.schema, "visiting");
		stack.push({ schema: frame.schema, exit: true });
		const children = schemaGraphChildren(root, frame.schema);
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (child) stack.push({ schema: child, exit: false });
		}
	}
	return null;
}

function signedOrderReason(schema: Record<string, unknown>): string | null {
	const properties = schema.properties;
	if (!isRecord(properties)) return null;
	const hint = schema["x-morphe"];
	const order = isRecord(hint) ? hint.order : undefined;
	if (!Array.isArray(order) || !order.every((entry) => typeof entry === "string")) {
		return "source object schema is missing a valid signed x-morphe.order array";
	}
	const propertyNames = Object.keys(properties);
	const orderedNames = order as string[];
	const unique = new Set(orderedNames);
	if (
		unique.size !== orderedNames.length ||
		orderedNames.length !== propertyNames.length ||
		propertyNames.some((name) => !unique.has(name))
	) {
		return "source object schema x-morphe.order must name every property exactly once";
	}
	return null;
}

function sourceSchemaPolicyReason(
	schema: JsonObject,
	limits: SourceValidationLimits,
): string | null {
	const pending: unknown[] = [schema];
	const seen = new WeakSet<object>();
	let references = 0;
	let definitions = 0;
	while (pending.length > 0) {
		const current = pending.pop();
		if (!isRecord(current)) continue;
		if (seen.has(current)) continue;
		seen.add(current);

		if (Object.hasOwn(current, "$id")) {
			return "source schema contains $id, which can change local reference bases";
		}
		if (Object.hasOwn(current, "$dynamicRef") || Object.hasOwn(current, "$recursiveRef")) {
			return "source schema contains a dynamic or recursive reference";
		}
		const hint = current["x-morphe"];
		if (isRecord(hint) && Object.hasOwn(hint, "hidden")) {
			if (typeof hint.hidden !== "boolean") {
				return "source schema contains a malformed x-morphe.hidden disclosure policy";
			}
			if (hint.hidden) {
				return "source schema contains residual hidden policy after minimization";
			}
		}
		const orderReason = signedOrderReason(current);
		if (orderReason !== null) return orderReason;

		const defs = current.$defs;
		if (isRecord(defs)) {
			definitions += Object.keys(defs).length;
			if (definitions > limits.maxDefinitions) {
				return `source schema exceeds ${limits.maxDefinitions} definitions`;
			}
		}
		if (Object.hasOwn(current, "$ref")) {
			references += 1;
			if (references > limits.maxReferences) {
				return `source schema exceeds ${limits.maxReferences} references`;
			}
			const reference = current.$ref;
			if (typeof reference !== "string" || !reference.startsWith("#/$defs/")) {
				return `source schema reference must use #/$defs/...: ${JSON.stringify(reference)}`;
			}
			if (reference.includes("%")) {
				return `source schema reference must not use URI percent encoding: ${reference}`;
			}
			const resolved = resolveLocalReference(schema, reference);
			if (!resolved.ok) return resolved.reason;
		}
		pushSchemaChildren(current, pending);
	}
	return recursiveLocalReferenceReason(schema);
}

function decodePointerToken(value: string): string | null {
	if (/~(?:[^01]|$)/.test(value)) return null;
	return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function resolveLocalReference(
	root: JsonObject,
	reference: string,
): SchemaValidationResult<Record<string, unknown>> {
	if (!reference.startsWith("#/$defs/")) {
		return { ok: false, reason: `source schema reference must use #/$defs/...: ${reference}` };
	}
	if (reference.includes("%")) {
		return {
			ok: false,
			reason: `source schema reference must not use URI percent encoding: ${reference}`,
		};
	}
	let current: unknown = root;
	for (const encoded of reference.slice(2).split("/")) {
		const token = decodePointerToken(encoded);
		if (token === null || !isRecord(current) || !Object.hasOwn(current, token)) {
			return { ok: false, reason: `source schema contains unresolved reference ${reference}` };
		}
		current = current[token];
	}
	return isRecord(current)
		? { ok: true, value: current }
		: { ok: false, reason: `source schema reference is not an object ${reference}` };
}

function embeddedAjv(): Ajv2020 {
	const ajv = new Ajv2020({
		allErrors: false,
		strict: true,
		strictTypes: false,
		validateFormats: false,
	});
	// `x-morphe` is an authenticated compiler annotation, not a validation
	// assertion. Register it explicitly so Ajv can remain strict about every
	// actual JSON Schema keyword.
	ajv.addKeyword({ keyword: "x-morphe", schemaType: "object", valid: true });
	return ajv;
}

/** Validate the authenticated self-contained Draft 2020-12 schema and its data. */
export function validateAuthenticatedSchemaData(
	schema: JsonObject,
	data: JsonValue,
	overrides?: Partial<SourceValidationLimits>,
): SchemaValidationResult<true> {
	const limits = limitsWith(overrides);
	const referenceReason = sourceSchemaPolicyReason(schema, limits);
	if (referenceReason !== null) return { ok: false, reason: referenceReason };

	const ajv = embeddedAjv();
	try {
		if (!ajv.validateSchema(schema)) {
			return {
				ok: false,
				reason: `source serialization schema is not valid Draft 2020-12: ${ajv.errorsText(
					ajv.errors,
				)}`,
			};
		}
		const validate = ajv.compile(schema);
		if (!validate(data)) {
			return {
				ok: false,
				reason: `source data does not satisfy its authenticated schema: ${ajv.errorsText(
					validate.errors,
				)}`,
			};
		}
	} catch (error) {
		return {
			ok: false,
			reason: `source serialization schema could not be compiled: ${
				error instanceof Error ? error.message : "unknown schema error"
			}`,
		};
	}
	return { ok: true, value: true };
}

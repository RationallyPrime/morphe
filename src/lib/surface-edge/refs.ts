import type { JsonSchema } from "./spec.js";

export const MAX_REFERENCE_HOPS = 64;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pointerTarget(reference: string, root: JsonSchema): JsonSchema | null {
	if (!reference.startsWith("#/$defs/") || reference.includes("%")) return null;
	let current: unknown = root;
	for (const encoded of reference.slice(2).split("/")) {
		if (/~(?:[^01]|$)/.test(encoded)) return null;
		const token = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
		if (!isRecord(current) || !Object.hasOwn(current, token)) return null;
		current = current[token];
	}
	return isRecord(current) ? current : null;
}

/** Resolve a bounded chain of local RFC 6901 references, otherwise degrade in place. */
export function resolveRef(
	schema: JsonSchema,
	root: JsonSchema,
	maxHops = MAX_REFERENCE_HOPS,
): JsonSchema {
	let current = schema;
	const seen = new Set<string>();
	for (let hop = 0; hop < maxHops; hop += 1) {
		const reference = current.$ref;
		if (typeof reference !== "string" || !reference.startsWith("#/$defs/")) return current;
		if (seen.has(reference)) return current;
		seen.add(reference);
		const target = pointerTarget(reference, root);
		if (target === null) return current;
		current = target;
	}
	return current;
}

export function schemaType(schema: JsonSchema): string | null {
	if (typeof schema.type === "string") return schema.type;
	if (Object.hasOwn(schema, "enum")) return "enum";
	if (Object.hasOwn(schema, "properties")) return "object";
	return null;
}

/** Unwrap exactly Pydantic's `anyOf [X, null]` optional shape. */
export function unwrapNullable(schema: JsonSchema, root: JsonSchema): JsonSchema {
	if (!Array.isArray(schema.anyOf)) return schema;
	const branches = schema.anyOf.filter(isRecord);
	if (branches.length !== schema.anyOf.length) return schema;
	const nonNull = branches.filter((branch) => branch.type !== "null");
	if (nonNull.length !== 1 || nonNull.length === branches.length) return schema;
	const branch = nonNull[0];
	return branch === undefined ? schema : resolveRef(branch, root);
}

export function isSchema(value: unknown): value is JsonSchema {
	return isRecord(value);
}

import type { MorpheHint } from "./hints.js";
import { isSchema, resolveRef, schemaType, unwrapNullable } from "./refs.js";
import type { JsonSchema, Strategy } from "./spec.js";

const SCALAR_TYPES = new Set(["string", "integer", "number", "boolean"]);

/** The sole `(schema shape, hint) -> closed strategy` decision point. */
export function resolveStrategy(
	schema: JsonSchema,
	hint: MorpheHint,
	root: JsonSchema = {},
): Strategy {
	if (hint.strategy !== undefined) return hint.strategy;
	const resolved = unwrapNullable(schema, root);
	if (Object.hasOwn(resolved, "enum")) return "badge";
	const type = schemaType(resolved);
	if (type === "object") return "record-card";
	if (type === "array") {
		const rawItems = resolved.items;
		const items = isSchema(rawItems) ? resolveRef(rawItems, root) : null;
		return items !== null && flatRecord(items, root) ? "table" : "card-stack";
	}
	if (type !== null && SCALAR_TYPES.has(type)) return "scalar";
	return "diagnostic-node";
}

function flatRecord(items: JsonSchema, root: JsonSchema): boolean {
	if (schemaType(items) !== "object" || !isSchema(items.properties)) return false;
	const properties = Object.values(items.properties);
	if (properties.length === 0) return false;
	return properties.every((raw) => {
		if (!isSchema(raw)) return false;
		const type = schemaType(resolveRef(raw, root));
		return type !== "object" && type !== "array";
	});
}

import { isNodeLike, registry } from "../compounds/factory.js";
import type { CompoundRef, Node } from "../grammar/types.js";
import { DIALECT_COMPOUND_CONSTRAINTS, type DialectConstraintId } from "./constraints.generated.js";

export type DialectId = DialectConstraintId;

export interface DialectNodeValidationIssue {
	readonly code: "unknown-dialect" | "compound-policy" | "compound-reference";
	readonly path: readonly (string | number)[];
	readonly message: string;
}

export type DialectNodeValidationResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly issues: readonly DialectNodeValidationIssue[] };

export interface DialectNodeValidationOptions {
	/** Complete grammar validator used at untrusted ingress for node-valued compound args. */
	readonly validateNodeValue?: (value: unknown) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dialectId(value: string): DialectId | null {
	return Object.hasOwn(DIALECT_COMPOUND_CONSTRAINTS, value) ? (value as DialectId) : null;
}

interface ChildEntry {
	readonly node: Node;
	readonly path: readonly (string | number)[];
}

function indexedChildren(values: unknown, field: string): readonly ChildEntry[] {
	if (!Array.isArray(values)) return [];
	const children: ChildEntry[] = [];
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index];
		if (isNodeLike(value)) children.push({ node: value, path: [field, index] });
	}
	return children;
}

function compoundChildren(node: CompoundRef): readonly ChildEntry[] {
	const children: ChildEntry[] = [];
	if (isRecord(node.args)) {
		for (const [name, value] of Object.entries(node.args)) {
			if (isNodeLike(value)) children.push({ node: value, path: ["args", name] });
			if (Array.isArray(value)) {
				for (let index = 0; index < value.length; index += 1) {
					const item = value[index];
					if (isNodeLike(item)) children.push({ node: item, path: ["args", name, index] });
				}
			}
		}
	}
	if (isRecord(node.slots)) {
		for (const [name, fill] of Object.entries(node.slots)) {
			children.push(
				...indexedChildren(fill, "slots").map((entry) => ({
					node: entry.node,
					path: ["slots", name, entry.path[1] as number],
				})),
			);
		}
	}
	return children;
}

function children(node: Node): readonly ChildEntry[] {
	switch (node.kind) {
		case "stack":
		case "grid":
		case "cluster":
		case "frame":
		case "dialog":
		case "popover":
		case "disclosure":
			return indexedChildren(node.children, "children");
		case "vary":
			return indexedChildren(node.options, "options");
		case "slot":
			return indexedChildren(node.fallback ?? [], "fallback");
		case "within":
			return node.target === undefined ? [] : [{ node: node.target, path: ["target"] }];
		case "compound":
			return compoundChildren(node);
		default:
			return [];
	}
}

/** Enforce the generated `G|D` compound policy on an already grammar-valid tree. */
export function validateNodeForDialect(
	tree: Node,
	requestedDialectId: string,
	options: DialectNodeValidationOptions = {},
): DialectNodeValidationResult {
	const id = dialectId(requestedDialectId);
	if (id === null) {
		return {
			ok: false,
			issues: [
				{
					code: "unknown-dialect",
					path: [],
					message: `unknown Morphe dialect "${requestedDialectId}"`,
				},
			],
		};
	}

	const policy = DIALECT_COMPOUND_CONSTRAINTS[id];
	const restricted = policy.mode === "allowlist";
	const allowed = new Set<string>(policy.compounds);
	const issues: DialectNodeValidationIssue[] = [];
	const pending: Array<{ readonly node: Node; readonly path: readonly (string | number)[] }> = [
		{ node: tree, path: [] },
	];

	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		if (current.node.kind === "compound") {
			if (restricted && !allowed.has(current.node.name)) {
				issues.push({
					code: "compound-policy",
					path: [...current.path, "name"],
					message: `compound "${current.node.name}" is not permitted by dialect "${id}"`,
				});
			} else if (registry.has(current.node.name)) {
				for (const message of registry.referenceIssues(current.node)) {
					issues.push({
						code: "compound-reference",
						path: current.path,
						message,
					});
				}
				const definition = registry.get(current.node.name);
				const args = isRecord(current.node.args) ? current.node.args : null;
				if (definition && options.validateNodeValue && args) {
					for (const [name, spec] of Object.entries(definition.params.properties)) {
						if (!Object.hasOwn(args, name)) continue;
						const value = args[name];
						const valid =
							spec.type === "node"
								? options.validateNodeValue(value)
								: spec.type === "node-list" && Array.isArray(value)
									? value.every(options.validateNodeValue)
									: true;
						if (!valid) {
							issues.push({
								code: "compound-reference",
								path: [...current.path, "args", name],
								message: `argument "${name}" must contain schema-valid nodes`,
							});
						}
					}
				}
			}
		}
		for (const child of children(current.node)) {
			pending.push({ node: child.node, path: [...current.path, ...child.path] });
		}
	}

	return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

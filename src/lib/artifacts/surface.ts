import { fromJSONSchema } from "zod";
import type { Node } from "../grammar/types.js";
import { SURFACE_ARTIFACT_JSON_SCHEMA } from "./surface-schema.generated.js";

type JsonSchemaInput = Parameters<typeof fromJSONSchema>[0];
type ValidationPath = readonly (string | number)[];

export interface SurfaceArtifactDiagnostic {
	readonly code: string;
	readonly severity: "error" | "warning" | "info";
	readonly path: string;
	readonly message: string;
	readonly repair_hint?: string;
}

export interface SurfaceArtifactDocument {
	readonly artifact_version: "1.0.0";
	readonly tree: Node;
	readonly grammar_version: string;
	readonly producer_version: string;
	readonly compiler_version: string;
	readonly diagnostics: readonly SurfaceArtifactDiagnostic[];
	readonly produced_at: string;
}

declare const trustedSurfaceArtifact: unique symbol;

/** A surface artifact that crossed the bounded, generated-schema trust gate. */
export type TrustedSurfaceArtifact = SurfaceArtifactDocument & {
	readonly [trustedSurfaceArtifact]: true;
};

export type ArtifactValidationIssueCode =
	| "cycle"
	| "depth-limit"
	| "collection-limit"
	| "value-limit"
	| "string-limit"
	| "schema"
	| "metadata";

export interface ArtifactValidationIssue {
	readonly code: ArtifactValidationIssueCode;
	readonly path: ValidationPath;
	readonly message: string;
}

export type ValidationResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly issues: readonly ArtifactValidationIssue[] };

export interface ArtifactValidationLimits {
	readonly maxDepth: number;
	readonly maxValues: number;
	readonly maxCollectionEntries: number;
	readonly maxStringLength: number;
}

export const DEFAULT_ARTIFACT_VALIDATION_LIMITS: ArtifactValidationLimits = Object.freeze({
	maxDepth: 64,
	maxValues: 50_000,
	maxCollectionEntries: 10_000,
	maxStringLength: 262_144,
});

const SCHEMA_ISSUE_LIMIT = 8;
const surfaceArtifactSchema = fromJSONSchema(SURFACE_ARTIFACT_JSON_SCHEMA as JsonSchemaInput);
const nodeSchema = fromJSONSchema({
	$schema: SURFACE_ARTIFACT_JSON_SCHEMA.$schema,
	$ref: "#/$defs/Node",
	$defs: SURFACE_ARTIFACT_JSON_SCHEMA.$defs,
} as JsonSchemaInput);

function limitIssue(
	code: ArtifactValidationIssueCode,
	path: ValidationPath,
	message: string,
): ArtifactValidationIssue {
	return { code, path, message };
}

function inspectComplexity(
	root: unknown,
	limits: ArtifactValidationLimits,
): ArtifactValidationIssue | null {
	const pending: Array<{
		readonly value: unknown;
		readonly path: ValidationPath;
		readonly depth: number;
	}> = [{ value: root, path: [], depth: 0 }];
	const seen = new WeakSet<object>();
	let valueCount = 0;

	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		valueCount += 1;
		if (valueCount > limits.maxValues) {
			return limitIssue(
				"value-limit",
				current.path,
				`artifact exceeds the maximum of ${limits.maxValues} values`,
			);
		}
		if (current.depth > limits.maxDepth) {
			return limitIssue(
				"depth-limit",
				current.path,
				`artifact exceeds the maximum depth of ${limits.maxDepth}`,
			);
		}
		if (typeof current.value === "string" && current.value.length > limits.maxStringLength) {
			return limitIssue(
				"string-limit",
				current.path,
				`string exceeds the maximum length of ${limits.maxStringLength}`,
			);
		}
		if (typeof current.value !== "object" || current.value === null) continue;
		if (seen.has(current.value)) {
			return limitIssue("cycle", current.path, "artifact is not a JSON tree");
		}
		seen.add(current.value);

		if (Array.isArray(current.value)) {
			if (current.value.length > limits.maxCollectionEntries) {
				return limitIssue(
					"collection-limit",
					current.path,
					`array exceeds the maximum of ${limits.maxCollectionEntries} entries`,
				);
			}
			for (let index = current.value.length - 1; index >= 0; index -= 1) {
				pending.push({
					value: current.value[index],
					path: [...current.path, index],
					depth: current.depth + 1,
				});
			}
			continue;
		}

		const entries = Object.entries(current.value);
		if (entries.length > limits.maxCollectionEntries) {
			return limitIssue(
				"collection-limit",
				current.path,
				`object exceeds the maximum of ${limits.maxCollectionEntries} properties`,
			);
		}
		for (let index = entries.length - 1; index >= 0; index -= 1) {
			const entry = entries[index];
			if (!entry) continue;
			pending.push({
				value: entry[1],
				path: [...current.path, entry[0]],
				depth: current.depth + 1,
			});
		}
	}

	return null;
}

function schemaIssues(error: {
	readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
}): readonly ArtifactValidationIssue[] {
	return error.issues.slice(0, SCHEMA_ISSUE_LIMIT).map((issue) => ({
		code: "schema" as const,
		path: issue.path.map((part) => (typeof part === "number" ? part : String(part))),
		message: issue.message,
	}));
}

function limitsWith(overrides?: Partial<ArtifactValidationLimits>): ArtifactValidationLimits {
	return { ...DEFAULT_ARTIFACT_VALIDATION_LIMITS, ...overrides };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface StructuralNodeChild {
	readonly node: unknown;
	readonly path: ValidationPath;
}

function indexedStructuralChildren(
	values: unknown,
	path: ValidationPath,
): readonly StructuralNodeChild[] {
	if (!Array.isArray(values)) return [];
	return values.map((node, index) => ({ node, path: [...path, index] }));
}

function compoundStructuralChildren(node: Record<string, unknown>): readonly StructuralNodeChild[] {
	const children: StructuralNodeChild[] = [];
	if (isRecord(node.args)) {
		for (const [name, value] of Object.entries(node.args)) {
			if (isRecord(value)) children.push({ node: value, path: ["args", name] });
			if (Array.isArray(value)) {
				children.push(
					...indexedStructuralChildren(value, ["args", name]).filter((child) =>
						isRecord(child.node),
					),
				);
			}
		}
	}
	if (isRecord(node.slots)) {
		for (const [name, slot] of Object.entries(node.slots)) {
			children.push(...indexedStructuralChildren(slot, ["slots", name]));
		}
	}
	return children;
}

function structuralNodeChildren(node: Record<string, unknown>): readonly StructuralNodeChild[] {
	switch (node.kind) {
		case "stack":
		case "grid":
		case "cluster":
		case "frame":
		case "dialog":
		case "popover":
		case "disclosure":
			return indexedStructuralChildren(node.children, ["children"]);
		case "vary":
			return indexedStructuralChildren(node.options, ["options"]);
		case "slot":
			return indexedStructuralChildren(node.fallback, ["fallback"]);
		case "within":
			return node.target === undefined ? [] : [{ node: node.target, path: ["target"] }];
		case "compound":
			return compoundStructuralChildren(node);
		default:
			return [];
	}
}

/**
 * Load-bearing compensation for a zod `fromJSONSchema` gap: the generated Button
 * schema enforces its accessible name via a top-level `anyOf` (label OR a11y),
 * which `fromJSONSchema` silently drops — schema validation alone accepts a bare
 * `{kind: "button"}`. This walk is therefore the ONLY enforcer of that invariant
 * on the TS ingress ("schema-complete" really means schema + this walk). If
 * py/morphe_grammar ever emits another cross-field constraint, it must be
 * mirrored here; surface.test.ts pins the gap so a zod fix surfaces as a
 * failing test rather than a silently redundant walk.
 */
function semanticNodeIssue(root: unknown, prefix: ValidationPath): ArtifactValidationIssue | null {
	const pending: Array<{ readonly node: unknown; readonly path: ValidationPath }> = [
		{ node: root, path: prefix },
	];
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current || !isRecord(current.node)) continue;
		if (
			current.node.kind === "button" &&
			typeof current.node.label !== "string" &&
			!isRecord(current.node.a11y)
		) {
			return {
				code: "schema",
				path: current.path,
				message: "button requires a visible label or explicit a11y name",
			};
		}
		const children = structuralNodeChildren(current.node);
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (!child) continue;
			pending.push({ node: child.node, path: [...current.path, ...child.path] });
		}
	}
	return null;
}

/** Validate an arbitrary value against the complete generated Node contract. */
export function validateNodeDocument(
	value: unknown,
	limits?: Partial<ArtifactValidationLimits>,
): ValidationResult<Node> {
	const limit = inspectComplexity(value, limitsWith(limits));
	if (limit) return { ok: false, issues: [limit] };
	const parsed = nodeSchema.safeParse(value);
	if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
	const semantic = semanticNodeIssue(parsed.data, []);
	if (semantic) return { ok: false, issues: [semantic] };
	return { ok: true, value: parsed.data as Node };
}

/** Validate and brand an untrusted compiled-surface document. */
export function validateSurfaceArtifact(
	value: unknown,
	limits?: Partial<ArtifactValidationLimits>,
): ValidationResult<TrustedSurfaceArtifact> {
	const limit = inspectComplexity(value, limitsWith(limits));
	if (limit) return { ok: false, issues: [limit] };
	const parsed = surfaceArtifactSchema.safeParse(value);
	if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
	const document = parsed.data as SurfaceArtifactDocument;
	const semantic = semanticNodeIssue(document.tree, ["tree"]);
	if (semantic) return { ok: false, issues: [semantic] };
	if (document.producer_version !== document.compiler_version) {
		return {
			ok: false,
			issues: [
				{
					code: "metadata",
					path: ["producer_version"],
					message: "producer_version must equal compiler_version",
				},
			],
		};
	}
	return { ok: true, value: document as TrustedSurfaceArtifact };
}

export function formatArtifactValidationIssue(issue: ArtifactValidationIssue): string {
	const path = issue.path.reduce<string>((rendered, part) => {
		return typeof part === "number" ? `${rendered}[${part}]` : `${rendered}.${part}`;
	}, "$artifact");
	return `${path}: ${issue.message}`;
}

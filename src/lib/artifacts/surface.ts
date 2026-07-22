import { fromJSONSchema } from "zod";
import { hasVisibleLabelText } from "../grammar/labels.js";
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

/*
 * DISCRIMINATOR DISPATCH — the load-bearing performance shape of this gate.
 *
 * The generated Node union is a 27-branch `oneOf` with a `discriminator` on
 * `kind`. zod's `fromJSONSchema` ignores the discriminator keyword and
 * evaluates EVERY branch at EVERY node — and because branches recurse into
 * child Nodes, validation goes super-linear in tree size (a live 126-node
 * kernel surface pinned the SSR event loop for minutes; probed 2026-07-16).
 *
 * So the gate compiles one SHALLOW schema per node kind — the variant's own
 * fields, with every child-Node position replaced by a "record with a string
 * kind" stub — and walks the tree itself, dispatching each node to its
 * variant by `kind` and recursing via `structuralNodeChildren` (which mirrors
 * exactly the child positions the grammar declares: children / options /
 * fallback / target / slots / compound args). One schema pass per node:
 * validation is linear in tree size, with unchanged semantics — anything
 * invalid INSIDE a node still fails, and an unknown kind fails the dispatch
 * exactly as it failed every oneOf branch before.
 */

const NODE_STUB_SCHEMA = {
	type: "object",
	properties: { kind: { type: "string" } },
	required: ["kind"],
} as const;

function stubNodeRefs(schema: unknown): unknown {
	if (Array.isArray(schema)) return schema.map(stubNodeRefs);
	if (typeof schema !== "object" || schema === null) return schema;
	const record = schema as Record<string, unknown>;
	if (record.$ref === "#/$defs/Node") return NODE_STUB_SCHEMA;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) out[key] = stubNodeRefs(value);
	return out;
}

const GENERATED_DEFS = SURFACE_ARTIFACT_JSON_SCHEMA.$defs as Record<
	string,
	Record<string, unknown>
>;
const STUBBED_DEFS = stubNodeRefs(GENERATED_DEFS) as Record<string, unknown>;

function shallowSchemaFor(ref: string) {
	return fromJSONSchema({
		$schema: SURFACE_ARTIFACT_JSON_SCHEMA.$schema,
		$ref: ref,
		$defs: STUBBED_DEFS,
	} as JsonSchemaInput);
}

type ShallowSchema = ReturnType<typeof fromJSONSchema>;

const nodeVariantByKind: ReadonlyMap<string, ShallowSchema> = (() => {
	const union = GENERATED_DEFS.Node as { oneOf?: readonly { $ref?: string }[] };
	const variants = union.oneOf ?? [];
	const byKind = new Map<string, ShallowSchema>();
	for (const variant of variants) {
		const ref = variant.$ref;
		if (!ref) throw new Error("generated Node union carries an inline variant");
		const name = ref.split("/").at(-1) ?? "";
		const definition = GENERATED_DEFS[name] as {
			properties?: { kind?: { const?: string } };
		};
		const kind = definition?.properties?.kind?.const;
		if (typeof kind !== "string") {
			throw new Error(`generated Node variant ${name} does not pin a kind const`);
		}
		byKind.set(kind, shallowSchemaFor(ref));
	}
	return byKind;
})();

// The envelope schema with `tree` stubbed: envelope fields validate via zod,
// the tree itself goes through the dispatching walk below.
const shallowSurfaceArtifactSchema = fromJSONSchema(
	stubNodeRefs({
		...SURFACE_ARTIFACT_JSON_SCHEMA,
		$defs: GENERATED_DEFS,
	}) as JsonSchemaInput,
);

function indexedSlotChildren(node: Record<string, unknown>): readonly StructuralNodeChild[] {
	if (!isRecord(node.slots)) return [];
	const children: StructuralNodeChild[] = [];
	for (const [name, slot] of Object.entries(node.slots)) {
		children.push(...indexedStructuralChildren(slot, ["slots", name]));
	}
	return children;
}

function dispatchNodeIssue(root: unknown, prefix: ValidationPath): ArtifactValidationIssue | null {
	const pending: Array<{ readonly node: unknown; readonly path: ValidationPath }> = [
		{ node: root, path: prefix },
	];
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		if (!isRecord(current.node)) {
			return { code: "schema", path: current.path, message: "node must be an object" };
		}
		const kind = current.node.kind;
		if (typeof kind !== "string") {
			return { code: "schema", path: [...current.path, "kind"], message: "node requires a kind" };
		}
		const variant = nodeVariantByKind.get(kind);
		if (variant === undefined) {
			return {
				code: "schema",
				path: [...current.path, "kind"],
				message: `unknown node kind "${kind}"`,
			};
		}
		const parsed = variant.safeParse(current.node);
		if (!parsed.success) {
			const issue = schemaIssues(parsed.error)[0];
			return issue
				? { ...issue, path: [...current.path, ...issue.path] }
				: { code: "schema", path: current.path, message: "node failed its kind schema" };
		}
		// Compound ARGS are excluded from the schema walk on purpose: the generic
		// grammar schema types args as free values, and their per-parameter node
		// contracts are enforced by the DIALECT layer (validateNodeForDialect's
		// validateNodeValue callback), which owns the specialized compound
		// schemas — mirroring what the monolithic zod pass validated. Slots are
		// generic node-lists and stay in this walk.
		const children =
			kind === "compound"
				? indexedSlotChildren(current.node)
				: structuralNodeChildren(current.node);
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (!child) continue;
			pending.push({ node: child.node, path: [...current.path, ...child.path] });
		}
	}
	return null;
}

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
		case "table":
			return tableStructuralChildren(node);
		case "compound":
			return compoundStructuralChildren(node);
		default:
			return [];
	}
}

function tableStructuralChildren(node: Record<string, unknown>): readonly StructuralNodeChild[] {
	if (!Array.isArray(node.rows)) return [];
	const children: StructuralNodeChild[] = [];
	node.rows.forEach((row, rowIndex) => {
		if (!isRecord(row)) return;
		if (Array.isArray(row.cells)) {
			row.cells.forEach((cell, cellIndex) => {
				if (!isRecord(cell)) return;
				children.push(
					...indexedStructuralChildren(cell.children, [
						"rows",
						rowIndex,
						"cells",
						cellIndex,
						"children",
					]),
				);
			});
		}
		if (Array.isArray(row.diagnostics)) {
			children.push(
				...indexedStructuralChildren(row.diagnostics, ["rows", rowIndex, "diagnostics"]),
			);
		}
	});
	return children;
}

/**
 * Load-bearing compensation for a zod `fromJSONSchema` gap: the generated Button
 * schema enforces its accessible name via a top-level `anyOf` (label OR a11y),
 * which `fromJSONSchema` silently drops — schema validation alone accepts a bare
 * `{kind: "button"}`. This walk is therefore the ONLY enforcer of that invariant
 * on the TS ingress ("schema-complete" really means schema + this walk). If
 * py/morphe_grammar ever emits another cross-field constraint, it must be
 * mirrored here; surface.test.ts pins the gap so a zod fix surfaces as a
 * failing test rather than a silently redundant walk. KRA-804 adds two more
 * cross-field guards here: body/open-data text cannot carry a gloss, and a
 * quantity needs a visible label before it can carry one.
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
		if (current.node.kind === "text" && typeof current.node.gloss === "string") {
			const register = typeof current.node.as === "string" ? current.node.as : "body";
			if (!["display", "heading", "subheading", "caption"].includes(register)) {
				return {
					code: "schema",
					path: current.path,
					message: "text gloss is only valid on a kicker/caption or title-bearing text node",
				};
			}
			if (typeof current.node.value !== "string" || !hasVisibleLabelText(current.node.value)) {
				return {
					code: "schema",
					path: current.path,
					message: "text gloss requires visible term text",
				};
			}
		}
		if (
			current.node.kind === "number" &&
			typeof current.node.gloss === "string" &&
			typeof current.node.label !== "string"
		) {
			return {
				code: "schema",
				path: current.path,
				message: "number gloss requires a visible label",
			};
		}
		if (typeof current.node.gloss === "string") {
			const term =
				current.node.kind === "badge" || current.node.kind === "link"
					? current.node.label
					: current.node.kind === "status" && isRecord(current.node.signal)
						? current.node.signal.text
						: undefined;
			if (term !== undefined && (typeof term !== "string" || !hasVisibleLabelText(term))) {
				return {
					code: "schema",
					path: current.path,
					message: `${String(current.node.kind)} gloss requires visible label text`,
				};
			}
		}
		// Mirror of the Pydantic Table.require_rectangular_rows validator (a
		// cross-field constraint JSON Schema cannot express): every row carries
		// exactly as many cells as the declared columns.
		if (
			current.node.kind === "table" &&
			Array.isArray(current.node.columns) &&
			Array.isArray(current.node.rows)
		) {
			const width = current.node.columns.length;
			for (let rowIndex = 0; rowIndex < current.node.rows.length; rowIndex += 1) {
				const row: unknown = current.node.rows[rowIndex];
				if (!isRecord(row) || !Array.isArray(row.cells)) continue;
				if (row.cells.length !== width) {
					return {
						code: "schema",
						path: [...current.path, "rows", rowIndex, "cells"],
						message: `table row ${rowIndex} carries ${row.cells.length} cells; the declared columns require exactly ${width}`,
					};
				}
			}
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
	const dispatched = dispatchNodeIssue(value, []);
	if (dispatched) return { ok: false, issues: [dispatched] };
	const semantic = semanticNodeIssue(value, []);
	if (semantic) return { ok: false, issues: [semantic] };
	return { ok: true, value: value as Node };
}

/*
 * Wire compat (producers on py-v0.6.3 and earlier): the envelope doctrine is
 * absent-not-null — the generated schema collapses `str | None` to `string`
 * (`_drop_null_from_optional`), and the compiler's tree serializer honors it
 * with `exclude_none` — but producer ENVELOPES serialized
 * `Diagnostic.repair_hint: None` as an explicit `null` until the py emit fix,
 * so every diagnostics-bearing surface failed the gate. Normalize exactly that
 * legal-intent shape (null → absent) before validation; any other deviation
 * still fails the gate unchanged.
 */
function normalizeDiagnosticWire(value: unknown): unknown {
	if (!isRecord(value) || !Array.isArray(value.diagnostics)) return value;
	let changed = false;
	const diagnostics = value.diagnostics.map((entry) => {
		if (!isRecord(entry) || entry.repair_hint !== null) return entry;
		changed = true;
		const { repair_hint: _dropped, ...rest } = entry;
		return rest;
	});
	return changed ? { ...value, diagnostics } : value;
}

/** Validate and brand an untrusted compiled-surface document. */
export function validateSurfaceArtifact(
	value: unknown,
	limits?: Partial<ArtifactValidationLimits>,
): ValidationResult<TrustedSurfaceArtifact> {
	value = normalizeDiagnosticWire(value);
	const limit = inspectComplexity(value, limitsWith(limits));
	if (limit) return { ok: false, issues: [limit] };
	const parsed = shallowSurfaceArtifactSchema.safeParse(value);
	if (!parsed.success) return { ok: false, issues: schemaIssues(parsed.error) };
	const document = parsed.data as SurfaceArtifactDocument;
	const dispatched = dispatchNodeIssue(document.tree, ["tree"]);
	if (dispatched) return { ok: false, issues: [dispatched] };
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

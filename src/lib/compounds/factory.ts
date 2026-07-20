/**
 * Morphe COMPOUND FACTORY — Lemma 1 ("Generativity"), algebraic closure.
 *
 * This is `createCompoundComponent` lifted from CODE to DATA. A compound is a
 * definition over primitives, expressed as data: (params schema + template tree
 * with ParamRef/Slot leaves). Expansion is HYGIENIC macro expansion:
 *   - ParamRef resolves ONLY against the compound's own params (never the call
 *     site).
 *   - Slot fills from the call site's `CompoundRef.slots[name]`.
 *
 * REGISTRATION-TIME VALIDATION (the gate that keeps render total):
 *   1. expand the template with schema-DEFAULT args,
 *   2. type-check the result against the grammar (every leaf is a known kind;
 *      no unresolved ParamRef remains),
 *   3. check ACYCLICITY of compound references,
 *   4. enforce a DEPTH BOUND on nested compound expansion.
 *
 * Result: vocabulary OPEN under composition (compounds may reference compounds)
 * while primitives P stay fixed and render stays total.
 *
 * Phase 0 uses a tiny TS-first JSON-Schema subset for params (object with typed
 * properties + defaults). The shape is deliberately a structural subset of JSON
 * Schema so the later lift to Pydantic-generated schemas is mechanical.
 */

import type { CompoundRef, Node, NodeKind, ParamRef, Slot } from "../grammar/types.js";
import { GRAMMAR_VERSION } from "../grammar/version.js";
import { PROMOTED_COMPOUNDS } from "./catalog.generated.js";

/* ---------------------------------------------------------------------------
 * Params schema — a minimal, structural JSON-Schema subset.
 * ------------------------------------------------------------------------- */

export type ParamType = "string" | "number" | "boolean" | "node" | "node-list";

export interface ParamSpec {
	readonly type: ParamType;
	readonly required?: boolean;
	/** Default used during registration-time expansion + when an arg is omitted. */
	readonly default?: unknown;
	readonly description?: string;
}

export interface ParamsSchema {
	readonly type: "object";
	readonly properties: Readonly<Record<string, ParamSpec>>;
}

/* ---------------------------------------------------------------------------
 * CompoundDef / registry.
 * ------------------------------------------------------------------------- */

export interface CompoundDef {
	readonly name: string;
	readonly version: string;
	readonly params: ParamsSchema;
	/** Template tree of primitives with ParamRef/Slot leaves. */
	readonly template: Node;
	readonly grammarVersion: string;
}

/** A registration outcome — never throws; downstream can branch on `.ok`. */
export type RegistrationResult =
	| { readonly ok: true; readonly name: string }
	| { readonly ok: false; readonly name: string; readonly errors: readonly string[] };

/** Structured failure for a schema-valid `CompoundRef` that violates its registered definition. */
export class CompoundReferenceError extends Error {
	readonly compound: string;
	readonly issues: readonly string[];

	constructor(compound: string, issues: readonly string[]) {
		super(`Invalid compound reference "${compound}": ${issues.join("; ")}`);
		this.name = "CompoundReferenceError";
		this.compound = compound;
		this.issues = issues;
	}
}

/**
 * The L1 minting lifecycle. Three producers mint compounds through ONE
 * pipeline — the design team (curated core), the agent (proposals), and
 * application code — and all three pass the SAME validation gate. The
 * lifecycle is the only difference: an agent proposal lands as `candidate`
 * and renders only where a dialect (or a dev flag) opts in; `promoted` is the
 * default visible set and the default state for everything registered today.
 */
export type CompoundLifecycle = "candidate" | "promoted";

export interface RegisterOptions {
	readonly lifecycle?: CompoundLifecycle;
}

/**
 * The render-facing registry protocol — what `<Node>`/`MorpheRoot` actually
 * consume. `CompoundRegistry` implements it directly; `restrictCompounds`
 * wraps one in a dialect-restricted VIEW that implements the same protocol,
 * so G|D's compound half is a decorator over the registry, never a mutation
 * of it.
 */
export interface CompoundResolver {
	/** The names visible through this resolver (for tooling / introspection). */
	readonly names: readonly string[];
	has(name: string): boolean;
	get(name: string): CompoundDef | undefined;
	expand(ref: CompoundRef): Node;
}

const MAX_EXPANSION_DEPTH = 16;

/**
 * The compound registry. Open for extension (register more compounds), closed
 * for modification (the gate is fixed). Multiple registries can coexist (DI):
 * the default export is the process-wide one, but a dialect can carry its own.
 */
export class CompoundRegistry implements CompoundResolver {
	#defs = new Map<string, CompoundDef>();
	#lifecycles = new Map<string, CompoundLifecycle>();

	/** All registered compound names (for tooling / introspection). */
	get names(): readonly string[] {
		return [...this.#defs.keys()];
	}

	/** The registered names in a given lifecycle state (the filtered variant). */
	namesOf(lifecycle: CompoundLifecycle): readonly string[] {
		return [...this.#defs.keys()].filter((name) => this.#lifecycles.get(name) === lifecycle);
	}

	has(name: string): boolean {
		return this.#defs.has(name);
	}

	get(name: string): CompoundDef | undefined {
		return this.#defs.get(name);
	}

	/** The lifecycle state of a registered compound (undefined if unknown). */
	lifecycleOf(name: string): CompoundLifecycle | undefined {
		return this.#lifecycles.get(name);
	}

	/**
	 * Register a compound through the validation gate. Returns a result rather
	 * than throwing, so a batch registration can collect failures. A failing
	 * compound is NOT added to the registry — render stays total.
	 *
	 * The gate is IDENTICAL for both lifecycle states (the gate is the gate);
	 * `lifecycle` only decides default visibility, never validity.
	 */
	register(def: CompoundDef, options: RegisterOptions = {}): RegistrationResult {
		const errors = this.#validate(def);
		if (errors.length > 0) return { ok: false, name: def.name, errors };
		this.#defs.set(def.name, def);
		this.#lifecycles.set(def.name, options.lifecycle ?? "promoted");
		return { ok: true, name: def.name };
	}

	/**
	 * Promote a candidate into the default visible set. Idempotent on an
	 * already-promoted name; `false` only for an unknown name (nothing to
	 * promote). Promotion never re-runs the gate — registration already proved
	 * the def valid, and the gate result cannot change after the fact.
	 */
	promote(name: string): boolean {
		if (!this.#defs.has(name)) return false;
		this.#lifecycles.set(name, "promoted");
		return true;
	}

	/**
	 * Expand a CompoundRef into a concrete Node tree (no Meta leaves remain that
	 * belong to this compound). ParamRefs resolve against `ref.args` (filled with
	 * schema defaults); Slots fill from `ref.slots`. Throws only on a corrupt
	 * call (unknown name) — well-formed refs always expand because registration
	 * already proved the template valid.
	 */
	expand(ref: CompoundRef): Node {
		const def = this.#defs.get(ref.name);
		if (!def) {
			throw new Error(`Unknown compound: ${ref.name}`);
		}
		const issues = this.#referenceIssues(def, ref);
		if (issues.length > 0) throw new CompoundReferenceError(ref.name, issues);
		const args = this.#withDefaults(def.params, ref.args);
		return this.#expandNode(def.template, {
			args,
			slots: ref.slots ?? {},
			depth: 0,
		});
	}

	/** Validate one call against the registered definition without expanding it. */
	referenceIssues(ref: CompoundRef): readonly string[] {
		const def = this.#defs.get(ref.name);
		return def ? this.#referenceIssues(def, ref) : [`unknown compound "${ref.name}"`];
	}

	/* ---- validation gate --------------------------------------------------- */

	#validate(def: CompoundDef): string[] {
		const errors: string[] = [];
		if (this.#defs.has(def.name)) {
			errors.push(`Compound "${def.name}" is already registered.`);
		}
		if (def.grammarVersion !== GRAMMAR_VERSION) {
			errors.push(
				`Compound "${def.name}" targets grammar ${def.grammarVersion}; runtime grammar is ${GRAMMAR_VERSION}.`,
			);
		}
		if (
			Object.hasOwn(def.template, "emphasis") &&
			Reflect.get(def.template, "emphasis") !== undefined
		) {
			errors.push(
				"Template root must not carry an emphasis claim; claim at the call site (CompoundRef.emphasis).",
			);
		}
		for (const [name, spec] of Object.entries(def.params.properties)) {
			if (spec.required === true && spec.default !== undefined) {
				errors.push(`Parameter "${name}" cannot be both required and defaulted.`);
			}
			if (spec.default !== undefined && !valueMatchesParamType(spec.default, spec.type)) {
				errors.push(`Default for parameter "${name}" is not a valid ${spec.type}.`);
			}
		}
		for (const param of paramRefsIn(def.template)) {
			if (!Object.hasOwn(def.params.properties, param)) {
				errors.push(`Template ParamRef "${param}" has no declared parameter.`);
			}
		}

		// Acyclicity: the closure of compound references reachable from this
		// template (including self) must not contain a cycle. We seed the graph
		// with the already-registered defs plus the candidate.
		const cycle = this.#findCycle(def);
		if (cycle) {
			errors.push(`Cyclic compound reference: ${cycle.join(" -> ")}`);
		}

		// Expand-with-defaults + grammar type-check. Only attempt if acyclic, to
		// avoid infinite expansion.
		if (!cycle) {
			try {
				const args = this.#registrationArgs(def.params);
				const expanded = this.#expandNode(def.template, {
					args,
					slots: {},
					depth: 0,
				});
				errors.push(...this.#typeCheck(expanded));
			} catch (e) {
				errors.push(
					`Expansion with default args failed: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
		}

		return errors;
	}

	#registrationArgs(schema: ParamsSchema): Record<string, unknown> {
		const args: Record<string, unknown> = {};
		for (const [name, spec] of Object.entries(schema.properties)) {
			args[name] = spec.default ?? defaultForType(spec.type);
		}
		return args;
	}

	#referenceIssues(def: CompoundDef, ref: CompoundRef): string[] {
		const issues: string[] = [];
		const args = isRecord(ref.args) ? ref.args : {};
		if (!isRecord(ref.args)) issues.push("arguments must be an object");
		for (const name of Object.keys(args)) {
			if (!Object.hasOwn(def.params.properties, name)) issues.push(`unknown argument "${name}"`);
		}
		for (const [name, spec] of Object.entries(def.params.properties)) {
			if (!Object.hasOwn(args, name)) {
				if (spec.required === true) issues.push(`missing required argument "${name}"`);
				continue;
			}
			if (!valueMatchesParamType(args[name], spec.type)) {
				issues.push(`argument "${name}" must be ${spec.type}`);
			}
		}

		const declaredSlots = new Set(slotNamesIn(def.template));
		const slots = ref.slots === undefined || isRecord(ref.slots) ? (ref.slots ?? {}) : {};
		if (ref.slots !== undefined && !isRecord(ref.slots)) issues.push("slots must be an object");
		for (const [name, fill] of Object.entries(slots)) {
			if (!declaredSlots.has(name)) issues.push(`unknown slot "${name}"`);
			if (!Array.isArray(fill) || !fill.every(isNodeLike)) {
				issues.push(`slot "${name}" must contain only nodes`);
			}
		}
		return issues;
	}

	/** DFS over the compound-reference graph to find a cycle through `def`. */
	#findCycle(candidate: CompoundDef): string[] | null {
		const resolve = (name: string): CompoundDef | undefined =>
			name === candidate.name ? candidate : this.#defs.get(name);

		const stack: string[] = [];
		const onPath = new Set<string>();

		const visit = (name: string): string[] | null => {
			if (onPath.has(name)) {
				const start = stack.indexOf(name);
				return [...stack.slice(start), name];
			}
			const def = resolve(name);
			if (!def) return null; // references a primitive-only or unknown; not a cycle
			onPath.add(name);
			stack.push(name);
			for (const child of compoundRefsIn(def.template)) {
				const found = visit(child);
				if (found) return found;
			}
			stack.pop();
			onPath.delete(name);
			return null;
		};

		return visit(candidate.name);
	}

	/** Verify every leaf is a known kind and no ParamRef leaked through. */
	#typeCheck(node: Node): string[] {
		const errors: string[] = [];
		const walk = (n: Node): void => {
			if (!KNOWN_KINDS.has(n.kind)) {
				errors.push(`Unknown node kind after expansion: ${String(n.kind)}`);
				return;
			}
			if (n.kind === "param-ref") {
				errors.push(`Unresolved ParamRef "${n.param}" after expansion.`);
			}
			for (const child of childrenOf(n)) walk(child);
		};
		walk(node);
		return errors;
	}

	/* ---- expansion --------------------------------------------------------- */

	#withDefaults(
		schema: ParamsSchema,
		args: Readonly<Record<string, unknown>>,
	): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const [key, spec] of Object.entries(schema.properties)) {
			if (Object.hasOwn(args, key)) out[key] = args[key];
			else if (spec.default !== undefined) out[key] = spec.default;
			else out[key] = defaultForType(spec.type);
		}
		return out;
	}

	#expandNode(
		node: Node,
		env: {
			readonly args: Readonly<Record<string, unknown>>;
			readonly slots: Readonly<Record<string, readonly Node[]>>;
			readonly depth: number;
		},
	): Node {
		if (env.depth > MAX_EXPANSION_DEPTH) {
			throw new Error(`Compound expansion exceeded depth bound (${MAX_EXPANSION_DEPTH}).`);
		}

		switch (node.kind) {
			case "param-ref":
				return resolveParamRef(node, env.args);
			case "compound": {
				// Nested compound: expand it (deeper), threading depth.
				const nested = this.#defs.get(node.name);
				if (!nested) throw new Error(`Unknown nested compound: ${node.name}`);
				const issues = this.#referenceIssues(nested, node);
				if (issues.length > 0) throw new CompoundReferenceError(node.name, issues);
				const nestedArgs = this.#withDefaults(nested.params, node.args);
				return this.#expandNode(nested.template, {
					args: nestedArgs,
					slots: node.slots ?? {},
					depth: env.depth + 1,
				});
			}
			case "table": {
				// A table is nested structure, not a flat child list: rebuild it
				// cell-by-cell so each cell's children expand under the ordinary
				// hygiene rules (ParamRefs resolve, Slots splice within the cell).
				return {
					...node,
					rows: node.rows.map((row) => ({
						...row,
						cells: row.cells.map((cell) => ({
							...cell,
							children: this.#expandChildList(cell.children, env),
						})),
						...(row.diagnostics === undefined
							? {}
							: { diagnostics: this.#expandChildList(row.diagnostics, env) }),
					})),
				};
			}
			default: {
				// Recurse into children, expanding Slots inline.
				const kids = childrenOf(node);
				if (kids.length === 0) return node;
				return withChildren(node, this.#expandChildList(kids, env));
			}
		}
	}

	#expandChildList(
		kids: readonly Node[],
		env: {
			readonly args: Readonly<Record<string, unknown>>;
			readonly slots: Readonly<Record<string, readonly Node[]>>;
			readonly depth: number;
		},
	): Node[] {
		const expandedKids: Node[] = [];
		for (const kid of kids) {
			const paramValue = kid.kind === "param-ref" ? env.args[kid.param] : undefined;
			if (kid.kind === "slot") {
				expandedKids.push(...this.#fillSlot(kid, env));
			} else if (kid.kind === "param-ref" && Array.isArray(paramValue)) {
				if (!paramValue.every(isNodeLike)) {
					throw new Error(`Node-list parameter "${kid.param}" contains a non-node value.`);
				}
				expandedKids.push(...paramValue.map((item) => this.#expandNode(item, env)));
			} else {
				expandedKids.push(this.#expandNode(kid, env));
			}
		}
		return expandedKids;
	}

	#fillSlot(
		s: Slot,
		env: {
			readonly args: Readonly<Record<string, unknown>>;
			readonly slots: Readonly<Record<string, readonly Node[]>>;
			readonly depth: number;
		},
	): Node[] {
		const fill = env.slots[s.name] ?? s.fallback ?? [];
		return fill.map((n) => this.#expandNode(n, env));
	}
}

/* ---------------------------------------------------------------------------
 * Dialect-restricted view — G|D's compound half (Lemma 4).
 * ------------------------------------------------------------------------- */

export interface RestrictOptions {
	/**
	 * The dialect's allowed compound subset (`Dialect.compounds`). EMPTY means
	 * unrestricted — the compatibility policy: a dialect that declares no
	 * subset sees every promoted compound. Non-empty means a name outside the
	 * list is treated as UNKNOWN (renders nothing + dev-warns via the renderer's
	 * existing totality guard; never throws).
	 */
	readonly allow: readonly string[];
	/**
	 * Dev flag: make `candidate` compounds visible without a dialect opt-in
	 * (tooling/preview surfaces). Defaults to false — promoted is the default
	 * visible set.
	 */
	readonly showCandidates?: boolean;
}

/**
 * Wrap a registry in a dialect-restricted view (decorator — the base registry
 * is NEVER mutated; multiple roots can hold different views over the same
 * singleton). Visibility through the view:
 *
 *   - unregistered            → invisible (as on the base)
 *   - outside a non-empty allowlist → invisible (out-of-dialect = unknown)
 *   - `candidate` lifecycle   → visible only if the dialect names it in its
 *     allowlist (an explicit opt-in) or `showCandidates` is set
 *   - otherwise               → visible
 *
 * With an empty allowlist and only promoted compounds the view is
 * behavior-identical to the base.
 */
export function restrictCompounds(
	base: CompoundRegistry,
	options: RestrictOptions,
): CompoundResolver {
	const allow = new Set(options.allow);
	const showCandidates = options.showCandidates ?? false;

	const visible = (name: string): boolean => {
		if (!base.has(name)) return false;
		if (allow.size > 0 && !allow.has(name)) return false;
		if (base.lifecycleOf(name) === "candidate") {
			return showCandidates || allow.has(name);
		}
		return true;
	};

	return {
		get names(): readonly string[] {
			return base.names.filter(visible);
		},
		has: visible,
		get: (name) => (visible(name) ? base.get(name) : undefined),
		expand: (ref) => {
			if (!visible(ref.name)) {
				// Same contract as the base's unknown-name case: expand() throws
				// only on a corrupt call. The renderer never reaches this — it
				// checks has() first and renders nothing for an invisible name.
				throw new Error(`Unknown compound: ${ref.name}`);
			}
			return base.expand(ref);
		},
	};
}

/* ---------------------------------------------------------------------------
 * Pure structural helpers — no dependency on the registry.
 * ------------------------------------------------------------------------- */

const KNOWN_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
	"stack",
	"grid",
	"cluster",
	"frame",
	"spacer",
	"table",
	"text",
	"number",
	"badge",
	"icon",
	"trend",
	"media",
	"field",
	"select",
	"toggle",
	"range",
	"progress",
	"status",
	"inline-alert",
	"button",
	"link",
	"dialog",
	"popover",
	"disclosure",
	"slot",
	"param-ref",
	"vary",
	"within",
	"compound",
]);

/** The child Nodes of any node (empty for leaves). Single source of truth. */
export function childrenOf(node: Node): readonly Node[] {
	switch (node.kind) {
		case "stack":
		case "grid":
		case "cluster":
		case "frame":
		case "dialog":
		case "popover":
		case "disclosure":
			return node.children;
		case "vary":
			return node.options;
		case "slot":
			return node.fallback ?? [];
		case "within":
			return node.target === undefined ? [] : [node.target];
		case "table":
			// Read-only flattening for walks (type-check, ref/slot discovery,
			// cycle detection). Expansion never uses this path — #expandNode
			// rebuilds a table cell-by-cell so the nested shape is preserved.
			return node.rows.flatMap((row) => [
				...row.cells.flatMap((cell) => cell.children),
				...(row.diagnostics ?? []),
			]);
		default:
			return [];
	}
}

/** Reconstruct a container node with new children (immutably). */
function withChildren(node: Node, children: Node[]): Node {
	switch (node.kind) {
		case "stack":
		case "grid":
		case "cluster":
		case "frame":
		case "dialog":
		case "popover":
		case "disclosure":
			return { ...node, children };
		case "vary":
			return { ...node, options: children };
		case "within": {
			if (node.target === undefined) return node;
			const [target] = children;
			if (children.length !== 1 || target === undefined) {
				throw new Error(
					`Within target expansion must produce exactly one node; received ${children.length}.`,
				);
			}
			return { ...node, target };
		}
		default:
			return node;
	}
}

/** Collect the names of compounds directly referenced in a template. */
function compoundRefsIn(node: Node): string[] {
	const names: string[] = [];
	const walk = (n: Node): void => {
		if (n.kind === "compound") names.push(n.name);
		for (const child of childrenOf(n)) walk(child);
	};
	walk(node);
	return names;
}

/** Collect template parameter references, including refs nested in containers. */
function paramRefsIn(node: Node): string[] {
	const names: string[] = [];
	const walk = (current: Node): void => {
		if (current.kind === "param-ref") names.push(current.param);
		for (const child of childrenOf(current)) walk(child);
	};
	walk(node);
	return names;
}

/** Collect the declared slot vocabulary of a compound template. */
function slotNamesIn(node: Node): string[] {
	const names: string[] = [];
	const walk = (current: Node): void => {
		if (current.kind === "slot") names.push(current.name);
		for (const child of childrenOf(current)) walk(child);
	};
	walk(node);
	return names;
}

/**
 * Resolve a ParamRef against the compound's bound args. If the bound value is a
 * Node, it is spliced; otherwise it is coerced to a Text node so the result is
 * always a valid grammar leaf (keeps render total).
 */
function resolveParamRef(ref: ParamRef, args: Readonly<Record<string, unknown>>): Node {
	const value = args[ref.param];
	if (Array.isArray(value)) {
		throw new Error(`Node-list parameter "${ref.param}" must appear in a child list.`);
	}
	if (value !== null && typeof value === "object" && Object.hasOwn(value, "kind")) {
		return value as Node;
	}
	return { kind: "text", value: value === undefined ? "" : String(value) };
}

export function isNodeLike(value: unknown): value is Node {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	try {
		const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
		if (!descriptor || !("value" in descriptor)) return false;
		return typeof descriptor.value === "string" && KNOWN_KINDS.has(descriptor.value as NodeKind);
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueMatchesParamType(value: unknown, type: ParamType): boolean {
	switch (type) {
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "boolean":
			return typeof value === "boolean";
		case "node":
			return isNodeLike(value);
		case "node-list":
			return Array.isArray(value) && value.every(isNodeLike);
	}
}

function defaultForType(type: ParamType): unknown {
	switch (type) {
		case "string":
			return "";
		case "number":
			return 0;
		case "boolean":
			return false;
		case "node":
			return { kind: "text", value: "" } satisfies Node;
		case "node-list":
			return [];
	}
}

/** Process-wide default registry, seeded from the Pydantic-owned promoted catalog. */
export const registry = new CompoundRegistry();
for (const definition of PROMOTED_COMPOUNDS) {
	const result = registry.register(definition);
	if (!result.ok) {
		throw new Error(
			`Generated promoted compound "${definition.name}" failed registration: ${result.errors.join("; ")}`,
		);
	}
}

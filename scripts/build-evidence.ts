/**
 * build-evidence.ts — the GROUNDING-EVIDENCE index.
 *
 * The factual spine of the Morphe composer: every capability cites a REAL
 * endpoint + REAL compiled-model name, so a claim becomes an artifact you can
 * verify. Endpoints live ONLY in the raw OpenAPI specs (the dmcg .py files have
 * no operations), so we parse the raw specs directly and LENIENTLY — plain
 * JSON.parse + walk, no validating OpenAPI library, because the specs carry
 * known defects (notably KRA-271, the Hyle path bug: double-brace placeholders
 * and query strings baked into Humanity path keys).
 *
 * Run: bun scripts/build-evidence.ts
 *
 * Emits (committed grounding artifacts; the raw specs stay gitignored):
 *   data/evidence/humanity.json
 *   data/evidence/dkplus.json
 *   data/evidence/catalog.md
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Direction = "read" | "write";

interface Operation {
	operationId: string;
	method: string;
	path: string;
	summary: string;
	tags: string[];
	direction: Direction;
	model?: string;
}

interface EvidenceIndex {
	system: string;
	label: string;
	specVersion: string;
	source: string;
	operationCount: number;
	modelCount: number;
	operations: Operation[];
	models: string[];
}

const HTTP_METHODS = ["get", "put", "post", "patch", "delete"] as const;

const HUMANITY_SPEC = "/home/rationallyprime/projects/humanity-schedule-v2.openapi.json";
const DKPLUS_SPEC =
	"/home/rationallyprime/projects/mcp-registry/dk-mcp/openapi/dkplus_swagger_2_0.json";

const EVIDENCE_DIR = resolve(import.meta.dirname, "..", "data", "evidence");

/** Lenient JSON spec — we never trust its shape, we walk it defensively. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

function isObject(value: JsonValue | undefined): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: JsonValue | undefined): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function readSpec(path: string): JsonObject {
	const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`Spec at ${path} did not parse to an object`);
	}
	return parsed as JsonObject;
}

function directionFor(method: string): Direction {
	return method === "GET" ? "read" : "write";
}

/**
 * Sanitize a Humanity path key (KRA-271, the Hyle path bug):
 *   - strip everything from the first query introducer, "?" OR "&" (a query
 *     string baked into the key — some keys begin the query with "&", e.g.
 *     "/forecast&access_token=xxxxxxx", so cutting only at "?" leaks a fake token)
 *   - replace `{{x}}` double-brace placeholders with single-brace `{x}`
 *   - collapse duplicate slashes
 * Idempotent and safe on already-clean keys (e.g. dkPlus paths).
 */
function sanitizePath(raw: string): string {
	let path = raw;
	const cuts = [path.indexOf("?"), path.indexOf("&")].filter((i) => i !== -1);
	if (cuts.length > 0) {
		path = path.slice(0, Math.min(...cuts));
	}
	path = path.replace(/\{\{([^}]*)\}\}/g, "{$1}");
	path = path.replace(/\/{2,}/g, "/");
	if (path.length > 1 && path.endsWith("/")) {
		path = path.slice(0, -1);
	}
	return path === "" ? "/" : path;
}

/** First non-empty trimmed line of a (possibly multi-line) description. */
function firstLine(description: string | undefined): string {
	if (!description) {
		return "";
	}
	for (const line of description.split("\n")) {
		const trimmed = line.trim();
		if (trimmed !== "") {
			return trimmed;
		}
	}
	return "";
}

/** Resolve a definition name from a Swagger schema node: direct $ref, array items $ref, or nested schema. */
function refName(schema: JsonValue | undefined): string | undefined {
	if (!isObject(schema)) {
		return undefined;
	}
	const ref = asString(schema.$ref);
	if (ref) {
		return ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
	}
	if (isObject(schema.items)) {
		const itemRef = refName(schema.items);
		if (itemRef) {
			return itemRef;
		}
	}
	if (isObject(schema.schema)) {
		return refName(schema.schema);
	}
	return undefined;
}

function twoXxCodes(responses: JsonObject): string[] {
	return Object.keys(responses).filter((code) => /^2/.test(code));
}

/** dkPlus (Swagger 2.0): model = a 2xx response $ref, else a body param $ref. */
function dkPlusModel(op: JsonObject): string | undefined {
	const responses = op.responses;
	if (isObject(responses)) {
		for (const code of twoXxCodes(responses)) {
			const resp = responses[code];
			if (isObject(resp)) {
				const name = refName(resp.schema);
				if (name) {
					return name;
				}
			}
		}
	}
	const params = op.parameters;
	if (Array.isArray(params)) {
		for (const param of params) {
			if (isObject(param) && param.in === "body") {
				const name = refName(param.schema);
				if (name) {
					return name;
				}
			}
		}
	}
	return undefined;
}

/** Humanity (OpenAPI 3.1): model = inline 2xx-response schema `title`, if present. */
function humanityModel(op: JsonObject): string | undefined {
	const responses = op.responses;
	if (!isObject(responses)) {
		return undefined;
	}
	for (const code of twoXxCodes(responses)) {
		const resp = responses[code];
		if (!isObject(resp)) {
			continue;
		}
		const content = resp.content;
		if (!isObject(content)) {
			continue;
		}
		for (const mediaType of Object.values(content)) {
			if (isObject(mediaType)) {
				const title = isObject(mediaType.schema) ? asString(mediaType.schema.title) : undefined;
				if (title) {
					return title;
				}
			}
		}
	}
	return undefined;
}

interface SpecConfig {
	system: string;
	label: string;
	source: string;
	specVersionKey: "swagger" | "openapi";
	modelFor: (op: JsonObject) => string | undefined;
}

function buildIndex(spec: JsonObject, config: SpecConfig): EvidenceIndex {
	const operations: Operation[] = [];
	const inlineModels = new Set<string>();

	const paths = spec.paths;
	if (isObject(paths)) {
		for (const [rawPath, pathItem] of Object.entries(paths)) {
			if (!isObject(pathItem)) {
				continue;
			}
			const cleanPath = sanitizePath(rawPath);
			for (const method of HTTP_METHODS) {
				const op = pathItem[method];
				if (!isObject(op)) {
					continue;
				}
				const upper = method.toUpperCase();
				const operationId = asString(op.operationId) ?? `${upper} ${cleanPath}`;
				const summary = asString(op.summary)?.trim() || firstLine(asString(op.description));
				const tags = Array.isArray(op.tags)
					? op.tags.filter((t): t is string => typeof t === "string")
					: [];
				const model = config.modelFor(op);
				const operation: Operation = {
					operationId,
					method: upper,
					path: cleanPath,
					summary,
					tags,
					direction: directionFor(upper),
				};
				if (model !== undefined) {
					operation.model = model;
					inlineModels.add(model);
				}
				operations.push(operation);
			}
		}
	}

	// Stable ordering: first tag (untagged last), then path, then method.
	operations.sort((a, b) => {
		const tagA = a.tags[0] ?? "￿";
		const tagB = b.tags[0] ?? "￿";
		if (tagA !== tagB) {
			return tagA.localeCompare(tagB);
		}
		if (a.path !== b.path) {
			return a.path.localeCompare(b.path);
		}
		return a.method.localeCompare(b.method);
	});

	// Models: dkPlus -> definition keys; Humanity -> distinct inline titles.
	let models: string[];
	const definitions = spec.definitions;
	if (isObject(definitions) && Object.keys(definitions).length > 0) {
		models = Object.keys(definitions).sort((a, b) => a.localeCompare(b));
	} else {
		models = [...inlineModels].sort((a, b) => a.localeCompare(b));
	}

	const specVersion = asString(spec[config.specVersionKey]) ?? "unknown";

	return {
		system: config.system,
		label: config.label,
		specVersion,
		source: config.source,
		operationCount: operations.length,
		modelCount: models.length,
		operations,
		models,
	};
}

function groupByTag(operations: Operation[]): Map<string, Operation[]> {
	const groups = new Map<string, Operation[]>();
	for (const op of operations) {
		const tag = op.tags[0] ?? "Untagged";
		const bucket = groups.get(tag);
		if (bucket) {
			bucket.push(op);
		} else {
			groups.set(tag, [op]);
		}
	}
	return groups;
}

function renderCatalogSection(index: EvidenceIndex): string {
	const lines: string[] = [];
	lines.push(`## ${index.label}`);
	lines.push("");
	lines.push(
		`Spec: ${index.specVersion} · ${index.operationCount} operations · ${index.modelCount} models · \`${index.source}\``,
	);
	lines.push("");

	const groups = groupByTag(index.operations);
	const tagNames = [...groups.keys()].sort((a, b) => {
		if (a === "Untagged") {
			return 1;
		}
		if (b === "Untagged") {
			return -1;
		}
		return a.localeCompare(b);
	});

	for (const tag of tagNames) {
		const ops = groups.get(tag) ?? [];
		lines.push(`### ${tag}`);
		lines.push("");
		for (const op of ops) {
			const model = op.model ? ` → \`${op.model}\`` : "";
			const summary = op.summary || "(no summary)";
			lines.push(
				`- \`${op.method} ${op.path}\` — ${summary} (${op.operationId})${model}`,
			);
		}
		lines.push("");
	}

	lines.push(`### Models (${index.modelCount})`);
	lines.push("");
	for (const model of index.models) {
		lines.push(`- \`${model}\``);
	}
	lines.push("");

	return lines.join("\n");
}

function writeJson(path: string, index: EvidenceIndex): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(index, null, "\t")}\n`, "utf8");
}

function main(): void {
	const humanity = buildIndex(readSpec(HUMANITY_SPEC), {
		system: "humanity",
		label: "Humanity (Schedule v2)",
		source: HUMANITY_SPEC,
		specVersionKey: "openapi",
		modelFor: humanityModel,
	});

	const dkplus = buildIndex(readSpec(DKPLUS_SPEC), {
		system: "dkplus",
		label: "dkPlus",
		source: DKPLUS_SPEC,
		specVersionKey: "swagger",
		modelFor: dkPlusModel,
	});

	const humanityPath = resolve(EVIDENCE_DIR, "humanity.json");
	const dkplusPath = resolve(EVIDENCE_DIR, "dkplus.json");
	const catalogPath = resolve(EVIDENCE_DIR, "catalog.md");

	writeJson(humanityPath, humanity);
	writeJson(dkplusPath, dkplus);

	const catalog = [
		"# Grounding-Evidence Catalog",
		"",
		"Generated by `scripts/build-evidence.ts`. The factual spine of the Morphe composer:",
		"every capability cites a REAL endpoint + REAL compiled-model name — not a claim, an",
		"artifact you can verify. Operations are grouped by tag; `→` marks the bound model.",
		"",
		renderCatalogSection(humanity),
		renderCatalogSection(dkplus),
	].join("\n");
	mkdirSync(dirname(catalogPath), { recursive: true });
	writeFileSync(catalogPath, `${catalog}`, "utf8");

	for (const index of [humanity, dkplus]) {
		// biome-ignore lint/suspicious/noConsole: build script progress output.
		console.log(
			`${index.system}: ${index.operationCount} operations, ${index.modelCount} models`,
		);
	}
	// biome-ignore lint/suspicious/noConsole: build script progress output.
	console.log(`wrote ${humanityPath}`);
	// biome-ignore lint/suspicious/noConsole: build script progress output.
	console.log(`wrote ${dkplusPath}`);
	// biome-ignore lint/suspicious/noConsole: build script progress output.
	console.log(`wrote ${catalogPath}`);
}

main();

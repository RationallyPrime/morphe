/*
 * /preview/<artifactId>/<revisionId> — renders a CMS compiled tree through the real
 * MorpheRoot. v0 reads the compiled-tree JSON the Python gate wrote (the boundary is
 * a file of validate_node-valid Node JSON). Local/dev only; production persistence is
 * the later-DB step (see docs/superpowers/specs/2026-06-22-morphe-agent-native-cms-design.md).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import type { Node } from "$lib";
import { DEMO_DIALECT_ID, demoArtifactTree, isDemoPreview } from "../../../_demo/artifact.js";
import {
	parseLocalCompiledTree,
	validateCompiledTreeDialect,
} from "../../../_demo/compiled-artifact.js";
import type { PageServerLoad } from "./$types";

const ARTIFACT_PREFIX = /^capability-page\./;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REV_RE = /^rev-\d{3}$/;

function resolveDialect(tree: Node, storedDialectId: string, requested: string | null): string {
	const result = validateCompiledTreeDialect(tree, requested ?? storedDialectId);
	if (!result.ok) {
		throw error(requested === null ? 500 : 400, `Preview dialect rejected: ${result.reason}`);
	}
	return result.dialectId;
}

function resolveViewport(requested: string | null): "mobile" | "desktop" {
	if (requested === null || requested === "desktop") return "desktop";
	if (requested === "mobile") return "mobile";
	throw error(400, `Unknown preview viewport "${requested}"`);
}

export const load: PageServerLoad = async ({ params, url }) => {
	const requestedDialect = url.searchParams.get("dialect");
	const viewport = resolveViewport(url.searchParams.get("viewport"));
	const slug = params.artifactId.replace(ARTIFACT_PREFIX, "");
	if (!SLUG_RE.test(slug) || !REV_RE.test(params.revisionId)) {
		throw error(404, "Invalid artifact reference");
	}
	const path = join(
		process.cwd(),
		"compiled",
		"capability-pages",
		slug,
		`${params.revisionId}.tree.json`,
	);

	let source: string;
	try {
		source = await readFile(path, "utf-8");
	} catch {
		if (isDemoPreview(params.artifactId, params.revisionId)) {
			return {
				tree: demoArtifactTree,
				dialectId: resolveDialect(demoArtifactTree, DEMO_DIALECT_ID, requestedDialect),
				viewport,
			};
		}
		throw error(404, `No compiled tree for ${params.artifactId}/${params.revisionId}`);
	}
	let document: unknown;
	try {
		document = JSON.parse(source);
	} catch {
		throw error(500, "Stored compiled artifact is not valid JSON");
	}
	const parsed = parseLocalCompiledTree(document, params.artifactId, params.revisionId);
	if (!parsed.ok)
		throw error(500, `Stored compiled artifact failed its trust gate: ${parsed.reason}`);

	const dialectId = resolveDialect(parsed.value.tree, parsed.value.dialectId, requestedDialect);
	return { tree: parsed.value.tree, dialectId, viewport };
};

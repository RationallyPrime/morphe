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
import type { PageServerLoad } from "./$types";

interface CompiledTreeFile {
	tree: Node;
	render_hints: { dialect: string };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = params.artifactId.replace(/^capability-page\./, "");
	const path = join(
		process.cwd(),
		"compiled",
		"capability-pages",
		slug,
		`${params.revisionId}.tree.json`,
	);

	let parsed: CompiledTreeFile;
	try {
		parsed = JSON.parse(await readFile(path, "utf-8")) as CompiledTreeFile;
	} catch {
		throw error(404, `No compiled tree for ${params.artifactId}/${params.revisionId}`);
	}

	const dialectId = url.searchParams.get("dialect") ?? parsed.render_hints.dialect;
	return { tree: parsed.tree, dialectId };
};

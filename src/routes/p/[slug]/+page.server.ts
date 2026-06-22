/*
 * /p/<slug> — the public publication pointer. Resolves publications.json -> revision ->
 * compiled tree -> MorpheRoot. Publishing is pointer movement; this route follows it.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import type { Node } from "$lib";
import type { PageServerLoad } from "./$types";

interface PublicationFile {
	revision_id: string;
}
interface CompiledTreeFile {
	tree: Node;
	render_hints: { dialect: string };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const root = process.cwd();
	let publications: Record<string, PublicationFile>;
	try {
		publications = JSON.parse(await readFile(join(root, "publications.json"), "utf-8")) as Record<
			string,
			PublicationFile
		>;
	} catch {
		throw error(404, "No publications");
	}
	const pub = publications[params.slug];
	if (!pub) throw error(404, `No publication for ${params.slug}`);

	const path = join(
		root,
		"compiled",
		"capability-pages",
		params.slug,
		`${pub.revision_id}.tree.json`,
	);
	let parsed: CompiledTreeFile;
	try {
		parsed = JSON.parse(await readFile(path, "utf-8")) as CompiledTreeFile;
	} catch {
		throw error(404, `Missing compiled tree for ${params.slug}`);
	}

	const dialectId = url.searchParams.get("dialect") ?? parsed.render_hints.dialect;
	return { tree: parsed.tree, dialectId };
};

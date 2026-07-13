/*
 * /p/<slug> — the public publication pointer. Resolves publications.json -> revision ->
 * compiled tree -> MorpheRoot. Publishing is pointer movement; this route follows it.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { DEMO_DIALECT_ID, DEMO_PUBLICATION_SLUG, demoArtifactTree } from "../../_demo/artifact.js";
import { parseLocalCompiledTree } from "../../_demo/compiled-artifact.js";
import type { PageServerLoad } from "./$types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REV_RE = /^rev-\d{3}$/;

interface PublicationFile {
	revision_id: string;
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
		if (params.slug === DEMO_PUBLICATION_SLUG) {
			return {
				tree: demoArtifactTree,
				dialectId: url.searchParams.get("dialect") ?? DEMO_DIALECT_ID,
			};
		}
		throw error(404, "No publications");
	}
	const pub = publications[params.slug];
	if (!pub) {
		if (params.slug === DEMO_PUBLICATION_SLUG) {
			return {
				tree: demoArtifactTree,
				dialectId: url.searchParams.get("dialect") ?? DEMO_DIALECT_ID,
			};
		}
		throw error(404, `No publication for ${params.slug}`);
	}
	if (!SLUG_RE.test(params.slug) || !REV_RE.test(pub.revision_id)) {
		throw error(404, "Invalid publication pointer");
	}

	const path = join(
		root,
		"compiled",
		"capability-pages",
		params.slug,
		`${pub.revision_id}.tree.json`,
	);
	let source: string;
	try {
		source = await readFile(path, "utf-8");
	} catch {
		throw error(404, `Missing compiled tree for ${params.slug}`);
	}
	let document: unknown;
	try {
		document = JSON.parse(source);
	} catch {
		throw error(500, "Published compiled artifact is not valid JSON");
	}
	const artifactId = `capability-page.${params.slug}`;
	const parsed = parseLocalCompiledTree(document, artifactId, pub.revision_id);
	if (!parsed.ok) {
		throw error(500, `Published compiled artifact failed its trust gate: ${parsed.reason}`);
	}

	const dialectId = url.searchParams.get("dialect") ?? parsed.value.dialectId;
	return { tree: parsed.value.tree, dialectId };
};

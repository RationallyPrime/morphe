import type { Node } from "$lib";

/*
 * Title for a DERIVED (family-mode drill-through) pane instance.
 *
 * A pinned pane renders under its declared title. A drill-through carries
 * forwarded params, so the producer emits a param-scoped instance whose
 * declared title (e.g. the pinned representative's name) no longer describes
 * it. The artifact already announces itself — its leading display/heading
 * text — so the chrome reads that instead of echoing the wrong pin.
 *
 * The walk is document order and STOPS at the first display-or-heading text:
 * the same node the surface presents as its own name. No kernel shapes, no
 * per-source cases — any surface that leads with a title gets the right crumb.
 */

const TITLE_ROLES: ReadonlySet<string> = new Set(["display", "heading"]);

export function derivedSurfaceTitle(tree: Node): string | undefined {
	if (tree.kind === "text" && tree.as !== undefined && TITLE_ROLES.has(tree.as)) {
		const value = tree.value.trim();
		return value === "" ? undefined : value;
	}
	const children = childrenOf(tree);
	for (const child of children) {
		const found = derivedSurfaceTitle(child);
		if (found !== undefined) return found;
	}
	return undefined;
}

function childrenOf(node: Node): readonly Node[] {
	if ("children" in node && Array.isArray(node.children)) {
		return node.children as readonly Node[];
	}
	if ("slots" in node && node.slots !== undefined) {
		return Object.values(node.slots).flat() as readonly Node[];
	}
	return [];
}

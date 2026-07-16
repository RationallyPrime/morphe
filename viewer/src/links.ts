/**
 * Kernel-link rewiring at the trust gate.
 *
 * A kernel compiles links against ITS OWN origin (`/books/{id}/surfaces/overview`);
 * inside the viewer those hrefs are meaningless. After the gate passes, every link in
 * a kernel tree is resolved against the source's DECLARED surface paths:
 *
 * - path matches a declared entry (query ignored) → rewritten to `/s/{source}/{id}`
 * - absolute http(s) href                         → left alone (a real external link)
 * - any other kernel-relative href                → DEGRADED to plain text
 *
 * The degrade mirrors the compiler's own absent-href rule (a relation that cannot
 * resolve is not a link) — a dead in-viewer 404 is worse than honest text. The
 * transform maps link→link or link→text, both valid in every Node position, so the
 * gated tree stays gate-valid by construction.
 */

import type { Node } from "$lib";
import type { KernelSurfaceEntry, SourceConfig } from "./sources.js";

export function rewriteKernelLinks(tree: Node, source: SourceConfig): Node {
	const routes = declaredRoutes(source);
	return walk(tree, routes) as Node;
}

/** Declared path (query stripped) → viewer pane href. First declaration wins. */
function declaredRoutes(source: SourceConfig): ReadonlyMap<string, string> {
	const routes = new Map<string, string>();
	for (const entry of source.surfaces) {
		if (!("path" in entry)) continue;
		const path = pathOnly((entry as KernelSurfaceEntry).path);
		if (!routes.has(path)) routes.set(path, `/s/${source.id}/${entry.id}`);
	}
	return routes;
}

function pathOnly(href: string): string {
	const cut = href.search(/[?#]/);
	return cut === -1 ? href : href.slice(0, cut);
}

function isExternal(href: string): boolean {
	return /^https?:\/\//.test(href);
}

function walk(value: unknown, routes: ReadonlyMap<string, string>): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => walk(item, routes));
	}
	if (typeof value !== "object" || value === null) return value;
	const record = value as Record<string, unknown>;
	if (record.kind === "link" && typeof record.href === "string") {
		return rewriteLink(record, routes);
	}
	const out: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(record)) {
		out[key] = walk(child, routes);
	}
	return out;
}

function rewriteLink(
	link: Record<string, unknown>,
	routes: ReadonlyMap<string, string>,
): Record<string, unknown> {
	const href = link.href as string;
	if (isExternal(href)) return link;
	const pane = routes.get(pathOnly(href));
	if (pane !== undefined) return { ...link, href: pane };
	const label = typeof link.label === "string" ? link.label : "";
	return { kind: "text", value: label, as: "body" };
}

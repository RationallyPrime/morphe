import { describe, expect, it } from "vitest";
import type { Node } from "$lib";
import { rewriteKernelLinks } from "./links.js";
import type { SourceConfig } from "./sources.js";

const ZYGOS: SourceConfig = {
	id: "zygos",
	title: "zygos — money",
	kind: "kernel",
	baseUrl: "http://demo-zygos:8000",
	governedParams: ["include_pii"],
	surfaces: [
		{ id: "books", title: "Books", path: "/surfaces/books" },
		{
			id: "overview",
			title: "Overview",
			path: "/books/b-1/surfaces/overview?window=2026-07",
		},
	],
};

function link(href: string, label = "Open"): Node {
	return { kind: "link", href, label };
}

describe("rewriteKernelLinks", () => {
	it("rewrites a declared kernel path (matched by path) to the viewer pane", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [link("/books/b-1/surfaces/overview")],
		};
		const rewritten = rewriteKernelLinks(tree, ZYGOS);
		expect(rewritten).toEqual({
			kind: "stack",
			role: "section",
			children: [{ kind: "link", href: "/s/zygos/overview", label: "Open" }],
		});
	});

	it("carries a filter query forward onto the rewritten viewer href", () => {
		// The path matches `overview` (its declared query is ignored for MATCHING);
		// the link's own query is preserved so a filtered drill actually filters.
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [link("/books/b-1/surfaces/overview?party_id=p-7", "Björn")],
		};
		const rewritten = rewriteKernelLinks(tree, ZYGOS) as unknown as { children: Node[] };
		expect(rewritten.children[0]).toEqual({
			kind: "link",
			href: "/s/zygos/overview?party_id=p-7",
			label: "Björn",
		});
	});

	it("degrades an undeclared kernel-relative link to text, keeping its label", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [link("/books/OTHER/surfaces/overview", "Aðalbók")],
		};
		const rewritten = rewriteKernelLinks(tree, ZYGOS) as unknown as { children: Node[] };
		expect(rewritten.children[0]).toEqual({ kind: "text", value: "Aðalbók", as: "body" });
	});

	it("leaves absolute external links alone", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [link("https://example.is/docs", "Docs")],
		};
		const rewritten = rewriteKernelLinks(tree, ZYGOS) as unknown as { children: Node[] };
		expect(rewritten.children[0]).toEqual(link("https://example.is/docs", "Docs"));
	});

	it("reaches links nested in within targets, compound slots, and vary options", () => {
		const tree: Node = {
			kind: "within",
			id: "$.detail",
			dimension: "collapse",
			range: [0, 1],
			default: 1,
			summary: "Detail",
			target: {
				kind: "compound",
				name: "SignalCard",
				args: {
					kicker: { kind: "text", value: "K", as: "caption" },
					title: { kind: "text", value: "T", as: "subheading" },
				},
				slots: { body: [link("/surfaces/books", "Books")] },
			},
		};
		const rewritten = rewriteKernelLinks(tree, ZYGOS) as unknown as {
			target: { slots: { body: Node[] } };
		};
		expect(rewritten.target.slots.body[0]).toEqual({
			kind: "link",
			href: "/s/zygos/books",
			label: "Books",
		});
	});

	it("is a no-op for trees without links", () => {
		const tree: Node = {
			kind: "frame",
			role: "page",
			surface: "base",
			children: [{ kind: "text", value: "Nothing to rewire", as: "body" }],
		};
		expect(rewriteKernelLinks(tree, ZYGOS)).toEqual(tree);
	});
});

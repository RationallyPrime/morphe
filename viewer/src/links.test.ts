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
		{
			id: "books",
			title: "Books",
			path: "/surfaces/books",
			representation: "source-v1",
			sourceSurfaceId: "zygos.books:demo",
		},
		{
			id: "overview",
			title: "Overview",
			path: "/books/b-1/surfaces/overview?window=2026-07",
			representation: "source-v1",
			sourceSurfaceId: "zygos.overview:b-1:2026-07",
		},
	],
};

function link(href: string, label = "Open"): Node {
	return { kind: "link", href, label };
}

function alert(href?: string): Node {
	return {
		kind: "inline-alert",
		tone: "caution",
		title: "1 live violation",
		...(href === undefined ? {} : { href }),
	};
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

	it("rewrites feedback drills through the same declared-pane map", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [
				{
					kind: "status",
					tone: "caution",
					signal: { text: "1 live violation" },
					href: "/books/b-1/surfaces/overview?party_id=p-7",
				},
				alert("/surfaces/books"),
			],
		};
		const rewritten = rewriteKernelLinks(tree, ZYGOS) as unknown as { children: Node[] };
		expect(rewritten.children).toEqual([
			{
				kind: "status",
				tone: "caution",
				signal: { text: "1 live violation" },
				href: "/s/zygos/overview?party_id=p-7",
			},
			alert("/s/zygos/books"),
		]);
	});

	it("keeps an unresolved feedback signal but removes its dead href", () => {
		const unresolved = alert("/books/OTHER/surfaces/overview");
		expect(rewriteKernelLinks(unresolved, ZYGOS)).toEqual(alert());
	});

	it("leaves href-less feedback inert and byte-equivalent", () => {
		const inert = alert();
		expect(rewriteKernelLinks(inert, ZYGOS)).toEqual(inert);
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

	// KRA-789: drill-through from a home panel must preserve the selected as_of.
	it("carries as_of forward onto a rewritten drill-through href (query preservation)", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [link("/books/b-1/surfaces/overview?party_id=p-7", "Björn")],
		};
		const carry = new URLSearchParams({ as_of: "2026-07-15" });
		const rewritten = rewriteKernelLinks(tree, ZYGOS, carry) as unknown as { children: Node[] };
		expect(rewritten.children[0]).toEqual({
			kind: "link",
			href: "/s/zygos/overview?party_id=p-7&as_of=2026-07-15",
			label: "Björn",
		});
	});

	it("carrying an EMPTY set is byte-identical to the pre-KRA-789 rewrite", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [link("/books/b-1/surfaces/overview?party_id=p-7", "Björn")],
		};
		expect(rewriteKernelLinks(tree, ZYGOS, new URLSearchParams())).toEqual(
			rewriteKernelLinks(tree, ZYGOS),
		);
	});
});

/**
 * MEDIA RENDER tests — the responsive `<picture>` extension (KRA-325).
 *
 * Same SSR path as `primitives.render.test.ts`: grammar -> dialect -> context ->
 * registry -> primitive -> HTML via Svelte's server `render()`, asserted as
 * strings. Two halves:
 *
 *   1. The FIXED POINT: a Media node WITHOUT the new optional fields renders the
 *      same bare `<img>` as before — no `<picture>`, no width/height, lazy
 *      loading. Every pre-extension authored tree is untouched.
 *   2. The EXTENSION: `sources` switches the substrate to `<picture>` with one
 *      `<source type srcset>` per candidate set and the `<img>` fallback pinned
 *      to its intrinsic `width`/`height` (CLS prevention); `eager` defeats the
 *      lazy default for above-the-fold media.
 */

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Media, Node } from "./grammar/types.js";
import MorpheRoot from "./render/MorpheRoot.svelte";

/** Render an authored tree through the full core to its SSR HTML body string. */
function ssr(tree: Node): string {
	return render(MorpheRoot, { props: { tree } }).body;
}

const DEMO_SOURCES: Media["sources"] = [
	{
		type: "image/avif",
		srcset: "/images/demo/panel-640.avif 640w, /images/demo/panel-960.avif 960w",
	},
	{
		type: "image/webp",
		srcset: "/images/demo/panel-640.webp 640w, /images/demo/panel-960.webp 960w",
	},
];

describe("Media — fixed point: no sources renders the bare <img> unchanged", () => {
	it("renders a plain lazy <img> with no <picture>/<source>/dimension attrs", () => {
		const html = ssr({
			kind: "media",
			src: "/images/demo/interface-lab.svg",
			alt: "Interface lab.",
		});
		expect(html).toContain("<img");
		expect(html).toContain('src="/images/demo/interface-lab.svg"');
		expect(html).toContain('alt="Interface lab."');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('decoding="async"');
		expect(html).not.toContain("<picture");
		expect(html).not.toContain("<source");
		expect(html).not.toContain("width=");
		expect(html).not.toContain("height=");
		expect(html).not.toContain("sizes=");
	});

	it("keeps the empty-alt decorative opt-out (aria-hidden)", () => {
		const html = ssr({ kind: "media", src: "/images/rule.png", alt: "" });
		expect(html).toContain('alt=""');
		expect(html).toContain('aria-hidden="true"');
	});
});

describe("Media — extension: sources render a <picture> with the <img> fallback", () => {
	const demoMedia: Media = {
		kind: "media",
		src: "/images/demo/panel-960.png",
		alt: "Demo panel.",
		aspect: "portrait",
		sources: DEMO_SOURCES,
		sizes: "(min-width: 64rem) 60rem, 100vw",
		width: 960,
		height: 1280,
	};

	it("renders one <source type srcset sizes> per candidate set, modern formats first", () => {
		const html = ssr(demoMedia);
		expect(html).toContain("<picture");
		expect(html).toContain('type="image/avif"');
		expect(html).toContain('type="image/webp"');
		expect(html).toContain(
			'srcset="/images/demo/panel-640.avif 640w, /images/demo/panel-960.avif 960w"',
		);
		expect(html).toContain('sizes="(min-width: 64rem) 60rem, 100vw"');
		// AVIF precedes WebP — <picture> takes the first supported <source>.
		expect(html.indexOf("image/avif")).toBeLessThan(html.indexOf("image/webp"));
	});

	it("pins the fallback <img> to its intrinsic width/height (CLS prevention)", () => {
		const html = ssr(demoMedia);
		expect(html).toContain('width="960"');
		expect(html).toContain('height="1280"');
		// The fallback src and the a11y contract survive inside the <picture>.
		expect(html).toContain('src="/images/demo/panel-960.png"');
		expect(html).toContain('alt="Demo panel."');
		expect(html).toContain('data-aspect="portrait"');
	});

	it("defaults to lazy loading; eager defeats it for above-the-fold media", () => {
		expect(ssr(demoMedia)).toContain('loading="lazy"');
		expect(ssr({ ...demoMedia, eager: true })).toContain('loading="eager"');
	});

	it("renders inside a layout tree like any other content leaf", () => {
		const tree: Node = {
			kind: "stack",
			role: "section",
			children: [{ kind: "text", value: "Demo panel.", as: "caption" }, demoMedia],
		};
		const html = ssr(tree);
		expect(html).toContain("Demo panel.");
		expect(html).toContain("<picture");
	});
});

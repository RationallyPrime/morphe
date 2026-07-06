import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import MorpheRoot from "$lib/render/MorpheRoot.svelte";
import { plateProofTree } from "./tree.js";

describe("plate proof tree", () => {
	it("renders the generated B1 derivatives through the Media picture path", () => {
		const html = render(MorpheRoot, { props: { tree: plateProofTree } }).body;

		expect(html).toContain("<picture");
		expect(html).toContain('type="image/avif"');
		expect(html).toContain('type="image/webp"');
		expect(html).toContain("/images/plates/b1-boot-on-premises-640.avif 640w");
		expect(html).toContain("/images/plates/b1-boot-on-premises-960.webp 960w");
		expect(html).toContain('src="/images/plates/b1-boot-on-premises-960.png"');
		expect(html).toContain('width="960"');
		expect(html).toContain('height="1280"');
		expect(html).toContain('loading="eager"');
	});
});

/**
 * CMS compiled-tree render-smoke — SSR path, no DOM required.
 *
 * Verifies that a committed CapabilityPage fixture tree renders through the full
 * MorpheRoot SSR path without throwing. The fixture is generated from the real
 * Python presenter (see py/tests/cms_fixtures.py + py/morphe_cms/presenter) and
 * committed under src/lib/cms/fixtures/. If this test breaks, something in the
 * grammar or render registry has diverged from what the CMS presenter emits.
 */
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { Node } from "../grammar/types.js";
import MorpheRoot from "../render/MorpheRoot.svelte";
import tree from "./fixtures/capability-page.tree.json";

describe("CMS compiled tree render-smoke", () => {
	it("renders a compiled CapabilityPage tree without throwing", () => {
		const result = render(MorpheRoot, { props: { tree: tree as unknown as Node } });
		expect(result.body).toBeTruthy();
	});
});

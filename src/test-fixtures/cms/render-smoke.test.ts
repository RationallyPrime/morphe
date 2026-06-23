// @vitest-environment jsdom
/**
 * CMS compiled-tree render-smoke.
 *
 * Verifies that a committed CapabilityPage fixture tree renders through
 * MorpheRoot without throwing. The fixture is generated from the real Python
 * presenter (see py/tests/cms_fixtures.py + py/morphe_cms/presenter) and kept
 * outside package source so `src/lib` remains the public substrate seam.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Node } from "../../lib/grammar/types.js";
import MorpheRoot from "../../lib/render/MorpheRoot.svelte";
import tree from "./capability-page.tree.json";

describe("CMS compiled tree render-smoke", () => {
	it("renders a compiled CapabilityPage tree without throwing", () => {
		render(MorpheRoot, { props: { tree: tree as unknown as Node } });
		expect(screen.getByText("Workflow automation that stays accountable")).toBeInTheDocument();
	});
});

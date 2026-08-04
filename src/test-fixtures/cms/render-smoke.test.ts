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
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { Node } from "../../lib/grammar/types.js";
import MorpheRoot from "../../lib/render/MorpheRoot.svelte";
import tree from "./capability-page.tree.json";

describe("CMS compiled tree render-smoke", () => {
	it("expands its promoted compound and resolves its action through the host", async () => {
		const openComposer = vi.fn();
		render(MorpheRoot, {
			props: {
				tree: tree as unknown as Node,
				actions: { open_composer: openComposer },
			},
		});
		expect(screen.getByText("Workflow automation that stays accountable")).toBeInTheDocument();
		expect(screen.getByText("Problem frame")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "The problem" })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "See the workflow" }));
		expect(openComposer).toHaveBeenCalledOnce();
	});
});

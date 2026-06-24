import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { JsonRecord } from "$lib";
import { MorpheRoot } from "$lib/components";
import { EXHIBITS } from "./exhibits.js";
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import {
	presentLocalAdaptiveDraft,
	presentPinnedDialectProof,
	presentPlayground,
} from "./presenters.js";
import type { ExhibitId, GrammarVariant, ProviderSource } from "./types.js";

const baseInput = {
	activeExhibit: "grammar" as ExhibitId,
	grammarVariant: "layout" as GrammarVariant,
	activeDialectId: "gallery",
	selectedVaryChoice: 0,
	actionLog: [] as readonly string[],
	storeSnapshot: {} as JsonRecord,
	localDraft: FALLBACK_LOCAL_ADAPTIVE_DRAFT,
	localSource: "fallback" as ProviderSource,
	localDiagnostics: ["fallback:not-requested"] as readonly string[],
};

describe("playground presenters", () => {
	it("renders every registered exhibit through MorpheRoot on the server", () => {
		for (const exhibit of EXHIBITS) {
			const presentation = presentPlayground({
				...baseInput,
				activeExhibit: exhibit.id,
			});

			const html = render(MorpheRoot, { props: { tree: presentation.tree } }).body;

			expect(html).toContain(exhibit.label);
			expect(presentation.proof.length).toBeGreaterThan(2);
		}
	});

	it("maps each local adaptive tone to a renderable Morphe feedback tree", () => {
		for (const tone of ["info", "success", "caution"] as const) {
			const tree = presentLocalAdaptiveDraft({
				...FALLBACK_LOCAL_ADAPTIVE_DRAFT,
				tone,
			});
			const html = render(MorpheRoot, { props: { tree } }).body;

			expect(html).toContain(`data-tone="${tone}"`);
		}
	});

	it("provides a pinned dialect proof tree separate from the main exhibit tree", () => {
		const html = render(MorpheRoot, { props: { tree: presentPinnedDialectProof() } }).body;

		expect(html).toContain("Pinned dialect boundary");
		expect(html).toContain("night");
	});
});

import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import type { JsonRecord, Node } from "$lib";
import { GOLD_STANDARD_COMPOUND, getDialect, registry, validateNodeForDialect } from "$lib";
import { validateNodeDocument } from "$lib/artifacts";
import { MorpheRoot } from "$lib/components";
import { DIALECT_OPTIONS, EXHIBITS } from "./exhibits.js";
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import {
	presentActionSummaryGold,
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
	it("certifies ActionSummary through the complete benchmark fixture", () => {
		const tree = presentActionSummaryGold();
		expect(tree.kind).toBe("frame");
		if (tree.kind !== "frame") throw new Error("gold fixture must start at a Frame boundary");
		const raised = tree.children[0];
		expect(raised).toMatchObject({ kind: "frame", surface: "raised" });
		if (raised?.kind !== "frame") throw new Error("gold fixture must compose its own elevation");
		const reference = raised.children[0];
		expect(reference).toMatchObject({ kind: "compound", name: GOLD_STANDARD_COMPOUND });
		if (reference?.kind !== "compound") throw new Error("gold fixture must call the catalog");
		expect(Object.keys(reference.args).sort()).toEqual(["eyebrow", "summary", "title"]);
		expect(Object.keys(reference.slots ?? {}).sort()).toEqual([
			"action",
			"context",
			"detail",
			"signal",
		]);
		for (const fill of Object.values(reference.slots ?? {})) expect(fill.length).toBeGreaterThan(0);

		const expanded = registry.expand(reference);
		expect(validateNodeDocument(expanded).ok).toBe(true);
		expect(JSON.stringify(expanded)).not.toContain('"kind":"slot"');
		expect(JSON.stringify(expanded)).not.toContain('"kind":"param-ref"');
	});

	it("keeps the same gold tree valid and renderable under every shipped dialect", () => {
		const tree = presentActionSummaryGold();
		for (const dialectId of DIALECT_OPTIONS) {
			const validation = validateNodeForDialect(tree, dialectId, {
				validateNodeValue: (value) => validateNodeDocument(value).ok,
			});
			expect(validation, dialectId).toEqual({ ok: true });
			const html = render(MorpheRoot, {
				props: { tree, dialect: getDialect(dialectId) },
			}).body;
			expect(html).toContain(`data-mo-dialect="${dialectId}"`);
			expect(html).toContain("Gold circuit connected");
		}
	});

	it("does not encode host choice state into the gold authored tree", () => {
		const first: Node = presentActionSummaryGold();
		const second: Node = presentActionSummaryGold();
		expect(second).toEqual(first);
	});

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

import { describe, expect, it } from "vitest";
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import type { PromptLanguageModelApi } from "./local-ai.js";
import { generateLocalAdaptiveDraft } from "./local-ai.js";

const promptInput = {
	goal: "Review an exception queue",
	dialectId: "gallery",
} as const;

function fakeApi(
	availability: "unavailable" | "downloadable" | "downloading" | "available",
	response: string,
): PromptLanguageModelApi {
	return {
		async availability() {
			return availability;
		},
		async create() {
			return {
				async prompt() {
					return response;
				},
				destroy() {},
			};
		},
	};
}

describe("local AI provider", () => {
	it("falls back when no LanguageModel adapter is available", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, { api: undefined });

		expect(result.source).toBe("chrome-unavailable");
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics).toContain("chrome-unavailable:LanguageModel");
	});

	it("keeps deterministic preview active during model download states", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("downloadable", "{}"),
		});

		expect(result.source).toBe("chrome-downloading");
		expect(result.diagnostics).toContain("chrome-downloading:downloadable");
	});

	it("returns a live draft after available Prompt API output passes validation", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi(
				"available",
				JSON.stringify({
					title: "Live local draft",
					summary: "Gemini Nano produced a bounded semantic draft.",
					tone: "success",
					badges: ["chrome", "validated"],
					nextActionLabel: "Use draft",
				}),
			),
		});

		expect(result.source).toBe("chrome-live");
		expect(result.draft.title).toBe("Live local draft");
		expect(result.diagnostics).toEqual(["chrome-live"]);
	});

	it("falls back on invalid JSON", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("available", "{not-json"),
		});

		expect(result.source).toBe("fallback");
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics[0]).toContain("chrome-error:invalid-json");
	});

	it("falls back on schema-invalid draft output", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("available", JSON.stringify({ title: "Missing fields" })),
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics.join(" ")).toContain("draft-invalid");
	});

	it("falls back when create or prompt throws", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: {
				async availability() {
					return "available" as const;
				},
				async create() {
					throw new DOMException("blocked", "NotAllowedError");
				},
			},
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics).toContain("chrome-error:NotAllowedError");
	});
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import type { PromptAvailability, PromptLanguageModelApi } from "./local-ai.js";
import { generateLocalAdaptiveDraft } from "./local-ai.js";
import { LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT } from "./validation.js";

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

function fakeSessionApi(session: {
	readonly prompt: () => Promise<string>;
	readonly destroy: () => void;
}): PromptLanguageModelApi {
	return {
		async availability() {
			return "available" as const;
		},
		async create() {
			return session;
		},
	};
}

describe("local AI provider", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("falls back when no LanguageModel adapter is available", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, { api: undefined });

		expect(result.source).toBe("chrome-unavailable");
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics).toContain("chrome-unavailable:LanguageModel");
	});

	it.each([
		{
			availability: "unavailable",
			source: "chrome-unavailable",
			diagnostic: "chrome-unavailable:availability",
		},
		{
			availability: "downloadable",
			source: "chrome-downloading",
			diagnostic: "chrome-downloading:downloadable",
		},
		{
			availability: "downloading",
			source: "chrome-downloading",
			diagnostic: "chrome-downloading:downloading",
		},
	] as const)("returns deterministic fallback when availability is $availability", async ({
		availability,
		source,
		diagnostic,
	}) => {
		const create = vi.fn();
		const api: PromptLanguageModelApi = {
			async availability(): Promise<PromptAvailability> {
				return availability;
			},
			create,
		};

		const result = await generateLocalAdaptiveDraft(promptInput, { api });

		expect(result.source).toBe(source);
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics).toContain(diagnostic);
		expect(create).not.toHaveBeenCalled();
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

	it("passes the response constraint to prompt instead of create", async () => {
		let createOptions: unknown;
		let promptOptions: unknown;

		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: {
				async availability() {
					return "available" as const;
				},
				async create(options) {
					createOptions = options;
					return {
						async prompt(_input, options) {
							promptOptions = options;
							return JSON.stringify({
								title: "Live local draft",
								summary: "Gemini Nano produced a bounded semantic draft.",
								tone: "success",
								badges: ["chrome", "validated"],
								nextActionLabel: "Use draft",
							});
						},
						destroy() {},
					};
				},
			},
		});

		expect(result.source).toBe("chrome-live");
		expect(createOptions).not.toMatchObject({
			responseConstraint: LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
		});
		expect(promptOptions).toMatchObject({
			responseConstraint: LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
		});
	});

	it("passes the same prompt options to availability and prompt", async () => {
		let availabilityOptions: unknown;
		let promptOptions: unknown;

		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: {
				async availability(options) {
					availabilityOptions = options;
					return "available" as const;
				},
				async create() {
					return {
						async prompt(_input, options) {
							promptOptions = options;
							return JSON.stringify({
								title: "Live local draft",
								summary: "Gemini Nano produced a bounded semantic draft.",
								tone: "success",
								badges: ["chrome", "validated"],
								nextActionLabel: "Use draft",
							});
						},
						destroy() {},
					};
				},
			},
		});

		expect(result.source).toBe("chrome-live");
		expect(availabilityOptions).toBe(promptOptions);
		expect(promptOptions).toMatchObject({
			responseConstraint: LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
		});
	});

	it("declares an English output language on availability and create", async () => {
		let availabilityOptions: unknown;
		let createOptions: unknown;

		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: {
				async availability(options) {
					availabilityOptions = options;
					return "available" as const;
				},
				async create(options) {
					createOptions = options;
					return {
						async prompt() {
							return JSON.stringify({
								title: "Live local draft",
								summary: "Gemini Nano produced a bounded semantic draft.",
								tone: "success",
								badges: ["chrome", "validated"],
								nextActionLabel: "Use draft",
							});
						},
						destroy() {},
					};
				},
			},
		});

		const english = [{ type: "text", languages: ["en"] }];
		expect(result.source).toBe("chrome-live");
		expect(availabilityOptions).toMatchObject({ expectedOutputs: english });
		expect(createOptions).toMatchObject({ expectedInputs: english, expectedOutputs: english });
	});

	it("destroys a successful live session", async () => {
		const destroy = vi.fn();

		await generateLocalAdaptiveDraft(promptInput, {
			api: fakeSessionApi({
				async prompt() {
					return JSON.stringify({
						title: "Live local draft",
						summary: "Gemini Nano produced a bounded semantic draft.",
						tone: "success",
						badges: ["chrome", "validated"],
						nextActionLabel: "Use draft",
					});
				},
				destroy,
			}),
		});

		expect(destroy).toHaveBeenCalledOnce();
	});

	it("falls back on invalid JSON", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("available", "{not-json"),
		});

		expect(result.source).toBe("fallback");
		expect(result.draft).toEqual(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
		expect(result.diagnostics[0]).toContain("chrome-error:invalid-json");
	});

	it("destroys sessions that return invalid JSON", async () => {
		const destroy = vi.fn();

		await generateLocalAdaptiveDraft(promptInput, {
			api: fakeSessionApi({
				async prompt() {
					return "{not-json";
				},
				destroy,
			}),
		});

		expect(destroy).toHaveBeenCalledOnce();
	});

	it("falls back on schema-invalid draft output", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeApi("available", JSON.stringify({ title: "Missing fields" })),
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics.join(" ")).toContain("draft-invalid");
	});

	it("destroys sessions that return schema-invalid drafts", async () => {
		const destroy = vi.fn();

		await generateLocalAdaptiveDraft(promptInput, {
			api: fakeSessionApi({
				async prompt() {
					return JSON.stringify({ title: "Missing fields" });
				},
				destroy,
			}),
		});

		expect(destroy).toHaveBeenCalledOnce();
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

	it("falls back when prompt throws", async () => {
		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeSessionApi({
				async prompt() {
					throw new Error("prompt failed");
				},
				destroy() {},
			}),
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics).toContain("chrome-error:Error");
	});

	it("falls back when DOMException is unavailable in the runtime", async () => {
		vi.stubGlobal("DOMException", undefined);

		const result = await generateLocalAdaptiveDraft(promptInput, {
			api: fakeSessionApi({
				async prompt() {
					throw new Error("prompt failed");
				},
				destroy() {},
			}),
		});

		expect(result.source).toBe("fallback");
		expect(result.diagnostics).toContain("chrome-error:Error");
	});
});

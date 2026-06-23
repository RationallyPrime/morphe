import { FALLBACK_LOCAL_ADAPTIVE_DRAFT } from "./fallback.js";
import type { ProviderSource } from "./types.js";
import type { LocalAdaptiveDraft } from "./validation.js";
import {
	LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
	validateLocalAdaptiveDraft,
} from "./validation.js";

export type PromptAvailability = "unavailable" | "downloadable" | "downloading" | "available";

export interface PromptDownloadMonitor {
	addEventListener(type: "downloadprogress", listener: (event: Event) => void): void;
}

export interface PromptOptions {
	readonly responseConstraint?: unknown;
}

export interface PromptSession {
	prompt(input: string, options?: PromptOptions): Promise<string>;
	destroy?(): void;
}

export interface PromptLanguageModelApi {
	availability(options?: PromptOptions): Promise<PromptAvailability> | PromptAvailability;
	create(options?: {
		readonly monitor?: (monitor: PromptDownloadMonitor) => void;
	}): Promise<PromptSession>;
}

const LOCAL_ADAPTIVE_DRAFT_PROMPT_OPTIONS: PromptOptions = {
	responseConstraint: LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
};

export interface LocalAiPromptInput {
	readonly goal: string;
	readonly dialectId: string;
}

export interface LocalAiProviderOptions {
	readonly api?: PromptLanguageModelApi | undefined;
}

export interface LocalAiGenerationResult {
	readonly source: ProviderSource;
	readonly draft: LocalAdaptiveDraft;
	readonly diagnostics: readonly string[];
}

interface GlobalLanguageModel {
	readonly LanguageModel?: PromptLanguageModelApi;
}

export function resolveBrowserLanguageModel(): PromptLanguageModelApi | undefined {
	if (typeof globalThis === "undefined") return undefined;
	return (globalThis as GlobalLanguageModel).LanguageModel;
}

export async function generateLocalAdaptiveDraft(
	input: LocalAiPromptInput,
	options: LocalAiProviderOptions = {},
): Promise<LocalAiGenerationResult> {
	const api = options.api ?? resolveBrowserLanguageModel();
	if (!api) {
		return fallbackResult("chrome-unavailable", ["chrome-unavailable:LanguageModel"]);
	}

	try {
		const availability = await api.availability(LOCAL_ADAPTIVE_DRAFT_PROMPT_OPTIONS);
		if (availability === "unavailable") {
			return fallbackResult("chrome-unavailable", ["chrome-unavailable:availability"]);
		}
		if (availability === "downloadable" || availability === "downloading") {
			return fallbackResult("chrome-downloading", [`chrome-downloading:${availability}`]);
		}

		const session = await api.create({
			monitor(monitor) {
				monitor.addEventListener("downloadprogress", () => {});
			},
		});

		try {
			const raw = await session.prompt(buildPrompt(input), LOCAL_ADAPTIVE_DRAFT_PROMPT_OPTIONS);
			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return fallbackResult("fallback", ["chrome-error:invalid-json"]);
			}

			const validation = validateLocalAdaptiveDraft(parsed);
			if (!validation.ok) {
				return fallbackResult("fallback", validation.diagnostics);
			}

			return {
				source: "chrome-live",
				draft: validation.draft,
				diagnostics: ["chrome-live"],
			};
		} finally {
			session.destroy?.();
		}
	} catch (error) {
		return fallbackResult("fallback", [`chrome-error:${errorName(error)}`]);
	}
}

function buildPrompt(input: LocalAiPromptInput): string {
	return [
		"You are generating a bounded semantic draft for the Morphe playground.",
		"Return only JSON matching the provided responseConstraint.",
		`Task goal: ${input.goal}`,
		`Active dialect: ${input.dialectId}`,
		"Use tone info, success, or caution. Keep badges short.",
	].join("\n");
}

function fallbackResult(
	source: ProviderSource,
	diagnostics: readonly string[],
): LocalAiGenerationResult {
	return {
		source,
		draft: FALLBACK_LOCAL_ADAPTIVE_DRAFT,
		diagnostics,
	};
}

function errorName(error: unknown): string {
	if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name) {
		return error.name;
	}
	if (error instanceof Error && error.name) return error.name;
	return "unknown";
}

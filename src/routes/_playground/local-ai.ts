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

export interface PromptSession {
	prompt(input: string): Promise<string>;
	destroy?(): void;
}

export interface PromptLanguageModelApi {
	availability(): Promise<PromptAvailability> | PromptAvailability;
	create(options?: {
		readonly responseConstraint?: unknown;
		readonly monitor?: (monitor: PromptDownloadMonitor) => void;
	}): Promise<PromptSession>;
}

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
		const availability = await api.availability();
		if (availability === "unavailable") {
			return fallbackResult("chrome-unavailable", ["chrome-unavailable:availability"]);
		}
		if (availability === "downloadable" || availability === "downloading") {
			return fallbackResult("chrome-downloading", [`chrome-downloading:${availability}`]);
		}

		const session = await api.create({
			responseConstraint: LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
			monitor(monitor) {
				monitor.addEventListener("downloadprogress", () => {});
			},
		});

		try {
			const raw = await session.prompt(buildPrompt(input));
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
	if (error instanceof DOMException && error.name) return error.name;
	if (error instanceof Error && error.name) return error.name;
	return "unknown";
}

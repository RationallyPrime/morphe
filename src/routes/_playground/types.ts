import type { JsonRecord, Node } from "$lib";
import type { LocalAdaptiveDraft } from "./validation.js";

export const EXHIBIT_IDS = ["grammar", "dialects", "state", "vary", "cms", "local-ai"] as const;
export type ExhibitId = (typeof EXHIBIT_IDS)[number];

export const GRAMMAR_VARIANTS = [
	"layout",
	"content",
	"input",
	"feedback",
	"overlay",
	"media",
] as const;
export type GrammarVariant = (typeof GRAMMAR_VARIANTS)[number];

export type ProviderSource =
	| "fallback"
	| "chrome-unavailable"
	| "chrome-downloading"
	| "chrome-live"
	| "sidecar";

export interface ExhibitDefinition {
	readonly id: ExhibitId;
	readonly label: string;
	readonly summary: string;
	readonly proofFocus: string;
}

export interface ProofRailItem {
	readonly label: string;
	readonly value: string;
}

export interface PlaygroundPresentationInput {
	readonly activeExhibit: ExhibitId;
	readonly grammarVariant: GrammarVariant;
	readonly activeDialectId: string;
	readonly selectedVaryChoice: number;
	readonly actionLog: readonly string[];
	readonly storeSnapshot: JsonRecord;
	readonly localDraft: LocalAdaptiveDraft;
	readonly localSource: ProviderSource;
	readonly localDiagnostics: readonly string[];
}

export interface PlaygroundPresentation {
	readonly tree: Node;
	readonly proof: readonly ProofRailItem[];
}

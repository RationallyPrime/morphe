import type { JsonRecord, Node } from "$lib";
import type { KernelProofCaseId } from "./kernel-proof.js";
import type { LocalAdaptiveDraft } from "./validation.js";

export const EXHIBIT_IDS = [
	"gold",
	"compounds",
	"grammar",
	"dialects",
	"state",
	"vary",
	"cms",
	"kernels",
	"local-ai",
] as const;
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
	readonly actionLog: readonly string[];
	readonly storeSnapshot: JsonRecord;
	readonly localDraft: LocalAdaptiveDraft;
	readonly localSource: ProviderSource;
	readonly localDiagnostics: readonly string[];
	readonly kernelProofCaseId: KernelProofCaseId;
}

export interface PlaygroundPresentation {
	readonly tree: Node;
	readonly proof: readonly ProofRailItem[];
}

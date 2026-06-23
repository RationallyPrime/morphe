import { DIALECT_IDS } from "$lib";
import type { ExhibitDefinition, ExhibitId, GrammarVariant } from "./types.js";
import { EXHIBIT_IDS, GRAMMAR_VARIANTS } from "./types.js";

export const EXHIBITS: readonly ExhibitDefinition[] = Object.freeze([
	{
		id: "grammar",
		label: "Grammar Studio",
		summary: "Curated primitive families and their authored Node data.",
		proofFocus: "Node grammar",
	},
	{
		id: "dialects",
		label: "Dialect Lab",
		summary: "One authored tree re-themed through every shipped dialect.",
		proofFocus: "Intent remap",
	},
	{
		id: "state",
		label: "State + Actions",
		summary: "Bound paths and declarative action ids wired at the root.",
		proofFocus: "Host sockets",
	},
	{
		id: "vary",
		label: "Vary + Delta",
		summary: "Host-owned choices select a branch without mutating the tree.",
		proofFocus: "Choice map",
	},
	{
		id: "cms",
		label: "CMS Pipeline",
		summary: "Compiled preview and publication pointer proof surfaces.",
		proofFocus: "Compiled artifact",
	},
	{
		id: "local-ai",
		label: "Local AI Provider",
		summary: "Chrome Prompt API as progressive enhancement behind a small draft contract.",
		proofFocus: "Validated draft",
	},
]);

export const DEFAULT_EXHIBIT: ExhibitId = "grammar";
export const DEFAULT_GRAMMAR_VARIANT: GrammarVariant = "layout";
export const DIALECT_OPTIONS: readonly string[] = DIALECT_IDS;

export function isExhibitId(value: string): value is ExhibitId {
	return (EXHIBIT_IDS as readonly string[]).includes(value);
}

export function isGrammarVariant(value: string): value is GrammarVariant {
	return (GRAMMAR_VARIANTS as readonly string[]).includes(value);
}

export function exhibitFor(id: ExhibitId): ExhibitDefinition {
	const exhibit = EXHIBITS.find((candidate) => candidate.id === id);
	if (exhibit) return exhibit;
	throw new Error(`Unknown playground exhibit "${id}".`);
}

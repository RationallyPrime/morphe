/**
 * The compose public API — the barrel the route (and any future consumer)
 * imports from as "$lib/compose".
 *
 * This is the read-only, GROUNDED marketing surface built ON Morphe: the corpus
 * of cross-system capabilities, the deterministic matcher, the presenters that
 * turn matched capabilities into Morphe Node trees, the five domain compounds
 * those trees are built from, the closed pain taxonomy, and the small
 * visitor-input schema. Everything here is data + pure functions; nothing
 * touches a scale, a pixel or a hex value.
 *
 * Re-export only — no logic lives here. House style: explicit `export ... from`
 * with `.js` extensions, type-only re-exports through `export type`.
 */

// Capability domain types (the shape the corpus + matcher + presenters share).
export type {
	Capability,
	CapabilityCorpus,
	Category,
	Direction,
	GovernanceTier,
	SurfaceUse,
	SystemId,
	SystemRef,
} from "./capability.js";
// Compounds — the five domain compounds + idempotent registration.
export {
	CapabilityCard,
	COMPOSE_COMPOUNDS,
	FlowArrow,
	ModelView,
	PainPrompt,
	registerComposeCompounds,
	SurfaceEvidence,
} from "./compounds.js";
// Corpus — the 45 grounded capabilities + the corpus envelope.
export { CAPABILITIES, COMPOSE_CORPUS } from "./corpus.js";
// Document text — the shared embed/rerank representation of a capability (no drift).
export { documentText } from "./document.js";
export type { ExamplePain } from "./examples.js";
// Examples — system-gated suggestion chips (re-shape around the visitor's stack).
export { EXAMPLE_LIMIT, EXAMPLE_PAINS, examplePainsFor } from "./examples.js";
export type { ComposeQuery } from "./input.js";
// Input — visitor-input validation (hand-written, not orval zod).
export { composeQuerySchema, parseQuery } from "./input.js";
export type { ScoredCapability } from "./match.js";
// Matching — deterministic, pure, read-only ranking (the local floor / fallback).
export {
	isSubsetSelected,
	matchCapabilities,
	scoreCapabilities,
} from "./match.js";
// Presenters — typed Capability data turned into Morphe Node trees.
export {
	capabilityCard,
	composeAnswer,
	emptyState,
	offDomainState,
	thinMatchState,
} from "./present.js";
export type { RetrievedCapability } from "./retrieve.js";
// Retrieval — stage 1 of the ranking pipeline: in-memory cosine over committed embeddings.
export { cosine, retrieve } from "./retrieve.js";
export type { PainTag, System } from "./taxonomy.js";
// Taxonomy — the closed pain vocabulary, the systems we answer for, and the
// system-agnostic category classification (the seam for a second product later).
export {
	CATEGORIES,
	CATEGORY_LABELS,
	categoriesOf,
	categoryOf,
	defaultSelection,
	PAIN_KEYWORDS,
	PAIN_TAGS,
	SYSTEMS,
	systemsInCategory,
	tagsFromText,
} from "./taxonomy.js";

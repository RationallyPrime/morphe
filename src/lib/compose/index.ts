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

// Corpus — the 45 grounded capabilities + the corpus envelope.
export { CAPABILITIES, COMPOSE_CORPUS } from "./corpus.js";

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

// Matching — deterministic, pure, read-only ranking.
export { featuredCapabilities, matchCapabilities, scoreCapabilities } from "./match.js";
export type { ScoredCapability } from "./match.js";

// Presenters — typed Capability data turned into Morphe Node trees.
export { capabilityCard, composeAnswer, emptyState } from "./present.js";

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

// Taxonomy — the closed pain vocabulary, the systems we answer for, and the
// system-agnostic category classification (the seam for a second product later).
export {
	CATEGORIES,
	CATEGORY_LABELS,
	categoriesOf,
	categoryOf,
	PAIN_KEYWORDS,
	PAIN_TAGS,
	SYSTEMS,
	tagsFromText,
} from "./taxonomy.js";
export type { PainTag, System } from "./taxonomy.js";

// Input — visitor-input validation (hand-written, not orval zod).
export { composeQuerySchema, parseQuery } from "./input.js";
export type { ComposeQuery } from "./input.js";

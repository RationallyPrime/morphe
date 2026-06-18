/**
 * The site public API — the barrel the marketing routes import as "$site".
 *
 * The Sókrates marketing surface built ON Morphe: the editorial compounds and
 * the pure presenters that turn centralised copy into Morphe Node trees. Copy
 * follows marketing-context.md; everything is data + pure functions and nothing
 * touches a scale, a pixel or a hex.
 */

// The app-wide active cohort + the reactive resolved copy the presenters read.
// `pageCopy` is the SSR-safe page entry (store wins; else the request-scoped id).
export { activeCohort, activeCopy, pageCopy } from "./active-cohort.svelte.js";
// The cohort registry — a cohort selects a dialect AND a copy overlay (CONTEXT.md).
export type { Cohort } from "./cohorts.js";
export {
	COHORT_IDS,
	CohortRegistry,
	cohortGateFailure,
	cohortRegistry,
	getCohort,
	hasCohort,
	persistableCohort,
	registerSiteCohorts,
	resolveArrivalCohort,
	SITE_COHORTS,
} from "./cohorts.js";
// Compounds — the six editorial compounds + idempotent registration.
export {
	registerSiteCompounds,
	SITE_COMPOUNDS,
	SiteCtaBanner,
	SiteFeatureSplit,
	SiteHero,
	SitePullquote,
	SiteStep,
	SiteValueProp,
} from "./compounds.js";
// The copy deck — targetable marketing copy as data; base + per-cohort overlay.
export type { CohortCopyOverlay, FaqEntry, SiteCopy } from "./copy.js";
export { BASE_COPY, resolveCopy } from "./copy.js";
// The onboarding dossier (KRA-370) — the intake as a typed record, plus the
// first real mid-loop delegate.
export type { DossierDraft, DossierOpts, DossierStep } from "./dossier.js";
export {
	DOSSIER_STAGE_CHOICES,
	DOSSIER_STAGE_ID,
	DOSSIER_SYSTEMS_CHOICES,
	DOSSIER_SYSTEMS_ID,
	dossierEnvelope,
	dossierTree,
	groundedSystem,
} from "./dossier.js";
export {
	createDossierMidLoop,
	DOSSIER_COMPACT_THRESHOLD,
	DOSSIER_NAMED_SYSTEMS_PATH,
	DOSSIER_STEP_PATH,
} from "./dossier-midloop.js";
export type { IntentOutcome } from "./intent-engine.svelte.js";
// The intent engine (ADR-0006) — the registered morph vocabulary (data), the
// single execution path (mechanism), and the palette matcher.
export { intentEngine } from "./intent-engine.svelte.js";
export type { IntentAction, SiteIntent } from "./intents.js";
export {
	IntentRegistry,
	intentGateFailure,
	intentRegistry,
	matchIntents,
	registerSiteIntents,
	resolveArrivalIntent,
	SITE_INTENTS,
} from "./intents.js";
export {
	HOME_INTENT_STAGE_ID,
	HOME_STAGE_CHOICES,
	homeIntentStage,
	homeIntentStageEnvelope,
} from "./morph-stage.js";
// Presenters — copy turned into Morphe Node trees, one set per page.
export {
	architectureBody,
	architectureHero,
	closingCta,
	faqSection,
	homeHero,
	howItWorksBody,
	howItWorksHero,
	timaeusTease,
} from "./present.js";

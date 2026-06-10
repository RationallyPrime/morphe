/**
 * The site public API — the barrel the marketing routes import as "$lib/site".
 *
 * The Sókrates marketing surface built ON Morphe: the editorial compounds and
 * the pure presenters that turn centralised copy into Morphe Node trees. Copy
 * follows marketing-context.md; everything is data + pure functions and nothing
 * touches a scale, a pixel or a hex.
 */

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
	SITE_INTENTS,
} from "./intents.js";
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

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

// Presenters — copy turned into Morphe Node trees, one set per page.
export {
	architectureBody,
	architectureHero,
	closingCta,
	contactLead,
	faqSection,
	governanceLadder,
	homeBody,
	homeHero,
	howItWorksBody,
	howItWorksHero,
	sovereigntySplit,
} from "./present.js";

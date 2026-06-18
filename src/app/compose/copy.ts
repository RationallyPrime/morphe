/**
 * THE COMPOSER COPY CONTRACT — the composer's control-surface strings as data.
 *
 * The Composer is a `$compose` surface embedded in the `$site` marketing page, so
 * its copy shape is OWNED here (the forward layering edge is site → compose, never
 * the reverse). `$site`'s copy deck aggregates `ComposerCopy` into `SiteCopy` and a
 * cohort may overlay it; the Composer itself takes a `copy: ComposerCopy` prop that
 * DEFAULTS to `BASE_COMPOSER_COPY`, so the component stays standalone-embeddable
 * (no cohort, no site) while becoming cohort-targetable when the site passes one.
 *
 * Pure data — no Svelte, no I/O. The base strings are lifted verbatim from the
 * Composer's previously-hardcoded control surface.
 */

/** Every targetable string on the Composer's control surface. */
export interface ComposerCopy {
	/** The composer heading. */
	readonly title: string;
	/** The one-sentence framing under the heading. */
	readonly lede: string;
	/** The pain textarea's visible label. */
	readonly painLabel: string;
	/** The pain textarea's placeholder (an on-voice example friction). */
	readonly painPlaceholder: string;
	/** The systems fieldset legend. */
	readonly systemsLegend: string;
	/** The "run a system we don't list?" prompt before the contact link. */
	readonly unlistedPrompt: string;
	/** The inline link text that routes an unlisted system to contact. */
	readonly unlistedLink: string;
	/** The submit button's idle label. */
	readonly submitLabel: string;
	/** The submit button's in-flight label. */
	readonly rankingLabel: string;
	/** The footnote under the form. */
	readonly note: string;
}

/** The canonical composer copy — lifted verbatim from the control surface. */
export const BASE_COMPOSER_COPY: ComposerCopy = {
	title: "What can Sókrates do for you?",
	lede: "Name the friction and the systems you run. Sókrates returns the few cross-system moves that fit, with the endpoints and model names behind each one.",
	painLabel: "Describe the friction",
	painPlaceholder:
		"e.g. shift planning is slow and error prone, and overtime keeps blowing the budget",
	systemsLegend: "Which systems do you run? One per column.",
	unlistedPrompt: "Run a system we don't list?",
	unlistedLink: "Tell us, we'll map it.",
	submitLabel: "Show the fit",
	rankingLabel: "Ranking…",
	note: "Ranked on submit from the systems you choose here.",
};

/**
 * THE COPY DECK — the targetable marketing copy as data (the cohort mechanism).
 *
 * `present.ts` turns copy into Morphe Node trees; THIS module is the copy those
 * presenters read. `BASE_COPY` is the canonical, SSR/SEO copy (today's strings,
 * verbatim). A cohort (cohorts.ts) supplies a `CohortCopyOverlay` — a partial
 * statement over these same slots — and `resolveCopy` merges base ∪ overlay into
 * a total `SiteCopy`. A cohort overrides only what it names and inherits the
 * rest: "not every piece of text changes". Pure data + one merge function; no
 * Svelte, no I/O. (CONTEXT.md: a cohort selects a dialect AND a copy variant.)
 */

import { BASE_COMPOSER_COPY, type ComposerCopy } from "$compose";

/** One FAQ entry — atomic: a cohort supplies a complete pair, never a half. */
export interface FaqEntry {
	readonly q: string;
	readonly a: string;
}

/** The nav chrome's one quiet CTA (Nav.svelte). */
export interface NavCopy {
	/** The always-visible secondary CTA label (routes to #contact). */
	readonly cta: string;
}

/** The contact form's control-surface strings (ContactForm.svelte). */
export interface ContactCopy {
	readonly nameLabel: string;
	readonly emailLabel: string;
	readonly operationLabel: string;
	readonly operationPlaceholder: string;
	/** The submit button's idle / in-flight labels (the close conversion beacon). */
	readonly submitLabel: string;
	readonly submittingLabel: string;
	readonly hint: string;
	/** The post-submit acknowledgement (title + body). */
	readonly ackTitle: string;
	readonly ackBody: string;
	/** The delivery-failure line around the mailto fallback (lead is never lost). */
	readonly errorLead: string;
	readonly errorTail: string;
}

/**
 * The intent engine's FRAMING copy (IntentChips + IntentPalette). The intent
 * VOCABULARY (labels/order) stays in the gated registry (`intents.ts`); `labels`
 * here is an optional PRESENTATION overlay a cohort may apply over a chip's text
 * (by intent id) without mutating the registry — the no-JS `href` ground truth is
 * untouched.
 */
export interface IntentCopy {
	/** The chip row's accessible name / the question it answers. */
	readonly prompt: string;
	/** The Cmd/Ctrl+K palette's input placeholder. */
	readonly palettePlaceholder: string;
	/** The palette input's accessible name. */
	readonly paletteAriaLabel: string;
	/** Optional per-intent chip-label overrides (intent id -> label). */
	readonly labels?: Readonly<Record<string, string>>;
}

/** The full set of copy slots a cohort may target. */
export interface SiteCopy {
	/** The home page <head> (SSR-resolved from `?cohort=`). */
	readonly meta: { readonly title: string; readonly description: string };
	/** The home hero (SiteHero title + lede). */
	readonly hero: { readonly title: string; readonly lede: string };
	/** The shared closing CTA band (SiteCtaBanner). */
	readonly closingCta: { readonly heading: string; readonly sub: string };
	/** The FAQ — keyed so an overlay overrides one answer or appends; `order` paints. */
	readonly faq: {
		readonly entries: Readonly<Record<string, FaqEntry>>;
		readonly order: readonly string[];
	};
	/** The nav chrome CTA. */
	readonly nav: NavCopy;
	/** The composer control surface (owned by `$compose`, aggregated here). */
	readonly composer: ComposerCopy;
	/** The contact form control surface (the conversion close). */
	readonly contact: ContactCopy;
	/** The intent engine's framing copy. */
	readonly intent: IntentCopy;
}

/**
 * A cohort's partial statement over SiteCopy. Each level is optional; FaqEntry
 * stays atomic, `faq.order` replaces wholesale, and `intent.labels` merges by key
 * — so `resolveCopy` is always total and sound (never a half-built entry).
 */
export interface CohortCopyOverlay {
	readonly meta?: Partial<SiteCopy["meta"]>;
	readonly hero?: Partial<SiteCopy["hero"]>;
	readonly closingCta?: Partial<SiteCopy["closingCta"]>;
	readonly faq?: {
		readonly entries?: Readonly<Record<string, FaqEntry>>;
		readonly order?: readonly string[];
	};
	readonly nav?: Partial<NavCopy>;
	readonly composer?: Partial<ComposerCopy>;
	readonly contact?: Partial<ContactCopy>;
	readonly intent?: {
		readonly prompt?: string;
		readonly palettePlaceholder?: string;
		readonly paletteAriaLabel?: string;
		readonly labels?: Readonly<Record<string, string>>;
	};
}

/** The canonical nav CTA — lifted verbatim from Nav.svelte. */
export const BASE_NAV_COPY: NavCopy = {
	cta: "Talk to us",
};

/** The canonical contact copy — lifted verbatim from ContactForm.svelte. */
export const BASE_CONTACT_COPY: ContactCopy = {
	nameLabel: "Your name",
	emailLabel: "Email",
	operationLabel: "What runs your operation today?",
	operationPlaceholder:
		"e.g. dkPlus for finance, Humanity for shifts, and a lot of spreadsheets in between.",
	submitLabel: "Talk to us",
	submittingLabel: "Sending…",
	hint: "Hákon replies by hand, usually within 48 hours.",
	ackTitle: "Received. Thank you.",
	ackBody:
		"Hákon reads every one and replies by hand, usually within 48 hours. The reply starts with the work itself.",
	errorLead: "Something went wrong sending that. Email",
	errorTail: "directly and we will pick it up.",
};

/** The canonical intent framing — lifted verbatim from IntentChips + IntentPalette. */
export const BASE_INTENT_COPY: IntentCopy = {
	prompt: "What would you like to know?",
	palettePlaceholder: "What would you like to know?",
	paletteAriaLabel: "State your interest",
};

/** The canonical copy — lifted verbatim from present.ts + the components. */
export const BASE_COPY: SiteCopy = {
	meta: {
		title: "Sókrates — Your AI Department",
		description:
			"Software waits for instructions. Sókrates looks for friction. An on-premises AI department for the cross-system work that keeps landing on one senior person.",
	},
	hero: {
		title: "You now have an AI department.",
		lede: "Tell Sókrates what actually runs your operation, and see what it can take on.",
	},
	closingCta: {
		heading: "One conversation is usually enough.",
		sub: "Bring one workflow that keeps crossing systems. Thirty minutes is usually enough to find the first useful question.",
	},
	faq: {
		entries: {
			"chatgpt-diff": {
				q: "How is this different from just using ChatGPT?",
				a: "A substrate, not a chatbot. Sókrates reasons over a verified, typed map of your systems and cites the rows behind every answer. It asks the model to operate over what is true, and every action carries an authority record you can inspect.",
			},
			"what-if-wrong": {
				q: "What happens if it gets something wrong?",
				a: "Human approval is the default trust posture. Every action is a typed process with a named owner and an authority record, auditable as a single record. You authorise classes of work; you can revoke them.",
			},
			"data-residency": {
				q: "Our data can't leave the country, or our network.",
				a: "The appliance is installed on your premises. The Sovereign configuration uses local inference only.",
			},
			exit: {
				q: "What if we want to leave?",
				a: "Clean exit, no hostage-taking. The hardware is yours; your operational data is yours. We deliver a portable custody export of your extracts, operating map, rule contracts, evidence and approval history. What ends is the managed department, not your ownership.",
			},
			"mid-migration": {
				q: "We're mid-migration. We can't take on another project.",
				a: "The migration is the wedge. Sókrates provides semantic continuity across it: the same operational questions, the same evidence posture, before, during and after cutover.",
			},
		},
		order: ["chatgpt-diff", "what-if-wrong", "data-residency", "exit", "mid-migration"],
	},
	nav: BASE_NAV_COPY,
	composer: BASE_COMPOSER_COPY,
	contact: BASE_CONTACT_COPY,
	intent: BASE_INTENT_COPY,
};

/**
 * Merge an optional cohort overlay onto the base copy. Total and explicit:
 * meta/hero/closingCta/nav/composer/contact merge field-by-field; faq.entries and
 * intent.labels merge by key; faq.order is replaced when supplied. Returns
 * BASE_COPY unchanged when the overlay is absent or empty.
 */
export function resolveCopy(overlay?: CohortCopyOverlay): SiteCopy {
	if (overlay === undefined) return BASE_COPY;
	return {
		meta: { ...BASE_COPY.meta, ...overlay.meta },
		hero: { ...BASE_COPY.hero, ...overlay.hero },
		closingCta: { ...BASE_COPY.closingCta, ...overlay.closingCta },
		faq: {
			entries: { ...BASE_COPY.faq.entries, ...overlay.faq?.entries },
			order: overlay.faq?.order ?? BASE_COPY.faq.order,
		},
		nav: { ...BASE_COPY.nav, ...overlay.nav },
		composer: { ...BASE_COPY.composer, ...overlay.composer },
		contact: { ...BASE_COPY.contact, ...overlay.contact },
		intent: {
			...BASE_COPY.intent,
			...overlay.intent,
			// labels merge by key (a cohort overrides one chip's text, inherits the rest).
			labels:
				overlay.intent?.labels === undefined
					? BASE_COPY.intent.labels
					: { ...BASE_COPY.intent.labels, ...overlay.intent.labels },
		},
	};
}

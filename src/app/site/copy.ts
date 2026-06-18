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

/** One FAQ entry — atomic: a cohort supplies a complete pair, never a half. */
export interface FaqEntry {
	readonly q: string;
	readonly a: string;
}

/** The full set of copy slots a cohort may target. */
export interface SiteCopy {
	/** The home page <head> (applied client-side in v1). */
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
}

/**
 * A cohort's partial statement over SiteCopy. Each level is optional; FaqEntry
 * stays atomic and `faq.order` replaces wholesale — so `resolveCopy` is always
 * total and sound (never a half-built entry).
 */
export interface CohortCopyOverlay {
	readonly meta?: Partial<SiteCopy["meta"]>;
	readonly hero?: Partial<SiteCopy["hero"]>;
	readonly closingCta?: Partial<SiteCopy["closingCta"]>;
	readonly faq?: {
		readonly entries?: Readonly<Record<string, FaqEntry>>;
		readonly order?: readonly string[];
	};
}

/** The canonical copy — lifted verbatim from present.ts + the home <head>. */
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
};

/**
 * Merge an optional cohort overlay onto the base copy. Total and explicit:
 * meta/hero/closingCta merge field-by-field; faq.entries merge by key;
 * faq.order is replaced when supplied. Returns BASE_COPY unchanged when the
 * overlay is absent or empty.
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
	};
}

/**
 * SITE PRESENTERS — the Sókrates marketing copy, as Morphe Node trees.
 *
 * Pure functions that emit `Node` trees built from the site compounds
 * (`compounds.ts`) and the core primitives. Every leaf references INTENTS and
 * ROLES only — no scale, no pixel, no hex — so each surface re-themes under any
 * dialect as a Lemma-3 fixed point. Copy is centralised here (EN); it is the
 * single place to localise later. It follows `marketing-context.md`: the
 * "Quiet Confidence" voice, the canon lines, no SaaS jargon.
 *
 * The split with the route components mirrors the composer: editorial COPY is a
 * Morphe tree; the conversion CTAs and any interactive control surface (the
 * composer, the contact form, the onboarding form) are native, rendered beside
 * these trees by the page. So nothing here builds a Button or a form input —
 * those are affordances the page owns. In-prose navigation rides the Morphe
 * `Link` primitive (a real `<a href>`), which is the correct in-algebra way to
 * reference another page.
 */

import type { Node } from "$lib";
import type { SiteCopy } from "./copy.js";

/* ---------------------------------------------------------------------------
 * Leaf helpers — keep the trees readable and the registers consistent.
 * ------------------------------------------------------------------------- */

type TextAs = NonNullable<import("$lib").Text["as"]>;
type TextExtra = {
	emphasis?: import("$lib").EmphasisClaim;
	intent?: import("$lib").IntentRef;
};

/** A Text node at a chosen semantic level / register. */
function t(value: string, as: TextAs, extra?: TextExtra): Node {
	return { kind: "text", value, as, ...extra };
}

/** An in-prose navigation link (a real `<a href>`); provenance register by default. */
function link(href: string, label: string, intent: import("$lib").IntentRef = "provenance"): Node {
	return { kind: "link", href, label, intent };
}

/** A quiet mono eyebrow caption in the accession register. */
function eyebrow(value: string): Node {
	return t(value, "caption", { intent: "accession" });
}

/**
 * A width-descriptor srcset over the standard plate rungs. The rungs and the
 * file naming are the committed output of `scripts/derive-plates.ts` (see
 * `scripts/plate-manifest.ts` for the plan, pinned by its unit tests).
 */
function plateSrcset(slug: string, format: "avif" | "webp"): string {
	return [640, 960, 1440].map((w) => `/images/plates/${slug}-${w}.${format} ${w}w`).join(", ");
}

/* ---------------------------------------------------------------------------
 * Shared sections — reused across pages.
 * ------------------------------------------------------------------------- */

/**
 * A reusable closing CTA copy band (SiteCtaBanner). The page wraps it in a
 * native section and renders the contact / onboarding buttons beside it.
 */
export function closingCta(copy: SiteCopy): Node {
	return {
		kind: "compound",
		name: "SiteCtaBanner",
		emphasis: "strong",
		args: {
			heading: t(copy.closingCta.heading, "heading", { emphasis: "strong" }),
			sub: t(copy.closingCta.sub, "body", { emphasis: "muted" }),
		},
	};
}

/* ---------------------------------------------------------------------------
 * HOME.
 * ------------------------------------------------------------------------- */

/**
 * The home hero copy — a BRIEF ease-in that hands straight to the composer (WS1a).
 * The route hangs the appliance plate beside it and renders NO CTA here: the
 * composer (the immediate next fold) is the top-fold action, so the intro is one
 * display line plus a single hand-off sentence and nothing else. No eyebrow
 * (DESIGN §9), no lede paragraph, no CTA row — the old multi-sentence preamble is
 * exactly what buried the product, and stripping it is the point.
 */
export function homeHero(copy: SiteCopy): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			title: t(copy.hero.title, "display", { emphasis: "strong" }),
			lede: t(copy.hero.lede, "body", { emphasis: "muted" }),
		},
	};
}

/**
 * The Timaeus tease — the doorway to /how-it-works, carried by the story's
 * closing plate (B9, the record tree; cross-page reuse is fine — the per-page
 * "never the same plate twice" law holds on both pages). In-prose navigation
 * rides the Morphe Link primitive (in-algebra); no native CTA, no beacon claim
 * — the composer and the close keep the page's two ambers.
 */
export function timaeusTease(): Node {
	const slug = "b9-on-the-record";
	return {
		kind: "compound",
		name: "SiteFeatureSplit",
		args: {
			media: {
				kind: "media",
				src: `/images/plates/${slug}-960.png`,
				alt: "Plate IX of the Timaeus narrative: a luminous tree of records rising in the constellation dark, a robed figure standing before it.",
				aspect: "portrait",
				width: 960,
				height: 1280,
				sizes: "(min-width: 64rem) 40rem, 100vw",
				sources: [
					{ type: "image/avif", srcset: plateSrcset(slug, "avif") },
					{ type: "image/webp", srcset: plateSrcset(slug, "webp") },
				],
			},
			eyebrow: eyebrow("The operating lifecycle"),
			heading: t("Nine plates. One loop.", "heading", { emphasis: "strong" }),
			body: t(
				"From the moment the appliance powers up to the moment finished work lands on the record: the whole operating lifecycle, drawn as nine plates — and the authoring loop at its core that never stops sharpening.",
				"body",
				{ emphasis: "muted" },
			),
		},
		slots: {
			foot: [link("/how-it-works", "Read the story in nine plates")],
		},
	};
}

/* ---------------------------------------------------------------------------
 * HOW IT WORKS — the Timaeus narrative (KRA-327): the operating lifecycle in
 * nine plates, two acts around one perpetual loop. The route renders this page
 * under the `timaeus` dialect (the plates are FIXED POINTS; the substrate
 * re-poses around them). The public story ends at B9.
 * ------------------------------------------------------------------------- */

export function howItWorksHero(): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			eyebrow: eyebrow("The operating lifecycle"),
			title: t("What happens when the box arrives.", "display", {
				emphasis: "strong",
			}),
			lede: t(
				"The life of a Sókrates appliance, told in nine plates: from the moment it powers up at your site to the moment finished work lands on the record. Two acts: first the system orders itself around your operation, then your work flows through it.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

/** Intrinsic fallback dimensions shared by all nine narrative plates (3:4). */
const PLATE_W = 960;
const PLATE_H = 1280;

/**
 * A narrative plate as a responsive Media node: AVIF/WebP candidate sets from
 * the committed derivative pipeline (`bun run plates`), the 960 PNG as the
 * universal fallback, intrinsic dimensions pinned (no CLS). Only the first
 * plate above the fold opts out of lazy loading. String fields (`src`, `alt`)
 * are authored here — they cannot ride compound params.
 */
function plateMedia(slug: string, alt: string, eager: boolean): Node {
	return {
		kind: "media",
		src: `/images/plates/${slug}-960.png`,
		alt,
		aspect: "portrait",
		width: PLATE_W,
		height: PLATE_H,
		sizes: "(min-width: 64rem) 40rem, 100vw",
		sources: [
			{ type: "image/avif", srcset: plateSrcset(slug, "avif") },
			{ type: "image/webp", srcset: plateSrcset(slug, "webp") },
		],
		...(eager ? { eager: true } : {}),
	};
}

/**
 * One beat of the story through the TimaeusPlate compound: the plate leads,
 * the copy follows; the beat id rides as a folio-register Badge (the same
 * plate-corner mark the figures themselves carry). Titles claim `strong` at
 * subheading register — the PLATES are the loudest objects on this page, by
 * design (the timaeus dialect's tight budget enforces the same instinct).
 */
function beat(
	id: string,
	slug: string,
	alt: string,
	title: string,
	body: string,
	eager = false,
): Node {
	return {
		kind: "compound",
		name: "TimaeusPlate",
		args: {
			plate: plateMedia(slug, alt, eager),
			marker: { kind: "badge", label: id, intent: "folio" },
			title: t(title, "subheading", { emphasis: "strong" }),
			body: t(body, "body", { emphasis: "muted" }),
		},
	};
}

/**
 * The nine-beat canon — ONE authored copy of the public Timaeus sequence
 * (id, slug, alt, title, body). `/how-it-works` renders it as the canonical
 * page; the home's plates morph (KRA-359) grows the same nine inline. Only
 * the public b1–b9 plates exist here — the quarantined internal diagrams are
 * never referenced (test-gated, KRA-324/KRA-359).
 */
export interface PlateBeat {
	readonly id: string;
	readonly slug: string;
	readonly alt: string;
	readonly title: string;
	readonly body: string;
}

export const PLATE_BEATS: readonly PlateBeat[] = [
	{
		id: "B1",
		slug: "b1-boot-on-premises",
		alt: "Plate I — a wireframe constellation engraving: the appliance standing inside the outline of a building, its lattice lit at boot.",
		title: "Boot on-premises",
		body: "The appliance arrives, plugs in at your site, and brings itself up: every service declared, not assembled by hand. The record is alive before the first act. From boot, each system event is captured without a second setup ritual.",
	},
	{
		id: "B2",
		slug: "b2-bind-the-sources",
		alt: "Plate II — the appliance bound by lattice lines to the constellation of the company's systems around it.",
		title: "Bind the sources",
		body: "An operator connects the systems your company actually runs: the ERP, the finance stack, the databases. Each connection enters with a named scope, so the map starts with what the source system is allowed to show.",
	},
	{
		id: "B3",
		slug: "b3-information-flows-in",
		alt: "Plate III — streams of source records flowing as lattice light into the appliance's growing map.",
		title: "Information flows in",
		body: "The bound sources are read and their structure is lifted into one typed map. And Sókrates doesn't just ingest — where the documentation is silent, it puts questions to your people, and the answers become part of what it knows.",
	},
	{
		id: "B4",
		slug: "b4-aristotle-authors",
		alt: "Plate IV — Aristotle as a draughtsman figure, writing laws into the lattice of the map.",
		title: "Aristotle authors",
		body: "Aristotle reads the matter and the answers, then writes the rules that say how your operation's pieces fit together and what counts as correct. Larger rules are composed from smaller ones, not bolted on.",
	},
	{
		id: "B5",
		slug: "b5-plato-smiths",
		alt: "Plate V — Plato at a forge of lattice light, smithing new capabilities for the constellation.",
		title: "Plato smiths",
		body: "Plato works the capability gaps: where the system cannot yet do something, it forges the missing piece — a tool, a check, a bespoke agent fitted to your domain — and registers it, ready to be dispatched.",
	},
	{
		id: "B6",
		slug: "b6-a-trigger",
		alt: "Plate VI — a single signal entering the constellation from outside: a request arriving as a point of light.",
		title: "A trigger",
		body: "Work begins with a trigger: a person asks for something over Slack, Teams or email — or the system opens a turn on its own, from a schedule or a condition it was watching. Either way, the request is on the record from its first moment.",
	},
	{
		id: "B7",
		slug: "b7-philosopher-king-reasons",
		alt: "Plate VII — the Philosopher-King at the centre of the lattice, weighing a plan and sealing its authority.",
		title: "The Philosopher-King reasons",
		body: "The orchestrator plans what must happen and under whose authority. If a standing grant already covers this class of work, it proceeds; if not, it drafts the act and waits for a human signature. Either way the authority record is explicit.",
	},
	{
		id: "B8",
		slug: "b8-governed-workflow",
		alt: "Plate VIII — a governed workflow drawn as a constellation path, checkpoint by checkpoint, gate by gate.",
		title: "The authorized workflow runs to done",
		body: "The plan compiles into a durable workflow that survives restarts and pauses at the gates you have set — most visibly, the approval gate. Every step is stamped onto the record as it happens. The work runs to done.",
	},
	{
		id: "B9",
		slug: "b9-on-the-record",
		alt: "Plate IX — the finished work laid into the record: the full causal tree of the act, preserved in the lattice.",
		title: "On the record",
		body: "The finished work lands in the system's history: every act, its cause and its authorization, auditable as one record. What the run revealed — a capability it lacked, a question it raised — feeds back into the loop. The cycle closes; the next ordering is sharper.",
	},
];

const PLATE_BEAT_BY_ID: ReadonlyMap<string, PlateBeat> = new Map(PLATE_BEATS.map((b) => [b.id, b]));

/** A canonical beat by id. A typo'd id throws — caught by the S2 render test. */
function beatFrom(id: string, eager = false): Node {
	const b = PLATE_BEAT_BY_ID.get(id);
	if (b === undefined) throw new Error(`unknown plate beat: ${id}`);
	return beat(b.id, b.slug, b.alt, b.title, b.body, eager);
}

/** An act break: a quiet accession eyebrow, the act title, one framing line. */
function actBreak(act: string, title: string, sub: string): Node {
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			eyebrow(act),
			t(title, "heading", { emphasis: "strong" }),
			t(sub, "body", { emphasis: "muted" }),
		],
	};
}

export function howItWorksBody(copy: SiteCopy): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			// --- Act I ---------------------------------------------------------
			actBreak(
				"Act I",
				"Ordering the cosmos.",
				"A loop, not a line: the system is assembled once, and then never stops being assembled.",
			),
			{ kind: "spacer", size: "md" },
			beatFrom("B1", true),
			{ kind: "spacer", size: "md" },
			beatFrom("B2"),

			{ kind: "spacer", size: "xl" },

			// --- The authoring loop (the load-bearing core) ----------------------
			// B3 → B4 → B5 → back. One raised frame holds the three beats so the
			// loop reads as ONE object; the pullquote beneath carries the loopback.
			{
				kind: "frame",
				role: "section",
				surface: "raised",
				children: [
					{
						kind: "stack",
						role: "section",
						direction: "block",
						children: [
							eyebrow("The authoring loop"),
							t("Three agents take turns ordering what flows in.", "heading", {
								emphasis: "strong",
							}),
							t(
								"B3, B4, B5 — and back again. What one pass cannot finish loops around to be asked, authored or forged on the next. This loop is the load-bearing core of the whole system.",
								"body",
								{ emphasis: "muted" },
							),
							{ kind: "spacer", size: "md" },
							beatFrom("B3"),
							{ kind: "spacer", size: "md" },
							beatFrom("B4"),
							{ kind: "spacer", size: "md" },
							beatFrom("B5"),
						],
					},
				],
			},

			{ kind: "spacer", size: "md" },

			// --- The loopback — the page's load-bearing line (also the CI SSR
			// content marker for this route; change it deliberately or not at all).
			{
				kind: "compound",
				name: "SitePullquote",
				args: {
					quote: t("There is no done, only sharper.", "display", { emphasis: "strong" }),
					attribution: t(
						"Holes in the laws, missing capabilities, unanswered questions — each loops back into the queue, and the next pass closes it. Convergence is asymptotic by design.",
						"caption",
						{ emphasis: "muted" },
					),
				},
			},

			{ kind: "spacer", size: "xl" },

			// --- Act II --------------------------------------------------------
			actBreak(
				"Act II",
				"Work flows through it.",
				"The ordered system at work: a request arrives, authority is established, and the work runs to done — on the record.",
			),
			{ kind: "spacer", size: "md" },
			beatFrom("B6"),
			{ kind: "spacer", size: "md" },
			beatFrom("B7"),
			{ kind: "spacer", size: "md" },
			beatFrom("B8"),
			{ kind: "spacer", size: "md" },
			beatFrom("B9"),

			{ kind: "spacer", size: "xl" },

			// --- FAQ -------------------------------------------------------------
			// The honest exit interview survives the retelling: the plates explain
			// how it runs; the FAQ answers what a buyer actually asks next.
			faqSection(copy),
		],
	};
}

/* ---------------------------------------------------------------------------
 * FAQ — direct Disclosure nodes (the question is the summary STRING, which the
 * factory can't parameterise). The entries are data in `copy.ts` (so a cohort
 * can re-answer or append by key); `faqSection` paints them in `copy.faq.order`.
 * ------------------------------------------------------------------------- */

export function faqSection(copy: SiteCopy): Node {
	const items: Node[] = copy.faq.order.map((id) => {
		const entry = copy.faq.entries[id];
		if (entry === undefined) throw new Error(`faqSection: unknown faq id in order: ${id}`);
		return {
			kind: "disclosure",
			summary: entry.q,
			children: [t(entry.a, "body", { emphasis: "muted" })],
		};
	});
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			t("The honest version.", "heading", { emphasis: "strong" }),
			{ kind: "spacer", size: "xs" },
			{ kind: "stack", role: "list", direction: "block", children: items },
		],
	};
}

/* ---------------------------------------------------------------------------
 * ARCHITECTURE — the deep cut. Third-person structural voice, Greek lexicon.
 * ------------------------------------------------------------------------- */

export function architectureHero(): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			title: t("Five primitives. One typed map. One authority record per act.", "display", {
				emphasis: "strong",
			}),
			lede: t(
				"The deep cut, for the people who gate on architecture. Sókrates compiles source systems into a typed hypergraph and runs governed work over it. None of this is required reading to buy; it is here because it holds up to scrutiny.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

export function architectureBody(): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			// --- The substrate primitives ------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					t("Matter, form, actor, cause.", "heading", { emphasis: "strong" }),
					{ kind: "spacer", size: "sm" },
					{
						kind: "grid",
						role: "list",
						minTrack: "regular",
						children: [
							valueProp(
								"Hyle",
								"Matter",
								"The schema-compiler layer that reads source systems and lifts their structure into the map.",
							),
							valueProp(
								"Eidos",
								"Form",
								"The canonical typed hypergraph. Both the lakehouse and the runtime are projections of it; the form is what is canonical.",
							),
							valueProp(
								"Demiurge",
								"Actor",
								"Anything that shapes the graph or acts under authority. A person, an agent, a process: each is a named actor.",
							),
							valueProp(
								"Aition",
								"Cause",
								"The authority envelope every governed act carries. The substrate verifies it before anything is written.",
							),
							valueProp(
								"traversable",
								"The queue",
								"Every edge carries a flag. A false flag is a capability gap, and the set of false-flagged edges is the work queue. The substrate knows what it cannot do.",
							),
						],
					},
				],
			},

			{ kind: "spacer", size: "xl" },

			// --- Pull quote --------------------------------------------------
			{
				kind: "compound",
				name: "SitePullquote",
				args: {
					quote: t("The map is a function of the territory.", "display", {
						emphasis: "strong",
					}),
					attribution: t(
						"Eidos is canonical; the lakehouse and the runtime are projections of it.",
						"caption",
						{ emphasis: "muted" },
					),
				},
			},

			{ kind: "spacer", size: "xl" },

			// --- The four agents ---------------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					t("One sovereign router. Three vassals, each with one job.", "heading", {
						emphasis: "strong",
					}),
					t(
						"Vassals never call each other laterally; the orchestrator is the only router. The brand is Sókrates; the dialogue vassal is also Sókrates. The overload is intentional.",
						"body",
						{ emphasis: "muted" },
					),
					{ kind: "spacer", size: "sm" },
					{
						kind: "grid",
						role: "list",
						minTrack: "regular",
						children: [
							valueProp(
								"PK",
								"Sovereign orchestrator",
								"Runs the runtime, holds consent custody, and is the only router. It does no domain work itself.",
							),
							valueProp(
								"Sókrates",
								"Dialogue vassal",
								"The only vassal that talks to humans. Channel-facing, on Slack or Teams; the surface you actually speak to.",
							),
							valueProp(
								"Aristotle",
								"Curator vassal",
								"The only vassal that writes Laws, the executable rules, into the graph.",
							),
							valueProp(
								"Plato",
								"Capability-smith vassal",
								"The only vassal that mints capability artifacts to close gaps: a predicate, a deterministic node, a fitted model, a tool.",
							),
						],
					},
				],
			},

			{ kind: "spacer", size: "xl" },

			// --- Read / write seam -------------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					t("Read by default. Write with current authority.", "heading", {
						emphasis: "strong",
					}),
					t(
						"Discovery answers from the standing data grant. Action requires current authority from a data owner: either a standing grant for that class of work, or a one-time approval the operator just clicked. The capability layer compounds across the fleet, so onboarding stays finite.",
						"body",
						{ emphasis: "muted" },
					),
				],
			},
		],
	};
}

/**
 * A SiteValueProp ref built from three strings — the common case on the
 * architecture page (a glossary-style panel: a term, a one-word role, a gloss).
 */
function valueProp(term: string, role: string, gloss: string): Node {
	return {
		kind: "compound",
		name: "SiteValueProp",
		args: {
			index: eyebrow(role),
			heading: t(term, "subheading", { emphasis: "strong" }),
			body: t(gloss, "body", { emphasis: "muted" }),
		},
	};
}

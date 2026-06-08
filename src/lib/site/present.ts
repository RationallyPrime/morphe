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

import type { Node } from "$morphe";

/* ---------------------------------------------------------------------------
 * Leaf helpers — keep the trees readable and the registers consistent.
 * ------------------------------------------------------------------------- */

type TextAs = NonNullable<import("$morphe").Text["as"]>;
type TextExtra = {
	emphasis?: import("$morphe").EmphasisClaim;
	intent?: import("$morphe").IntentRef;
};

/** A Text node at a chosen semantic level / register. */
function t(value: string, as: TextAs, extra?: TextExtra): Node {
	return { kind: "text", value, as, ...extra };
}

/** An in-prose navigation link (a real `<a href>`); provenance register by default. */
function link(
	href: string,
	label: string,
	intent: import("$morphe").IntentRef = "provenance",
): Node {
	return { kind: "link", href, label, intent };
}

/** A required-alt image node. */
function media(
	src: string,
	alt: string,
	aspect: NonNullable<import("$morphe").Media["aspect"]> = "square",
): Node {
	return { kind: "media", src, alt, aspect };
}

/** A quiet mono eyebrow caption in the accession register. */
function eyebrow(value: string): Node {
	return t(value, "caption", { intent: "accession" });
}

/* ---------------------------------------------------------------------------
 * Shared sections — reused across pages.
 * ------------------------------------------------------------------------- */

/**
 * The governance ladder: read -> propose -> act as three ordered steps. A REAL
 * sequence (the order carries the trust posture), so the numbers earn their
 * place. Reused on the home page and on /how-it-works.
 */
export function governanceLadder(): Node {
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			eyebrow("Governance"),
			t(
				"Read by default. Propose with evidence. Act under a signed envelope.",
				"heading",
				{
					emphasis: "strong",
				},
			),
			t(
				"Discovery is always on; action is the dial you turn as the track record accrues. Sókrates never confuses the two.",
				"body",
				{ emphasis: "muted" },
			),
			{ kind: "spacer", size: "sm" },
			{
				kind: "grid",
				role: "list",
				minTrack: "regular",
				children: [
					{
						kind: "compound",
						name: "SiteStep",
						args: {
							index: t("01", "subheading", { intent: "accession" }),
							title: t("Read", "subheading", { emphasis: "strong" }),
							body: t(
								"The moment you connect it, Sókrates reads across your systems and answers cross-system questions with cited evidence. Read-side discovery needs nothing fresh from you; it is warranted the day you grant ingestion.",
								"body",
								{ emphasis: "muted" },
							),
						},
					},
					{
						kind: "compound",
						name: "SiteStep",
						args: {
							index: t("02", "subheading", { intent: "accession" }),
							title: t("Propose", "subheading", { emphasis: "strong" }),
							body: t(
								"It drafts the fix and shows its work: the action, the rows it relied on, the envelope it would carry. Nothing has touched your systems. You read a proposal, not a fait accompli.",
								"body",
								{ emphasis: "muted" },
							),
						},
					},
					{
						kind: "compound",
						name: "SiteStep",
						args: {
							index: t("03", "subheading", { intent: "accession" }),
							title: t("Act", "subheading", { emphasis: "strong" }),
							body: t(
								"When you authorise a class of work, it executes and records each act under a signed envelope you can audit as one record. You turn the dial; you can turn it back.",
								"body",
								{ emphasis: "muted" },
							),
						},
					},
				],
			},
		],
	};
}

/**
 * The sovereignty split: the on-prem appliance photographed, beside the
 * "your hardware, your data" copy. Reused on the home page and /how-it-works.
 */
export function sovereigntySplit(): Node {
	return {
		kind: "compound",
		name: "SiteFeatureSplit",
		args: {
			media: media(
				"/images/the-box.png",
				"The Sókrates appliance: a matte-black on-premises box with the amber mark etched into the lid, on a wooden desk.",
			),
			eyebrow: eyebrow("The box"),
			heading: t("Your hardware. Your data. Your department.", "heading", {
				emphasis: "strong",
			}),
			body: t(
				"The appliance ships to your premises and is yours from day one, behind your firewall. Sókrates reads live truth from the systems on your network; there is no cached copy in someone else's datacentre to drift or to leak.",
				"body",
				{ emphasis: "muted" },
			),
		},
		slots: {
			aside: [
				t(
					"Cancel, and the box, the data and the connectors stay with you. What ends is the continuous intelligence layer, not your ownership.",
					"body",
					{ emphasis: "muted" },
				),
			],
		},
	};
}

/**
 * A reusable closing CTA copy band (SiteCtaBanner). The page wraps it in a
 * native section and renders the contact / onboarding buttons beside it.
 */
export function closingCta(): Node {
	return {
		kind: "compound",
		name: "SiteCtaBanner",
		args: {
			eyebrow: eyebrow("Reykjavík · MMXXVI"),
			heading: t("One conversation is usually enough.", "heading", {
				emphasis: "strong",
			}),
			sub: t(
				"No deck, no slides. Thirty minutes about the work, on or off the record. Your last AI consultant left you a PDF; we leave you a department.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

/* ---------------------------------------------------------------------------
 * HOME.
 * ------------------------------------------------------------------------- */

/** The home hero copy (CTAs + proof are rendered natively by the page). */
export function homeHero(): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		args: {
			eyebrow: eyebrow("The AI Department · Reykjavík"),
			title: t("You now have an AI department.", "display", {
				emphasis: "strong",
			}),
			lede: t(
				"Software waits for instructions. Sókrates looks for friction. It connects to the systems you already run, reads them as one map, and takes on the cross-system work that today routes through one overloaded person.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

/** The home body: the differentiators, a pull quote, the box, the ladder. */
export function homeBody(): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			// --- Differentiators ---------------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					eyebrow("Why it is different"),
					t(
						"Not a chatbot. Not a consultant. A department that stays.",
						"heading",
						{
							emphasis: "strong",
						},
					),
					{ kind: "spacer", size: "sm" },
					{
						kind: "grid",
						role: "list",
						minTrack: "regular",
						children: [
							{
								kind: "compound",
								name: "SiteValueProp",
								args: {
									index: eyebrow("Substrate"),
									heading: t(
										"It reads your systems. It doesn't guess.",
										"subheading",
										{
											emphasis: "strong",
										},
									),
									body: t(
										"Sókrates compiles your ERP, your finance stack and the spreadsheets that actually run the place into one typed map. Every answer carries a citation to the row that proves it. The model is never the source of truth; the map is.",
										"body",
										{ emphasis: "muted" },
									),
								},
							},
							{
								kind: "compound",
								name: "SiteValueProp",
								args: {
									index: eyebrow("Governance"),
									heading: t(
										"It proposes. You authorise. It records.",
										"subheading",
										{
											emphasis: "strong",
										},
									),
									body: t(
										"Discovery is always on; action waits for your sign-off. Every act it takes carries a signed envelope you can audit as a single record. A Sókrates answer should never be accepted because the AI said so.",
										"body",
										{ emphasis: "muted" },
									),
								},
							},
							{
								kind: "compound",
								name: "SiteValueProp",
								args: {
									index: eyebrow("Sovereignty"),
									heading: t("The box sits on your premises.", "subheading", {
										emphasis: "strong",
									}),
									body: t(
										"The appliance is yours from day one, behind your firewall. Nothing leaves the building by default. Cancel, and you keep the box, the data and the connectors.",
										"body",
										{ emphasis: "muted" },
									),
								},
								slots: {
									foot: [link("/how-it-works", "How it works")],
								},
							},
						],
					},
				],
			},

			{ kind: "spacer", size: "lg" },

			// --- Pull quote --------------------------------------------------
			{
				kind: "compound",
				name: "SitePullquote",
				args: {
					quote: t(
						"Your last AI consultant left you a PDF. We leave you a department.",
						"display",
						{
							emphasis: "strong",
						},
					),
					attribution: t(
						"On the difference between a deck and a deployment",
						"caption",
						{
							emphasis: "muted",
						},
					),
				},
			},

			{ kind: "spacer", size: "lg" },

			// --- The box -----------------------------------------------------
			sovereigntySplit(),

			{ kind: "spacer", size: "lg" },

			// --- Governance ladder -------------------------------------------
			governanceLadder(),
		],
	};
}

/** Copy above the native contact form. */
export function contactLead(): Node {
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			eyebrow("Contact"),
			t("Ready? Here is how to start.", "heading", { emphasis: "strong" }),
			t(
				"Tell us what runs your operation today. Hákon reads every one and replies by hand, usually within 48 hours. No deck, no slides.",
				"body",
				{ emphasis: "muted" },
			),
		],
	};
}

/* ---------------------------------------------------------------------------
 * HOW IT WORKS.
 * ------------------------------------------------------------------------- */

export function howItWorksHero(): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		args: {
			eyebrow: eyebrow("How it works"),
			title: t("From your systems to governed work, in one map.", "display", {
				emphasis: "strong",
			}),
			lede: t(
				"Sókrates is a substrate, not a chatbot. It compiles what you run into a typed map, reasons over live truth, and does the integration-layer work under governance you control. Finance and operations first; the rest of the back office as the map grows.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

export function howItWorksBody(): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			// --- The map -----------------------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					eyebrow("The map"),
					t("The map is a function of the territory.", "heading", {
						emphasis: "strong",
					}),
					t(
						"Sókrates compiles your source systems into a typed map of how your operation actually works: the entities, the rules, the relationships that today live in one person's head. Answers are computed against current rows at query time, not against a stored snapshot that drifts. There is nothing to reconcile because nothing is memoised.",
						"body",
						{ emphasis: "muted" },
					),
				],
			},

			{ kind: "spacer", size: "lg" },

			// --- The governance ladder ---------------------------------------
			governanceLadder(),

			{ kind: "spacer", size: "lg" },

			// --- The gap is the queue ----------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					eyebrow("Onboarding is finite"),
					t("The gap is the queue.", "heading", { emphasis: "strong" }),
					t(
						"When Sókrates hits something it cannot yet do, that gap is not a failure: it is the work queue. It closes the gap by extending its own capability layer, with a new internal tool or a permission request, never by silently writing into your external software. Each onboarding is the finite delta between your systems and what the platform already knows; what one customer's onboarding surfaces, the next inherits.",
						"body",
						{ emphasis: "muted" },
					),
				],
			},

			{ kind: "spacer", size: "lg" },

			// --- Sovereignty -------------------------------------------------
			sovereigntySplit(),

			{ kind: "spacer", size: "lg" },

			// --- FAQ ---------------------------------------------------------
			faqSection(),
		],
	};
}

/* ---------------------------------------------------------------------------
 * FAQ — direct Disclosure nodes (the question is the summary STRING, which the
 * factory can't parameterise, so these are authored directly).
 * ------------------------------------------------------------------------- */

interface FaqEntry {
	readonly q: string;
	readonly a: string;
}

const FAQ: readonly FaqEntry[] = [
	{
		q: "How is this different from just using ChatGPT?",
		a: "A substrate, not a chatbot. Sókrates reasons over a verified, typed map of your systems and cites the rows behind every answer. It does not ask a model to guess; it asks it to operate over what is true, and every action carries a signed envelope you can audit.",
	},
	{
		q: "What happens if it gets something wrong?",
		a: "Human approval is the default trust posture. Every action is a typed process with a named owner and a signed envelope, reverse-engineerable and auditable as a single record. You authorise classes of work; you can revoke them.",
	},
	{
		q: "Our data can't leave the country, or our network.",
		a: "It doesn't. The appliance is on your premises, behind your firewall, and read-side discovery runs locally. The Sovereign configuration makes no outbound inference calls at all.",
	},
	{
		q: "What if we want to leave?",
		a: "Clean exit, no hostage-taking. The hardware is yours; your operational data is yours. We deliver a portable custody export of your extracts, operating map, rule contracts, evidence and governance history. What ends is the managed department, not your ownership.",
	},
	{
		q: "We're mid-migration. We can't take on another project.",
		a: "The migration is the wedge. Sókrates provides semantic continuity across it: the same operational questions, the same evidence posture, before, during and after cutover.",
	},
];

export function faqSection(): Node {
	const items: Node[] = FAQ.map((entry) => ({
		kind: "disclosure",
		summary: entry.q,
		children: [t(entry.a, "body", { emphasis: "muted" })],
	}));
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			eyebrow("Before you ask"),
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
		args: {
			eyebrow: eyebrow("Architecture"),
			title: t(
				"Five primitives. One typed map. A signed envelope on every act.",
				"display",
				{
					emphasis: "strong",
				},
			),
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
					eyebrow("The substrate"),
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

			{ kind: "spacer", size: "lg" },

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

			{ kind: "spacer", size: "lg" },

			// --- The four agents ---------------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					eyebrow("The four-agent core"),
					t(
						"One sovereign router. Three vassals, each with one job.",
						"heading",
						{
							emphasis: "strong",
						},
					),
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

			{ kind: "spacer", size: "lg" },

			// --- Read / write seam -------------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					eyebrow("The seam"),
					t("Read by default. Write under a current envelope.", "heading", {
						emphasis: "strong",
					}),
					t(
						"Read-side discovery against your systems is always on, warranted by the standing ingestion grant. Write-side action requires a current AUTHORIZES envelope from a data-owner: either a standing grant you have issued for that class of work, or a one-time approval the operator just clicked. The capability layer compounds across the fleet, so onboarding stays finite.",
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

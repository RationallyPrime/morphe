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
 * The governance ladder: read -> propose -> act as three ordered steps. A REAL
 * sequence (the order carries the trust posture), so the numbers earn their
 * place. Reused on the home page and on /how-it-works.
 *
 * Composed ASYMMETRICALLY, not as an identical 3-up wall (DESIGN §5: no twin
 * symmetric step grids). The shape mirrors the trust posture itself: "Read" is
 * the always-on FOUNDATION, so it leads as one dominant full-width panel; then
 * "Propose" and "Act" — the dial you turn — sit as a 2-up beneath it. One
 * dominant item, varied panel weight, tight rhythm within the movement.
 */
export function governanceLadder(): Node {
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			t("Read by default. Propose with evidence. Act under a signed envelope.", "heading", {
				emphasis: "strong",
			}),
			t(
				"Discovery is always on; action is the dial you turn as the track record accrues. Sókrates never confuses the two.",
				"body",
				{ emphasis: "muted" },
			),
			{ kind: "spacer", size: "sm" },
			// DOMINANT — "Read", the standing default, owns a full-width step panel.
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
			{ kind: "spacer", size: "sm" },
			// THE DIAL — "Propose" and "Act" as a 2-up beneath the dominant default.
			{
				kind: "grid",
				role: "list",
				minTrack: "regular",
				children: [
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
		emphasis: "strong",
		args: {
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

/**
 * The home hero copy — a BRIEF ease-in that hands straight to the composer (WS1a).
 * The route hangs the appliance plate beside it and renders NO CTA here: the
 * composer (the immediate next fold) is the top-fold action, so the intro is one
 * display line plus a single hand-off sentence and nothing else. No eyebrow
 * (DESIGN §9), no lede paragraph, no CTA row — the old multi-sentence preamble is
 * exactly what buried the product, and stripping it is the point.
 */
export function homeHero(): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			title: t("You now have an AI department.", "display", {
				emphasis: "strong",
			}),
			lede: t(
				"Tell Sókrates what actually runs your operation, and see what it can take on.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

/**
 * The home body — the SUPPORT below the composer (WS1b), subordinate to it by
 * width and surface (the composer runs the wide recessed work surface; this is the
 * narrower editorial column on the base surface). Three movements: the
 * differentiators (a dominant feature row + a 2-up), the governance ladder (the
 * trust spine), then the typographic sovereignty beat. Vertical rhythm is varied
 * by design: `xl` spacers separate the movements (the native band layer lifts each
 * post-spacer block by a generous fluid gap) while children inside a movement sit
 * tight.
 */
export function homeBody(): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			// --- Differentiators: a dominant feature row + a 2-up of two minor panels,
			// so the trio is no longer a uniform 3-up (the substrate claim leads).
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					t("Not a chatbot. Not a consultant. A department that stays.", "heading", {
						emphasis: "strong",
					}),
					{ kind: "spacer", size: "md" },
					// DOMINANT — the substrate claim as a wide feature row: claim + proof side
					// by side, raised, owning the section before the minor pair.
					{
						kind: "frame",
						role: "panel",
						surface: "raised",
						children: [
							{
								kind: "grid",
								role: "list",
								minTrack: "wide",
								children: [
									t("It reads your systems. It doesn't guess.", "subheading", {
										emphasis: "strong",
									}),
									t(
										"Sókrates compiles your ERP, your finance stack and the spreadsheets that actually run the place into one typed map. Every answer carries a citation to the row that proves it. The model is never the source of truth; the map is.",
										"body",
										{ emphasis: "muted" },
									),
								],
							},
						],
					},
					{ kind: "spacer", size: "md" },
					// The two minor differentiators, a 2-up beneath the dominant.
					{
						kind: "grid",
						role: "list",
						minTrack: "regular",
						children: [
							{
								kind: "compound",
								name: "SiteValueProp",
								args: {
									heading: t("It proposes. You authorise. It records.", "subheading", {
										emphasis: "strong",
									}),
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
									heading: t("The box sits on your premises.", "subheading", {
										emphasis: "strong",
									}),
									body: t(
										"The appliance is yours from day one, behind your firewall, not a tenant in someone else's cloud. Data residency is structural here, not a setting you trust someone to honour.",
										"body",
										{ emphasis: "muted" },
									),
								},
							},
						],
					},
				],
			},

			{ kind: "spacer", size: "xl" },

			// --- Governance ladder -------------------------------------------
			// The trust spine sits right after the proof and before sovereignty:
			// read → propose → act is the posture the rest of the page rests on. The
			// mid-body pull quote was dropped in WS1b — its line ("we leave you a
			// department") already closes the page in the conversation band, so a
			// second display-scale beat here only competed with the composer.
			governanceLadder(),

			{ kind: "spacer", size: "xl" },

			// --- Sovereignty -------------------------------------------------
			// NOT the box photo again: the intro fold carries the appliance plate, and
			// DESIGN §8 forbids the same plate twice. The sovereignty beat is a purely
			// typographic editorial split here (a claim hung left of two short terms of
			// ownership); the route hangs the Sókrates seal beside it. The native band
			// owns the imagery; the tree owns the words.
			homeSovereignty(),
		],
	};
}

/**
 * The home sovereignty beat — "your hardware, your data, your department" as a
 * typographic editorial split (no image; the hero already carries the box, and
 * the route hangs the seal beside this band). A dominant claim, then a tight
 * 2-up of the two terms of ownership: what is yours, and what ends if you leave.
 * Asymmetric panel weight, not another card wall.
 */
function homeSovereignty(): Node {
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			t("Your hardware. Your data. Your department.", "heading", {
				emphasis: "strong",
			}),
			t(
				"The appliance ships to your premises and is yours from day one, behind your firewall. Sókrates reads live truth from the systems on your network; there is no cached copy in someone else's datacentre to drift or to leak.",
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
						name: "SiteValueProp",
						args: {
							heading: t("Nothing leaves the building by default.", "subheading", {
								emphasis: "strong",
							}),
							body: t(
								"Read-side discovery runs locally, against the systems already on your network. The map is computed from live rows, not from a snapshot shipped off-site to age.",
								"body",
								{ emphasis: "muted" },
							),
						},
					},
					{
						kind: "compound",
						name: "SiteValueProp",
						args: {
							heading: t("Cancel, and you keep everything that was yours.", "subheading", {
								emphasis: "strong",
							}),
							body: t(
								"The box, the data and the connectors stay with you. What ends is the continuous intelligence layer, not your ownership.",
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
	};
}

/**
 * The onboarding band (D1) — its own prominent near-close fold, distinct from the
 * conversational "Talk to us" close. High-emphasis but NON-amber: prominence comes
 * from the dedicated fold and the strong heading, never a second beacon chroma (the
 * page keeps exactly two ambers — the composer's submit and the contact form). The
 * route renders the native "Begin onboarding" link (secondary variant) beside it.
 */
export function onboardingBand(): Node {
	return {
		kind: "compound",
		name: "SiteCtaBanner",
		emphasis: "strong",
		args: {
			heading: t("Ready to map your operation?", "heading", {
				emphasis: "strong",
			}),
			sub: t(
				"Onboarding is the structured intake: name the systems you run and where the work piles up, and Sókrates scopes the first cross-system capabilities before we ever meet.",
				"body",
				{ emphasis: "muted" },
			),
		},
	};
}

/* ---------------------------------------------------------------------------
 * HOW IT WORKS.
 * ------------------------------------------------------------------------- */

export function howItWorksHero(): Node {
	return {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
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

			{ kind: "spacer", size: "xl" },

			// --- The governance ladder ---------------------------------------
			governanceLadder(),

			{ kind: "spacer", size: "xl" },

			// --- The gap is the queue ----------------------------------------
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					t("The gap is the queue.", "heading", { emphasis: "strong" }),
					t(
						"When Sókrates hits something it cannot yet do, that gap is not a failure: it is the work queue. It closes the gap by extending its own capability layer, with a new internal tool or a permission request, never by silently writing into your external software. Each onboarding is the finite delta between your systems and what the platform already knows; what one customer's onboarding surfaces, the next inherits.",
						"body",
						{ emphasis: "muted" },
					),
				],
			},

			{ kind: "spacer", size: "xl" },

			// --- FAQ ---------------------------------------------------------
			// (The sovereignty / "your hardware" beat is carried by the hero plate on
			// this page and by the exit FAQ below, so the mid-page box split is dropped
			// — one appliance photograph per page, never the same plate twice.)
			faqSection(),

			{ kind: "spacer", size: "xl" },

			// --- Plate I (TEMPORARY: the KRA-325 srcset-pipeline demo; KRA-327
			// gives the narrative its own page and replaces this block.) -------
			timaeusPlateFigure(),
		],
	};
}

/**
 * Plate I of the Timaeus narrative, rendered through the responsive Media
 * extension: AVIF/WebP candidate sets from the committed derivative pipeline
 * (`bun run plates`) with the 960 PNG as the universal fallback. Intrinsic
 * dimensions are pinned so the box never shifts (CLS); the plate sits mid-page,
 * so it stays on the lazy default. String fields (`src`, `alt`) are authored
 * directly — they cannot ride compound params.
 */
function timaeusPlateFigure(): Node {
	const slug = "b1-boot-on-premises";
	return {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			t("It begins on your premises.", "heading", { emphasis: "strong" }),
			t(
				"One appliance arrives, is racked behind your firewall, and boots. Nothing leaves the building; the map is compiled where the territory lives.",
				"body",
				{ emphasis: "muted" },
			),
			{ kind: "spacer", size: "sm" },
			{
				kind: "media",
				src: `/images/plates/${slug}-960.png`,
				alt: "Plate I — a dark engraving of the appliance booting on premises: the machine standing in the customer's own rack, its beacon lit, the building's outline drawn around it.",
				aspect: "portrait",
				width: 960,
				height: 1280,
				sizes: "(min-width: 84rem) 80rem, 100vw",
				sources: [
					{ type: "image/avif", srcset: plateSrcset(slug, "avif") },
					{ type: "image/webp", srcset: plateSrcset(slug, "webp") },
				],
			},
			t("Plate I — the appliance boots on premises.", "caption", { intent: "provenance" }),
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
			title: t("Five primitives. One typed map. A signed envelope on every act.", "display", {
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

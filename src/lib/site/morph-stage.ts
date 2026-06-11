/**
 * Home intent stage (KRA-356, KRA-358; KRA-357 technical + KRA-359 plates).
 *
 * The intent engine owns execution; this module owns the authored stage tree it
 * can move through. One Vary point keeps the content morphs mutually exclusive:
 * the default branch is the standing plates TEASE (the page's resting state),
 * and each chip/palette intent replaces it with exactly one visitor story —
 * so "Tell me the story" transforms the tease into the full nine beats instead
 * of stacking a second story surface above it. Closing an open story (the
 * toggle) puts the tease back. No callbacks, no component-local routing, no
 * raw geometry.
 */

import type { EmissionEnvelope, IntentRef, Node, Text, VaryId } from "$morphe";
import { PLATE_BEATS, type PlateBeat, timaeusTease } from "./present.js";

type TextAs = NonNullable<Text["as"]>;
type TextExtra = {
	readonly emphasis?: import("$morphe").EmphasisClaim;
	readonly intent?: IntentRef;
};

export const HOME_INTENT_STAGE_ID = "home-intent-stage" as VaryId;

export const HOME_STAGE_CHOICES = {
	default: 0,
	governance: 1,
	engagement: 2,
	identity: 3,
	technical: 4,
	plates: 5,
} as const;

function t(value: string, as: TextAs, extra?: TextExtra): Node {
	return { kind: "text", value, as, ...extra };
}

function link(href: string, label: string, intent: IntentRef = "provenance"): Node {
	return { kind: "link", href, label, intent };
}

function eyebrow(value: string): Node {
	return t(value, "caption", { intent: "accession" });
}

function morphPanel(children: readonly Node[]): Node {
	return {
		kind: "frame",
		role: "section",
		surface: "raised",
		budget: 3,
		children: [
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children,
			},
		],
	};
}

function governanceMorph(): Node {
	return morphPanel([
		eyebrow("How it is held"),
		t("A named owner for every act.", "heading", { emphasis: "strong" }),
		t(
			"Sókrates starts by reading the systems you already run and building a typed map of their records, relationships and rules. The map answers questions with evidence before any work is proposed.",
			"body",
			{ emphasis: "muted" },
		),
		t(
			"When work should move, it carries a signed envelope: who asked, what will happen, which grant covers it and where the result will land. If a grant is missing, the system drafts the request and waits for the person who owns it.",
			"body",
			{ emphasis: "muted" },
		),
		t(
			"The record is part of the work. Every step lands with its cause, evidence and actor, so the next conversation starts from what happened, not from a fresh meeting.",
			"body",
			{ emphasis: "muted" },
		),
		{
			kind: "cluster",
			role: "inline",
			children: [link("/how-it-works", "Read the operating story")],
		},
	]);
}

function engagementMorph(): Node {
	return morphPanel([
		eyebrow("The first workflow"),
		t("Start with one workflow that keeps crossing desks.", "heading", { emphasis: "strong" }),
		t(
			"Bring the work that still depends on one senior person: monthly close, vendor checks, exception handling, migration questions. We map the systems it touches, the evidence it needs and the decisions that stop it.",
			"body",
			{ emphasis: "muted" },
		),
		t(
			"Then the box arrives. It is installed at your site, connected to the first sources and tuned around that workflow before the scope grows.",
			"body",
			{ emphasis: "muted" },
		),
		t(
			"The first useful question matters more than a grand rollout. Talk to us, or begin the intake if you already know which workflow you want to test.",
			"body",
			{ emphasis: "muted" },
		),
		{
			kind: "cluster",
			role: "inline",
			children: [
				link("/#contact", "Talk to us"),
				link("/onboarding", "Begin onboarding", "accession"),
			],
		},
	]);
}

function identityMorph(): Node {
	// One person = a folio-marked figure lifted from the canonical bios and
	// portraits (sokrates-website Team canon): the portrait plate leads, the
	// accession register carries the catalogue number, the bio is the record
	// line. The four figures ride a narrow-track grid (the editorial plate
	// wall), not a card wall — same treatment the canon Team section uses.
	const person = (
		folio: string,
		name: string,
		title: string,
		bio: string,
		photo: string,
	): Node => ({
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			{
				kind: "media",
				src: `/images/team/${photo}.jpg`,
				alt: `Portrait of ${name}, ${title}.`,
				width: 1000,
				height: 1250,
				sizes: "(min-width: 64rem) 16rem, (min-width: 40rem) 40vw, 80vw",
			},
			{
				kind: "cluster",
				role: "inline",
				children: [
					{ kind: "badge", label: folio, intent: "folio" },
					t(name, "subheading", { emphasis: "strong" }),
				],
			},
			t(title, "caption", { emphasis: "muted" }),
			t(bio, "body", { emphasis: "muted" }),
		],
	});
	return morphPanel([
		eyebrow("Krates ehf."),
		t("Built in Reykjavík, led by the founder.", "heading", { emphasis: "strong" }),
		t(
			"Sókrates is built by Krates ehf. The sale is founder-led because the first conversation is part of the work: understanding which systems matter, where the friction sits and what would count as a useful first answer. You will talk to Hákon, not a queue.",
			"body",
			{ emphasis: "muted" },
		),
		{
			kind: "grid",
			role: "list",
			minTrack: "narrow",
			children: [
				person(
					"001",
					"Hákon Freyr Gunnarsson",
					"Founder & CEO",
					"Mathematician and AI researcher. He works across product, software architecture and applied AI: multi-agent systems, full-stack engineering and knowledge workflows built for real-world use.",
					"hakon",
				),
				person(
					"002",
					"Gunnlaugur Jónsson",
					"Chairman, Fjártækniklasinn · Finance & Strategy",
					"In financial markets since 1997. Founder of the Reykjavík Fintech Cluster, co-founder of Viska Digital Assets, and author of Ábyrgðarkver, a book on personal responsibility written after Iceland's 2008 financial crisis.",
					"gunnlaugur",
				),
				person(
					"003",
					"Dr. Ásgeir Theodór Jóhannesson",
					"CEO, Fjártækniklasinn · Legal Counsel",
					"Philosopher and international lawyer: a PhD on Kierkegaard (Southampton), dual LL.M.s with distinction (Vienna, Southampton) and admission to the Icelandic Bar.",
					"asgeir",
				),
				person(
					"004",
					"Matthías Páll Gissurarson",
					"Principal Engineer, Language & Compilers",
					"A specialist in functional programming and programming languages, with a PhD from Chalmers in program synthesis and computer security. He sits on the steering committee of GHC (the Glasgow Haskell Compiler) and on the Haskell.org committee.",
					"matthias",
				),
			],
		},
		t("Krates ehf., Reykjavík. 2026.", "caption", { emphasis: "muted" }),
		{
			kind: "cluster",
			role: "inline",
			children: [link("mailto:hakon@sokrates.is", "hakon@sokrates.is")],
		},
	]);
}

/**
 * The technical version (KRA-357) — the CTO chip. One mechanism clause per
 * substrate name, the read/write authority seam on the Aition entry, the
 * single-router rule on the Demiurge entry, and the enforced layering as the
 * closer. The full page (/architecture) stays canonical.
 */
function technicalMorph(): Node {
	const piece = (name: string, line: string): Node => ({
		kind: "cluster",
		role: "inline",
		children: [
			{ kind: "badge", label: name, intent: "provenance" },
			t(line, "body", { emphasis: "muted" }),
		],
	});
	return morphPanel([
		eyebrow("The architecture"),
		t("Matter, form, actor, cause.", "heading", { emphasis: "strong" }),
		t(
			"Sókrates compiles the systems you already run into one typed graph and runs governed work over it. Four names carry the machine. What follows is mechanism, not metaphor.",
			"body",
			{ emphasis: "muted" },
		),
		piece(
			"Hyle",
			"Matter — reads the schemas your systems already publish (OpenAPI, JSON Schema, GraphQL, SQL) and compiles them into typed records. A new source is a parser, not a project.",
		),
		piece(
			"Eidos",
			"Form — the one canonical graph. The lakehouse and the runtime are projections of it; the graph holds current state, and history lives in the trace of every act.",
		),
		piece(
			"Demiurge",
			"Actor — a person, an agent, a process: every actor is a named identity in the graph. One orchestrator routes all agent work; no agent calls another sideways.",
		),
		piece(
			"Aition",
			"Cause — the write gate. Reads run on a standing grant; a write demands a signed, single-use envelope naming the actor, the act and the approval. Verified, burned, then persisted.",
		),
		piece(
			"traversable",
			"The queue — every edge carries a flag saying whether the system can traverse it yet. The false-flagged set is the work queue: a typed inventory of what it cannot yet do.",
		),
		t(
			"None of this is convention. The layering between these pieces is mechanically enforced; an import that crosses a boundary fails the build.",
			"body",
			{ emphasis: "muted" },
		),
		{
			kind: "cluster",
			role: "inline",
			children: [link("/architecture", "Read the full architecture")],
		},
	]);
}

/* ------------------------------------------------------------------------- *
 * The plates morph (KRA-359) — "Tell me the story" grows the nine-beat canon
 * inline. The beats come from the SAME authored data /how-it-works renders
 * (`PLATE_BEATS` in present.ts) — one canon, two surfaces — through the same
 * TimaeusPlate compound and srcset derivatives. Public b1–b9 only, lazy by
 * construction (the Media primitive defaults to lazy; nothing here is eager,
 * and an unchosen Vary branch renders nothing at all).
 * ------------------------------------------------------------------------- */

function plateSrcset(slug: string, format: "avif" | "webp"): string {
	return [640, 960, 1440].map((w) => `/images/plates/${slug}-${w}.${format} ${w}w`).join(", ");
}

function plateBeat(b: PlateBeat): Node {
	return {
		kind: "compound",
		name: "TimaeusPlate",
		args: {
			plate: {
				kind: "media",
				src: `/images/plates/${b.slug}-960.png`,
				alt: b.alt,
				aspect: "portrait",
				width: 960,
				height: 1280,
				sizes: "(min-width: 64rem) 40rem, 100vw",
				sources: [
					{ type: "image/avif", srcset: plateSrcset(b.slug, "avif") },
					{ type: "image/webp", srcset: plateSrcset(b.slug, "webp") },
				],
			},
			marker: { kind: "badge", label: b.id, intent: "folio" },
			title: t(b.title, "subheading", { emphasis: "strong" }),
			body: t(b.body, "body", { emphasis: "muted" }),
		},
	};
}

function platesMorph(): Node {
	return morphPanel([
		eyebrow("The operating lifecycle"),
		t("From boot to the record.", "heading", { emphasis: "strong" }),
		t(
			"The life of the appliance in nine plates: first the system orders itself around your operation, then your work flows through it.",
			"body",
			{ emphasis: "muted" },
		),
		...PLATE_BEATS.flatMap((b): readonly Node[] => [{ kind: "spacer", size: "md" }, plateBeat(b)]),
		{ kind: "spacer", size: "md" },
		{
			kind: "cluster",
			role: "inline",
			children: [link("/how-it-works", "Read the story as its own page")],
		},
	]);
}

/**
 * The pure authored stage tree. The default branch IS the plates tease — the
 * stage at rest shows the standing invitation, and "Tell me the story" morphs
 * that same surface into the full nine beats (no stacked duplicate).
 */
export function homeIntentStage(): Node {
	return {
		kind: "vary",
		id: HOME_INTENT_STAGE_ID,
		default: HOME_STAGE_CHOICES.default,
		options: [
			timaeusTease(),
			governanceMorph(),
			engagementMorph(),
			identityMorph(),
			technicalMorph(),
			platesMorph(),
		],
	};
}

/** Fresh envelope for the home route to install at the engine boundary. */
export function homeIntentStageEnvelope(): EmissionEnvelope {
	return {
		epoch: 1,
		tree: homeIntentStage(),
		choices: {},
	};
}

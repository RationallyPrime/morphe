/**
 * Home intent stage (KRA-356, KRA-358).
 *
 * The intent engine owns execution; this module owns the authored stage tree it
 * can move through. One Vary point keeps the content morphs mutually exclusive:
 * the default branch is empty, and each chip/palette intent selects exactly one
 * visitor story. No callbacks, no component-local routing, no raw geometry.
 */

import type { EmissionEnvelope, IntentRef, Node, Text, VaryId } from "$morphe";

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
	return morphPanel([
		eyebrow("Krates ehf."),
		t("Built in Reykjavík, led by the founder.", "heading", { emphasis: "strong" }),
		t(
			"Sókrates is built by Krates ehf. The sale is founder-led because the first conversation is part of the work: understanding which systems matter, where the friction sits and what would count as a useful first answer.",
			"body",
			{ emphasis: "muted" },
		),
		t(
			"You will talk to Hákon, not a queue. If there is a fit, the next step is a concrete workflow and a short path to installation.",
			"body",
			{ emphasis: "muted" },
		),
		t("Krates ehf., Reykjavík. 2026.", "caption", { emphasis: "muted" }),
		{
			kind: "cluster",
			role: "inline",
			children: [link("mailto:hakon@sokrates.is", "hakon@sokrates.is")],
		},
	]);
}

/** The pure authored stage tree. The default branch renders no visible content. */
export function homeIntentStage(): Node {
	return {
		kind: "vary",
		id: HOME_INTENT_STAGE_ID,
		default: HOME_STAGE_CHOICES.default,
		options: [
			{ kind: "stack", role: "section", direction: "block", children: [] },
			governanceMorph(),
			engagementMorph(),
			identityMorph(),
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

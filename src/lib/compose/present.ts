/**
 * THE COMPOSE PRESENTERS — typed `Capability` data turned into Morphe Node trees.
 *
 * This is the rendering half of "What can Sókrates do for you?": pure functions
 * that take GROUNDED `Capability` data (from `corpus.ts`) and a visitor's
 * `ComposeQuery` (from `match.ts` / `input.ts`) and emit a `Node` tree built
 * ENTIRELY out of the five domain compounds in `compounds.ts`. Nothing here
 * touches a scale, a pixel or a hex value — every leaf references INTENTS and
 * ROLES only, so the whole answer surface re-themes under any dialect as a
 * Lemma-3 fixed point. The authoring idiom is copied from `src/routes/_demo/
 * tree.ts`: a CompoundRef is DATA (`kind: "compound"`, `name`, `args`, `slots`),
 * variable-length children ride through SLOTS, and NODE args let the call site
 * own the register.
 *
 * Read-only by construction. The surface shows the MAP of what is possible; the
 * appliance is what acts, under governance. `tier` is rendered honestly so a
 * capability never presents itself as more than it is on the front door.
 *
 * Composition shape:
 *   capabilityCard(cap)            -> a ComposeCapabilityCard CompoundRef whose
 *                                     flow / evidence / models slots are filled
 *                                     with FlowArrow / SurfaceEvidence / ModelView
 *                                     refs derived from the capability's real
 *                                     endpoints and compiled model names.
 *   composeAnswer(caps, query)     -> a Frame(page) with a PainPrompt masthead
 *                                     (summary slot = result line + active-tag
 *                                     badges) over a Grid(list) of capabilityCard.
 *   emptyState(query, featured)    -> an honest "no direct match yet" answer that
 *                                     still shows the breadth via a few cards.
 */

import type { CompoundRef, Node } from "$morphe";
import type { Capability, SurfaceUse } from "./capability.js";
import type { ComposeQuery } from "./input.js";
import { tagsFromText } from "./taxonomy.js";

/* ---------------------------------------------------------------------------
 * Small typed Node helpers — keep the presenters readable and the registers
 * consistent. These build Text/Badge leaves only; no scales, no hex.
 * ------------------------------------------------------------------------- */

/** A Text node at a chosen semantic level / register. */
function text(
	value: string,
	as: NonNullable<import("$morphe").Text["as"]>,
	extra?: { emphasis?: import("$morphe").EmphasisClaim; intent?: import("$morphe").IntentRef },
): Node {
	return { kind: "text", value, as, ...extra };
}

/** Honest, human-readable label for a governance tier. Never "acts" here. */
function tierLabel(tier: Capability["tier"]): string {
	switch (tier) {
		case "read-only":
			return "Read-only";
		case "proposes":
			return "Proposes, never acts";
		default:
			// "acts" is never presented on this surface; degrade to the safe label.
			return "Read-only";
	}
}

/**
 * The honest governance Status NODE for a card header. The tone + signal text +
 * icon are driven by the real tier so a `proposes` capability reads "Proposes,
 * never acts" (caution / draw glyph) and a `read-only` one reads "Read-only"
 * (info / visibility glyph) — never the hardcoded chip the whole surface is
 * built to avoid. The text channel carries the non-color signal (WCAG 1.4.1).
 */
function tierStatus(tier: Capability["tier"]): Node {
	const proposes = tier === "proposes";
	return {
		kind: "status",
		tone: proposes ? "caution" : "info",
		signal: { text: tierLabel(tier), icon: proposes ? "draw" : "visibility" },
	};
}

/** A short directional verb for the flow edge, lifted from the tier posture. */
function flowVerb(cap: Capability): string {
	return cap.tier === "proposes" ? "proposes" : "reads";
}

/** A quiet, human label for a pain tag, e.g. "labor-cost" -> "Labor cost". */
function tagLabel(tag: string): string {
	const spaced = tag.replace(/-/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* ---------------------------------------------------------------------------
 * Leaf compound refs — one capability's grounding broken into its three slots.
 * ------------------------------------------------------------------------- */

/** A FlowArrow ref naming the source and target systems plus a flow verb. */
function flowArrow(cap: Capability): CompoundRef {
	return {
		kind: "compound",
		name: "ComposeFlowArrow",
		args: {
			source: text(cap.source.label, "caption", { intent: "accession" }),
			target: text(cap.target.label, "caption", { intent: "accession" }),
			label: flowVerb(cap),
		},
	};
}

/** One SurfaceEvidence ref per real endpoint the capability composes. */
function surfaceEvidence(surface: SurfaceUse): CompoundRef {
	return {
		kind: "compound",
		name: "ComposeSurfaceEvidence",
		args: {
			// method rides as a Badge NODE so its label carries the accessible method
			// text (an empty-label badge would be a color-and-hidden-glyph-only chip).
			method: {
				kind: "badge",
				label: surface.method,
				intent: "evidence",
				icon: "api",
			},
			path: surface.path,
			summary: surface.summary ?? "",
			system: surface.system,
			direction: surface.direction,
		},
	};
}

/** One ModelView chip per compiled model name the capability touches. */
function modelView(name: string): CompoundRef {
	return {
		kind: "compound",
		name: "ComposeModelView",
		args: { name },
	};
}

/**
 * The evidence slot: a single Disclosure ("Grounded in N real endpoints") whose
 * children are one SurfaceEvidence ref per surface. The Disclosure summary is the
 * verifiable claim; opening it reveals the citations a reader can check.
 */
function evidenceDisclosure(cap: Capability): Node {
	const count = cap.surfaces.length;
	const rows: Node[] = cap.surfaces.map((surface) => surfaceEvidence(surface));
	return {
		kind: "disclosure",
		summary: `Grounded in ${count} real ${count === 1 ? "endpoint" : "endpoints"}`,
		children: rows,
	};
}

/**
 * The models slot: a Cluster (role inline) of ModelView chips, one per compiled
 * model name. Empty when the capability lists no models (fallback stays blank).
 */
function modelsCluster(cap: Capability): Node {
	const names: readonly string[] = cap.models ?? [];
	const chips: Node[] = names.map((name) => modelView(name));
	return {
		kind: "cluster",
		role: "inline",
		align: "center",
		children: chips,
	};
}

/* ---------------------------------------------------------------------------
 * capabilityCard — one cross-system automation as a CapabilityCard CompoundRef.
 * ------------------------------------------------------------------------- */

/**
 * Build a `ComposeCapabilityCard` CompoundRef for one capability. The card's
 * params carry the register-owning NODE values (title / transform / value /
 * pairing) plus the honest tier as a Status NODE; the variable children ride the
 * slots:
 *   - flow:     a FlowArrow ref (source system -> verb -> target system);
 *   - evidence: a Disclosure of SurfaceEvidence rows (one per real endpoint);
 *   - models:   a Cluster of ModelView chips (one per compiled model name).
 */
export function capabilityCard(cap: Capability): CompoundRef {
	// Header-left carries the capability's domain (its lead pain tag) as a quiet,
	// neutral category label — NOT the source/target systems, which the FlowArrow
	// below already names. This keeps the amber accent to the single flow locus per
	// card and turns the header into a scannable domain marker instead of a repeat.
	const leadTag = cap.painPoints[0];
	const pairing = text(leadTag ? tagLabel(leadTag) : "Automation", "caption", {
		emphasis: "muted",
	});
	return {
		kind: "compound",
		name: "ComposeCapabilityCard",
		args: {
			title: text(cap.title, "subheading", { emphasis: "strong" }),
			transform: text(cap.transform, "caption", { emphasis: "muted" }),
			value: text(cap.value, "body"),
			tier: tierStatus(cap.tier),
			pairing,
		},
		slots: {
			flow: [flowArrow(cap)],
			evidence: [evidenceDisclosure(cap)],
			models: [modelsCluster(cap)],
		},
	};
}

/* ---------------------------------------------------------------------------
 * The PainPrompt summary slot — a result line + a Cluster of active-tag badges.
 * ------------------------------------------------------------------------- */

/**
 * The summary slot for the PainPrompt masthead: a result-count line followed by
 * a Cluster of intent-"evidence" Badges, one per active pain tag matched from
 * the visitor's free text. With no tags matched, just the count line shows.
 */
function summaryNodes(matchCount: number, query: ComposeQuery): Node[] {
	const tags = tagsFromText(query.pain);
	const countLine = text(
		`${matchCount} ${matchCount === 1 ? "capability matches" : "capabilities match"} your operation`,
		"body",
		{ emphasis: "strong" },
	);
	const nodes: Node[] = [countLine];
	if (tags.length > 0) {
		const badges: Node[] = tags.map((tag) => ({
			kind: "badge",
			label: tag,
			intent: "evidence",
			icon: "sell",
		}));
		nodes.push({
			kind: "cluster",
			role: "inline",
			align: "center",
			children: badges,
		});
	}
	return nodes;
}

/* ---------------------------------------------------------------------------
 * composeAnswer — the full answer tree (masthead + grid of cards).
 * ------------------------------------------------------------------------- */

/**
 * The composed answer: a Frame(page) with a PainPrompt masthead (heading + a
 * read-only-honest sub line; summary slot = result line + active-tag badges)
 * over a Grid(list) of capabilityCard(cap), one card per matched capability.
 * Empty match set delegates to `emptyState`.
 */
export function composeAnswer(caps: readonly Capability[], query: ComposeQuery): Node {
	if (caps.length === 0) {
		return emptyState(query, []);
	}

	const masthead: CompoundRef = {
		kind: "compound",
		name: "ComposePainPrompt",
		args: {
			heading: text("Here is what Sókrates can compose", "heading", { emphasis: "strong" }),
			sub: text(
				"Each capability below is a map across your systems, grounded in real endpoints and compiled model names. The appliance is what acts, under governance.",
				"body",
				{ emphasis: "muted" },
			),
		},
		slots: {
			summary: summaryNodes(caps.length, query),
		},
	};

	const cards: Node[] = caps.map((cap) => capabilityCard(cap));

	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children: [
			masthead,
			{ kind: "spacer", size: "md" },
			{
				kind: "grid",
				role: "list",
				minTrack: "regular",
				children: cards,
			},
		],
	};
}

/* ---------------------------------------------------------------------------
 * emptyState — honest "no direct match" answer that still shows the breadth.
 * ------------------------------------------------------------------------- */

/**
 * The default / no-match state: when the visitor has not asked yet, or named a
 * friction nothing resolved to, show the breadth Sókrates composes across these
 * systems via a few featured cards. The copy adapts: an inviting opener before
 * they type, an honest "nothing matched that" once they have. No false count, no
 * tag badges — the masthead owns the framing and the cards show the breadth.
 */
export function emptyState(query: ComposeQuery, featured: readonly Capability[]): Node {
	const typed = query.pain.trim().length > 0;
	const heading = typed ? "No direct match yet" : "What Sókrates can compose for you";
	const sub = typed
		? "Nothing lined up exactly with that. Here is the breadth Sókrates composes across these systems, each one grounded in real endpoints."
		: "Describe the friction in your operation and Sókrates composes the automations that fit, each one grounded in your real systems. Here is the breadth to begin with.";
	const note = typed
		? "Try naming the pain point in different words, or browse the examples below."
		: "Name a pain point and the systems you run to narrow this to your situation.";

	const masthead: CompoundRef = {
		kind: "compound",
		name: "ComposePainPrompt",
		args: {
			heading: text(heading, "heading", { emphasis: "strong" }),
			sub: text(sub, "body", { emphasis: "muted" }),
		},
		slots: {
			summary: [text(note, "caption", { emphasis: "muted" })],
		},
	};

	const cards: Node[] = featured.map((cap) => capabilityCard(cap));

	const children: Node[] = [masthead, { kind: "spacer", size: "md" }];
	if (cards.length > 0) {
		children.push({
			kind: "grid",
			role: "list",
			minTrack: "regular",
			children: cards,
		});
	}

	return {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 4,
		children,
	};
}

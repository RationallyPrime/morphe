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
 *   capabilityCard(cap)            -> an OUTCOME-LED ComposeCapabilityCard
 *                                     CompoundRef: the business `value` leads as
 *                                     the strong hero line, `title`/`transform`
 *                                     support it quietly, and the flow / evidence
 *                                     / models slots (FlowArrow / SurfaceEvidence /
 *                                     ModelView refs derived from the capability's
 *                                     real endpoints and compiled model names) are
 *                                     demoted into the template's single collapsed
 *                                     "How Sókrates wires this" proof footnote.
 *   composeAnswer(caps, query)     -> a Frame(page) with a PainPrompt masthead
 *                                     (summary slot = result line + active-tag
 *                                     badges) over a Grid(list) of capabilityCard.
 *   emptyState(query, featured)    -> an honest "no direct match yet" answer that
 *                                     still shows the breadth via a few cards.
 */

import type { CompoundRef, Node } from "$morphe";
import type { Capability, SurfaceUse, SystemId } from "./capability.js";
import type { ComposeQuery } from "./input.js";
import { SYSTEMS, tagsFromText } from "./taxonomy.js";

/** Default cap on rendered cards when the call site omits `limit`. Generous: the
 * cards are light (outcome + tier, with mechanism/endpoints behind a disclosure),
 * so breadth is the point — the route's "Show all" lifts to the full corpus. */
const DEFAULT_LIMIT = 9;

/** Display label for a system id, resolved from the canonical `SYSTEMS` table. */
function systemLabel(id: SystemId): string {
	return SYSTEMS.find((s) => s.id === id)?.label ?? id;
}

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

/**
 * Human label for an access posture — never the raw `read`/`write`/`event` enum,
 * which would leak internal vocabulary onto a citation-grade marketing surface
 * (the register is human metaphors, not internals). Mirrors tierLabel/tagLabel.
 */
function directionLabel(direction: SurfaceUse["direction"]): string {
	switch (direction) {
		case "write":
			return "Writes";
		case "event":
			return "On event";
		default:
			return "Reads";
	}
}

/* ---------------------------------------------------------------------------
 * Leaf compound refs — one capability's grounding broken into its three slots.
 * ------------------------------------------------------------------------- */

/**
 * The intermediate system in a three-way chain: the one member of `cap.systems`
 * that is neither the source nor the target. Returns `undefined` for one- and
 * two-system capabilities (where there is no middle hop to render). Pure — reads
 * only the capability's declared `systems` set against its source/target ids.
 */
function viaSystem(cap: Capability): SystemId | undefined {
	if (cap.systems.length < 3) return undefined;
	return cap.systems.find((id) => id !== cap.source.id && id !== cap.target.id);
}

/**
 * The OPTIONAL `via` sub-segment for a three-way FlowArrow: the intermediate
 * system label followed by a decorative arrow. Order matters — the FlowArrow
 * template is [source, (arrow + label), via, target], so the via's TRAILING arrow
 * is what bridges via -> target (the second hop). The template's own leading arrow
 * cluster bridges source -> via (the first hop), giving a correct two-hop chain
 * "source -> via -> target" with one arrow between every pair. The arrow lives
 * INSIDE this node so it exists only when there is a hop to point at — an omitted
 * via collapses to the template's blank default and no stray glyph survives.
 *
 * The middle hop is a WAYPOINT, not an endpoint, so its label is muted (no
 * accession amber): only the source and target systems carry the amber accent, so
 * a three-way card reads as two amber endpoints bridged by a quiet waypoint rather
 * than three equal-weight amber labels on one line. The edge arrow stays provenance.
 */
function viaSegment(viaId: SystemId): Node {
	return {
		kind: "cluster",
		role: "inline",
		align: "center",
		children: [
			text(systemLabel(viaId), "caption", { emphasis: "muted" }),
			{ kind: "icon", name: "arrow_forward", a11y: { role: "decorative" }, intent: "provenance" },
		],
	};
}

/**
 * A FlowArrow ref naming the source and target systems plus a flow verb. For a
 * three-way "deal to delivery" capability the middle system rides as the optional
 * `via` hop, so the edge reads as a chain: source -> via -> target. One- and
 * two-system capabilities pass no `via`, leaving the single-hop render unchanged.
 */
function flowArrow(cap: Capability): CompoundRef {
	const via = viaSystem(cap);
	return {
		kind: "compound",
		name: "ComposeFlowArrow",
		args: {
			source: text(cap.source.label, "caption", { intent: "accession" }),
			target: text(cap.target.label, "caption", { intent: "accession" }),
			// Two-system edges carry the flow verb ("reads"/"proposes") on the single arrow.
			// The three-way chain drops it: the path reads as a clean source -> via -> target
			// map (the posture is already stated by the card's tier Status), so no verb floats
			// between the first arrow and the via waypoint.
			label: via !== undefined ? "" : flowVerb(cap),
			// The middle hop only exists for three-system caps; omitted otherwise so the
			// FlowArrow template's blank default keeps the single/two-system render intact.
			...(via !== undefined ? { via: viaSegment(via) } : {}),
		},
	};
}

/**
 * The `flow` slot for a card. A single-system capability (source === target) has
 * no edge to draw, so it renders ONE system label and no arrow — never a FlowArrow
 * pointing a system at itself. Multi-system capabilities render the FlowArrow ref
 * (which itself chains through `via` for the three-way case).
 */
function flowSlot(cap: Capability): Node {
	if (cap.source.id === cap.target.id) {
		return text(cap.source.label, "caption", { intent: "accession" });
	}
	return flowArrow(cap);
}

/**
 * One SurfaceEvidence ref per real endpoint the capability composes. Every proof
 * field rides as a NODE arg so the call site owns the register: the path is the
 * citation locus (caption register), the summary/system/direction trail as muted
 * captions. NODE args (not bare strings) keep the proof genuinely quieter than
 * the card's outcome — a bare string coerces to BODY register, which would render
 * heavier and larger than the card's own supporting copy.
 */
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
			// The endpoint path — the citation locus, in the evidence caption register.
			path: text(surface.path, "caption", { intent: "evidence" }),
			// The human label lifted from the spec — a muted caption.
			summary: text(surface.summary ?? "", "caption", { emphasis: "muted" }),
			// Provenance trail: which system + which access direction, both muted captions.
			system: text(systemLabel(surface.system), "caption", { emphasis: "muted" }),
			direction: text(directionLabel(surface.direction), "caption", { emphasis: "muted" }),
		},
	};
}

/**
 * One ModelView chip per compiled model name the capability touches. The model
 * name rides as a caption-register accession Text node so the chip reads as a
 * quiet catalogue code, not body copy (a bare string coerces to body register).
 */
function modelView(name: string): CompoundRef {
	return {
		kind: "compound",
		name: "ComposeModelView",
		args: { name: text(name, "caption", { intent: "accession" }) },
	};
}

/**
 * The evidence slot content: the verifiable endpoint citations, one
 * SurfaceEvidence row per surface, wrapped in a quiet block Stack. This used to
 * be its OWN "Grounded in N real endpoints" Disclosure, but the card template now
 * owns the single outer "How Sókrates wires this" Disclosure that demotes ALL the
 * proof (flow + endpoints + models) to one collapsed footnote — so the evidence
 * slot is plain rows spliced inside it, not a second nested disclosure. The
 * real-endpoint count still leads the block as a muted caption so a reader who
 * opens the footnote sees exactly how many endpoints back the capability — the
 * differentiator stays present and verifiable, just no longer shouted.
 */
function evidenceRows(cap: Capability): Node {
	const count = cap.surfaces.length;
	const rows: Node[] = cap.surfaces.map((surface) => surfaceEvidence(surface));
	return {
		kind: "stack",
		role: "list",
		direction: "block",
		emphasis: "muted",
		children: [
			text(`Grounded in ${count} real ${count === 1 ? "endpoint" : "endpoints"}`, "caption", {
				emphasis: "muted",
			}),
			...rows,
		],
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
 * Build a `ComposeCapabilityCard` CompoundRef for one capability — OUTCOME-LED.
 *
 * The customer reads the RESULT first. The register assignment is what inverts the
 * old hierarchy entirely in DATA (the template owns the order; the call site owns
 * the weight):
 *   - value:     THE HERO — the business outcome, promoted to a strong subheading
 *                so it owns the card's visual weight. Was a plain body line before.
 *   - title:     SUPPORTING — demoted from a strong subheading to a quiet caption;
 *                the short human name UNDER the outcome, not a heading above it.
 *   - transform: SUPPORTING — one plain muted sentence of what it does (unchanged).
 *   - tier:      the honest governance Status (trust, not jargon) — preserved.
 *
 * The variable children ride the slots, spliced INSIDE the template's single
 * "How Sókrates wires this" Disclosure that demotes ALL the proof to one collapsed
 * footnote:
 *   - flow:     a FlowArrow ref (source system -> verb -> target system);
 *   - evidence: a muted Stack of SurfaceEvidence rows led by the endpoint count;
 *   - models:   a Cluster of ModelView chips (one per compiled model name).
 */
export function capabilityCard(cap: Capability): CompoundRef {
	// Header-left carries the capability's domain (its lead pain tag) as a quiet,
	// neutral category label — NOT the source/target systems, which the FlowArrow
	// inside the proof footnote names. Muted so it frames the outcome below without
	// competing with it for the card's single amber accent.
	const leadTag = cap.painPoints[0];
	const pairing = text(leadTag ? tagLabel(leadTag) : "Automation", "caption", {
		emphasis: "muted",
	});
	return {
		kind: "compound",
		name: "ComposeCapabilityCard",
		args: {
			// THE HERO: the outcome carries the weight. Strong subheading, no intent —
			// the customer reads the business result first.
			value: text(cap.value, "subheading", { emphasis: "strong" }),
			// SUPPORTING: the human name, demoted to a quiet caption under the outcome.
			title: text(cap.title, "caption", { emphasis: "muted" }),
			transform: text(cap.transform, "caption", { emphasis: "muted" }),
			tier: tierStatus(cap.tier),
			pairing,
		},
		slots: {
			// All three proof children land inside the template's collapsed proof Disclosure.
			flow: [flowSlot(cap)],
			evidence: [evidenceRows(cap)],
			models: [modelsCluster(cap)],
		},
	};
}

/* ---------------------------------------------------------------------------
 * The PainPrompt summary slot — a result line + a Cluster of active-tag badges.
 * ------------------------------------------------------------------------- */

/**
 * The summary slot for the PainPrompt masthead: a result-count line, an OPTIONAL
 * "showing N of M" note when the answer was capped below the full match count,
 * then a Cluster of intent-"evidence" Badges, one per active pain tag matched from
 * the visitor's free text. With no tags matched, just the count line (and the cap
 * note, if any) shows.
 *
 * `matchCount` is the FULL number of matched capabilities; `shownCount` is how many
 * cards were actually rendered. When `shownCount < matchCount` the answer was
 * limited, so an honest note tells the visitor exactly how many of the total they
 * are seeing and how to narrow — no silent truncation.
 */
function summaryNodes(matchCount: number, shownCount: number, query: ComposeQuery): Node[] {
	const tags = tagsFromText(query.pain);
	const countLine = text(
		`${matchCount} ${matchCount === 1 ? "capability matches" : "capabilities match"} your operation`,
		"body",
		{ emphasis: "strong" },
	);
	const nodes: Node[] = [countLine];
	if (shownCount < matchCount) {
		nodes.push(
			text(
				`Showing ${shownCount} of ${matchCount}. Refine the friction or the systems you run to narrow this.`,
				"caption",
				{ emphasis: "muted" },
			),
		);
	}
	if (tags.length > 0) {
		const badges: Node[] = tags.map((tag) => ({
			kind: "badge",
			label: tagLabel(tag),
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
 *
 * `limit` caps how many cards render. Omitted (or any value `>= caps.length`) it
 * renders ALL matches, the original behavior. When `caps.length > limit` only the
 * first `limit` (the highest-ranked, since `caps` arrives pre-sorted from the
 * matcher) render, and the masthead carries an honest "Showing N of M" note. The
 * default cap keeps the first view scannable; the route's "Show all" affordance
 * passes a larger `limit` to reveal the rest. Pure — `limit` only narrows what is
 * rendered, never reorders.
 */
export function composeAnswer(
	caps: readonly Capability[],
	query: ComposeQuery,
	limit: number = DEFAULT_LIMIT,
): Node {
	if (caps.length === 0) {
		return emptyState(query, []);
	}

	// A non-positive limit would render nothing and read as a bug; clamp to the
	// full set so the surface degrades to "show everything" rather than blank.
	const cap = limit > 0 ? Math.min(limit, caps.length) : caps.length;
	const shown = caps.slice(0, cap);

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
			summary: summaryNodes(caps.length, shown.length, query),
		},
	};

	const cards: Node[] = shown.map((c) => capabilityCard(c));

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
export function emptyState(
	query: ComposeQuery,
	featured: readonly Capability[],
	limit: number = DEFAULT_LIMIT,
): Node {
	const typed = query.pain.trim().length > 0;
	const heading = typed ? "No direct match yet" : "What Sókrates can compose for you";
	const sub = typed
		? "Nothing lined up exactly with that. Here is the breadth Sókrates composes across these systems, each one grounded in real endpoints."
		: "Describe the friction in your operation and Sókrates composes the automations that fit, each one grounded in your real systems. Here is the breadth to begin with.";
	const note = typed
		? "Try naming the pain point in different words, or browse the examples below."
		: "Name a pain point and the systems you run to narrow this to your situation.";

	// The featured breadth obeys the same cap as a real answer so the default view
	// stays scannable instead of dumping every example; the route's "Show all"
	// affordance lifts it. A non-positive limit degrades to "show everything".
	const cap = limit > 0 ? Math.min(limit, featured.length) : featured.length;
	const shown = featured.slice(0, cap);

	const summary: Node[] = [text(note, "caption", { emphasis: "muted" })];
	if (shown.length < featured.length) {
		summary.push(
			text(`Showing ${shown.length} of ${featured.length} examples.`, "caption", {
				emphasis: "muted",
			}),
		);
	}

	const masthead: CompoundRef = {
		kind: "compound",
		name: "ComposePainPrompt",
		args: {
			heading: text(heading, "heading", { emphasis: "strong" }),
			sub: text(sub, "body", { emphasis: "muted" }),
		},
		slots: {
			summary,
		},
	};

	const cards: Node[] = shown.map((c) => capabilityCard(c));

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

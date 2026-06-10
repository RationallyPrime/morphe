/**
 * SITE COMPOUNDS — the Sókrates marketing surface, expressed as DATA.
 *
 * These are the recurring editorial shapes the marketing pages (home, how it
 * works, architecture, onboarding) compose from: a page hero, a value panel, a
 * pull quote, a numbered process step, a media/copy split, and a closing
 * call-to-action band. Each is a `CompoundDef` over Morphe primitives — a params
 * schema plus a template tree whose `ParamRef` leaves resolve hygienically
 * against the compound's own args and whose `Slot` leaves fill from the call
 * site (`present.ts`). They reference INTENTS and ROLES only, never a scale, a
 * pixel or a hex, so the whole surface re-themes under any dialect as a Lemma-3
 * fixed point — the Icelandic Archive register is its editorial home.
 *
 * Authoring idioms are copied verbatim from `src/lib/compose/compounds.ts` and
 * `src/routes/_demo/tree.ts`:
 *   - every variable piece rides as a NODE param so the CALL SITE owns the
 *     register (`as` / `intent` / `emphasis`) — a bare string would coerce to
 *     body register and flatten the hierarchy;
 *   - variable-length children ride through SLOTS (CTA clusters, footnotes);
 *   - registration runs the factory gate (expand-with-defaults, grammar
 *     type-check, acyclicity, depth bound) and is guarded for idempotency.
 *
 * A deliberate constraint shapes these defs: the factory substitutes ParamRef
 * NODE CHILDREN and fills SLOTS — it does not interpolate into a node's string
 * fields (Disclosure.summary, Badge.label, Media.src). So anything keyed by a
 * raw string (FAQ questions, badge labels, image sources) is authored directly
 * in `present.ts`, never smuggled through a param. Every compound below carries
 * its variability purely as node params + slots, which is why it registers.
 */

import type { CompoundDef, CompoundRegistry } from "$morphe";
import { registry } from "$morphe";

/* ===========================================================================
 * SiteHero — a page masthead.
 *
 * params: eyebrow (node) · title (node, required) · lede (node)
 * slots:  proof — a quiet proof / reassurance line under the headline
 *
 * The loud top of a page: a quiet mono eyebrow, the display headline (the call
 * site sets `as: "display"`), a supporting lede, then an honest proof line. The
 * call-site CompoundRef claims `strong` so the headline owns the fold; the
 * dialect's beacon budget keeps a single amber claim from multiplying. The
 * conversion CTAs are NOT in the tree — they are native token-styled anchors
 * the page renders beside this masthead (the same "controls live outside the tree" idiom the
 * composer uses), because a real amber primary button must navigate, and the
 * grammar's Button is declarative while its Link is an inline underlined anchor.
 * ========================================================================= */

export const SiteHero: CompoundDef = {
	name: "SiteHero",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			eyebrow: {
				type: "node",
				default: {
					kind: "text",
					value: "",
					as: "caption",
					intent: "accession",
				},
				description: "Quiet mono kicker above the headline (a Text node).",
			},
			title: {
				type: "node",
				required: true,
				description: "The display headline (a Text node).",
			},
			lede: {
				type: "node",
				default: { kind: "text", value: "", as: "body", emphasis: "muted" },
				description: "Supporting line under the headline (a Text node).",
			},
		},
	},
	// No emphasis claim on the template root — the factory gate rejects it
	// (claims at the root are the CALL SITE's to make, via CompoundRef.emphasis,
	// so wrapping in a compound commutes with the budget law). Every SiteHero
	// call site in present.ts claims "strong" on the ref.
	template: {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			{ kind: "param-ref", param: "eyebrow" },
			{ kind: "param-ref", param: "title" },
			{ kind: "param-ref", param: "lede" },
			{ kind: "spacer", size: "sm" },
			// An honest, quiet proof line (e.g. "On-premises · Read-only until you authorise").
			{ kind: "slot", name: "proof", fallback: [] },
		],
	},
};

/* ===========================================================================
 * SiteValueProp — one differentiator panel (for a value triad / grid).
 *
 * params: index (node) · heading (node, required) · body (node, required)
 * slots:  foot — an optional trailing node (a Link, a Status, a badge cluster)
 *
 * A raised panel: an optional quiet accession marker, a subheading, a body
 * paragraph, and an optional foot. No decorative icon above the heading (the
 * Archive register is typographic, not icon-grid) — the words carry the weight.
 * ========================================================================= */

export const SiteValueProp: CompoundDef = {
	name: "SiteValueProp",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			index: {
				type: "node",
				default: {
					kind: "text",
					value: "",
					as: "caption",
					intent: "accession",
				},
				description: "Optional quiet marker (a Text node) — a shelfmark, not a step number.",
			},
			heading: {
				type: "node",
				required: true,
				description: "The panel heading (a Text node).",
			},
			body: {
				type: "node",
				required: true,
				description: "The panel body (a Text node).",
			},
		},
	},
	template: {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "panel",
				direction: "block",
				children: [
					{ kind: "param-ref", param: "index" },
					{ kind: "param-ref", param: "heading" },
					{ kind: "param-ref", param: "body" },
					{ kind: "slot", name: "foot", fallback: [] },
				],
			},
		],
	},
};

/* ===========================================================================
 * SitePullquote — a large editorial pull quote.
 *
 * params: quote (node, required) · attribution (node)
 *
 * The Sókrates house voice in display register: a memorable line set large, with
 * a quiet attribution beneath. The call site sets `as: "display"` on the quote
 * and a muted accession caption on the attribution.
 * ========================================================================= */

export const SitePullquote: CompoundDef = {
	name: "SitePullquote",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			quote: {
				type: "node",
				required: true,
				description: "The pull quote (a Text node, display).",
			},
			attribution: {
				type: "node",
				default: { kind: "text", value: "", as: "caption", emphasis: "muted" },
				description: "Quiet attribution / source line (a Text node).",
			},
		},
	},
	template: {
		kind: "frame",
		role: "section",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "section",
				direction: "block",
				emphasis: "strong",
				children: [
					{ kind: "param-ref", param: "quote" },
					{ kind: "param-ref", param: "attribution" },
				],
			},
		],
	},
};

/* ===========================================================================
 * SiteStep — one numbered step in a real ordered sequence.
 *
 * params: index (node, required) · title (node, required) · body (node, required)
 * slots:  foot — optional trailing node (a status, a link)
 *
 * Numbers EARN their place here: this is an actual ordered process (the
 * onboarding sequence, the read→propose→act governance ladder), where the order
 * carries information. The index rides as a node so the call site sets the quiet
 * accession register; the title sits beside it, the body underneath.
 * ========================================================================= */

export const SiteStep: CompoundDef = {
	name: "SiteStep",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			index: {
				type: "node",
				required: true,
				description: "The step marker, e.g. '01' (a Text node).",
			},
			title: {
				type: "node",
				required: true,
				description: "The step title (a Text node).",
			},
			body: {
				type: "node",
				required: true,
				description: "The step body (a Text node).",
			},
		},
	},
	template: {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "panel",
				direction: "block",
				children: [
					{
						kind: "cluster",
						role: "inline",
						align: "baseline",
						children: [
							{ kind: "param-ref", param: "index" },
							{ kind: "param-ref", param: "title" },
						],
					},
					{ kind: "param-ref", param: "body" },
					{ kind: "slot", name: "foot", fallback: [] },
				],
			},
		],
	},
};

/* ===========================================================================
 * SiteFeatureSplit — a media / copy two-column section.
 *
 * params: media (node, required) · eyebrow (node) · heading (node, required)
 *         · body (node, required)
 * slots:  aside — extra copy under the body
 *         foot  — a CTA cluster (Link / Button nodes)
 *
 * A real image carries one half; the editorial copy carries the other. The Grid
 * with a wide min-track resolves to two columns on a wide viewport and stacks on
 * a narrow one with no breakpoint. The media is a `Media` node the call site
 * builds (with required alt text) — never a colored placeholder.
 * ========================================================================= */

export const SiteFeatureSplit: CompoundDef = {
	name: "SiteFeatureSplit",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			media: {
				type: "node",
				required: true,
				description: "The section image (a Media node, alt required).",
			},
			eyebrow: {
				type: "node",
				default: {
					kind: "text",
					value: "",
					as: "caption",
					intent: "accession",
				},
				description: "Quiet mono kicker over the heading (a Text node).",
			},
			heading: {
				type: "node",
				required: true,
				description: "The section heading (a Text node).",
			},
			body: {
				type: "node",
				required: true,
				description: "The section body (a Text node).",
			},
		},
	},
	template: {
		kind: "grid",
		role: "list",
		minTrack: "wide",
		children: [
			{ kind: "param-ref", param: "media" },
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					{ kind: "param-ref", param: "eyebrow" },
					{ kind: "param-ref", param: "heading" },
					{ kind: "param-ref", param: "body" },
					{ kind: "slot", name: "aside", fallback: [] },
					{ kind: "slot", name: "foot", fallback: [] },
				],
			},
		],
	},
};

/* ===========================================================================
 * SiteCtaBanner — a closing call-to-action band (copy only).
 *
 * params: eyebrow (node) · heading (node, required) · sub (node)
 * slots:  note — an optional quiet line under the heading
 *
 * The front-door copy: a strong heading and a supporting line. The call-site
 * CompoundRef claims section emphasis, while the page wraps
 * this in a native raised band and renders the conversion CTAs (contact /
 * onboarding) as native token-styled anchors inside that band — same idiom as
 * SiteHero. Used to close every marketing page.
 * ========================================================================= */

export const SiteCtaBanner: CompoundDef = {
	name: "SiteCtaBanner",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			eyebrow: {
				type: "node",
				default: {
					kind: "text",
					value: "",
					as: "caption",
					intent: "accession",
				},
				description: "Quiet mono kicker (a Text node).",
			},
			heading: {
				type: "node",
				required: true,
				description: "The CTA heading (a Text node).",
			},
			sub: {
				type: "node",
				default: { kind: "text", value: "", as: "body", emphasis: "muted" },
				description: "Supporting line under the heading (a Text node).",
			},
		},
	},
	// A plain Stack (not a Frame): the PAGE wraps this in a native raised band so
	// the copy and the native CTA buttons share one surface. A frame here would
	// double-raise the band. No emphasis claim on the root (gate-rejected) —
	// call sites claim "strong" on the CompoundRef.
	template: {
		kind: "stack",
		role: "section",
		direction: "block",
		children: [
			{ kind: "param-ref", param: "eyebrow" },
			{ kind: "param-ref", param: "heading" },
			{ kind: "param-ref", param: "sub" },
			{ kind: "slot", name: "note", fallback: [] },
		],
	},
};

/* ===========================================================================
 * Registration — through the factory gate, idempotent (mirrors
 * registerComposeCompounds). A failing def is never added; a malformed def
 * surfaces loudly instead of leaving a surface silently un-renderable.
 * ========================================================================= */

export const SITE_COMPOUNDS: readonly CompoundDef[] = [
	SiteHero,
	SiteValueProp,
	SitePullquote,
	SiteStep,
	SiteFeatureSplit,
	SiteCtaBanner,
];

/**
 * Register all site compounds through the factory gate. Idempotent (skips names
 * already present, so HMR / repeated imports are safe) and DI-aware (defaults to
 * the process-wide registry, accepts any `CompoundRegistry`). Throws on a genuine
 * registration failure so a malformed def surfaces loudly.
 */
export function registerSiteCompounds(reg: CompoundRegistry = registry): void {
	for (const def of SITE_COMPOUNDS) {
		if (reg.has(def.name)) continue;
		const result = reg.register(def);
		if (!result.ok) {
			throw new Error(`${def.name} failed registration: ${result.errors.join("; ")}`);
		}
	}
}

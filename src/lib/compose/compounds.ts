/**
 * Compose domain compounds — the five marketing-surface compounds behind
 * "What can Sókrates do for you?", expressed as DATA (Lemma 1, algebraic
 * closure: `createCompoundComponent` lifted from code to data).
 *
 * These are the read-only, GROUNDED building blocks the composer renders when a
 * visitor states a pain point and names their systems. Each is a `CompoundDef`
 * over Morphe primitives: a params schema + a template tree whose `ParamRef`
 * leaves resolve hygienically against the compound's own args, and whose `Slot`
 * leaves fill from the call site (`present.ts`). They reference INTENTS and ROLES
 * only — never a scale, never a raw value, never a hex — so the whole surface
 * re-themes under any dialect as a Lemma-3 fixed point. The icelandic-archive
 * register is the editorial home: tasteful, citation-grade, honestly read-only.
 *
 *   PainPrompt      — the answer masthead (heading + sub + a summary slot).
 *   FlowArrow       — source-system → (label) → target-system; arrow decorative.
 *   SurfaceEvidence — one verifiable endpoint row (method Badge + path caption).
 *   ModelView       — a compiled-model chip (accession register, schema icon).
 *   CapabilityCard  — one cross-system automation card; SLOTS own the variable
 *                     children (flow / evidence / models) so registration is
 *                     order-independent — the card template references NO other
 *                     compound by name.
 *
 * Authoring idioms copied verbatim from src/routes/_demo/tree.ts (the
 * CatalogueEntry compound): NODE params let the call site own register; STRING
 * params coerce to Text; variable-length children go through SLOTS; registration
 * runs the factory gate and is guarded for idempotency.
 */

import type { CompoundDef, CompoundRegistry } from "$morphe";
import { registry } from "$morphe";

/* ===========================================================================
 * PainPrompt — the answer masthead.
 *
 * params: heading (node, required) · sub (node)
 * slots:  summary  — the result-count / active-tags line the presenter fills.
 *
 * The visitor's question, answered: a strong display heading, an optional
 * supporting line, then the summary slot (e.g. "7 capabilities match" + the
 * active pain-tag badges).
 * ========================================================================= */

export const PainPrompt: CompoundDef = {
	name: "ComposePainPrompt",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			heading: {
				type: "node",
				required: true,
				description: "The answer masthead heading (a Text node).",
			},
			sub: {
				type: "node",
				default: {
					kind: "text",
					value: "Grounded in real endpoints and compiled models. Verifiable, not asserted.",
					as: "body",
					emphasis: "muted",
				},
				description: "Supporting line under the heading (a Text node).",
			},
		},
	},
	template: {
		kind: "stack",
		role: "section",
		direction: "block",
		emphasis: "strong",
		children: [
			{ kind: "text", value: "What Sókrates can do", as: "caption", intent: "accession" },
			// The visitor's answered question — call site owns the register.
			{ kind: "param-ref", param: "heading" },
			{ kind: "param-ref", param: "sub" },
			{ kind: "spacer", size: "xs" },
			// The presenter fills this with the result-count + active-tag badges.
			{
				kind: "slot",
				name: "summary",
				fallback: [
					{
						kind: "text",
						value: "Name a pain point and your systems to compose.",
						as: "caption",
						emphasis: "muted",
					},
				],
			},
		],
	},
};

/* ===========================================================================
 * FlowArrow — source-system → (label) → [via → ] target-system.
 *
 * params: source (node, required) · target (node, required) · label (string)
 *         · via (node)
 *
 * A directional pairing read inline: the source system, a decorative arrow icon
 * (optionally captioned with the flow label), an OPTIONAL intermediate `via` hop,
 * then the target system. Reads as a map edge — or a two-hop map path for the
 * three-way "deal to delivery" capabilities — not an action. The arrow glyphs are
 * decorative; the systems carry the meaning.
 *
 * `via` is OPTIONAL and DEFAULTED to a blank Text node, so it follows the SAME
 * no-op idiom the existing `label` param already uses (an empty param-ref → blank
 * Text → nothing rendered). The DEFAULT carries no arrow of its own, so an
 * OMITTED `via` collapses to nothing and the template renders EXACTLY as before:
 * source → (arrow + label) → target, a single hop. Every existing two-/three-arg
 * FlowArrow ref therefore stays valid and the grammar fixed point is preserved.
 *
 * When the call site WANTS the intermediate hop it passes `via` as a complete
 * sub-segment node — a Cluster of [via-system label, decorative TRAILING arrow] —
 * so the second arrow exists ONLY when there is a via to point at (no stray glyph on
 * the single-hop path). Order is load-bearing: the template's own leading arrow
 * cluster bridges source → via, and the via's trailing arrow bridges via → target,
 * so the chain reads source → (arrow) → via → (arrow) → target with one arrow
 * between every pair. Keeping the via-arrow inside the `via` node (rather than
 * hardcoding a second arrow in the template) is what lets presence/absence branch
 * cleanly under the conditional-free factory. References intents only (accession for
 * the endpoint systems, provenance for the decorative edge); a11y on the arrow stays
 * decorative.
 * ========================================================================= */

export const FlowArrow: CompoundDef = {
	name: "ComposeFlowArrow",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			source: {
				type: "node",
				required: true,
				description: "The source/trigger system (a Text or Badge node).",
			},
			target: {
				type: "node",
				required: true,
				description: "The target/acted-upon system (a Text or Badge node).",
			},
			label: {
				type: "string",
				default: "",
				description: "Optional caption on the flow edge (e.g. 'on approval').",
			},
			via: {
				type: "node",
				// Default is a blank Text node carrying NO arrow — an omitted via renders
				// nothing, so the single-hop template is byte-for-byte unchanged. The call
				// site supplies the arrow+system sub-segment only when a hop is wanted.
				default: { kind: "text", value: "" },
				description:
					"Optional intermediate hop in a multi-hop chain — a sub-segment node (a Cluster of [decorative arrow, via-system label]) the call site builds when it wants source → via → target. Defaulted to a blank Text node so an omitted via collapses to nothing and the single-hop render is unchanged (same no-op idiom as the empty `label`).",
			},
		},
	},
	template: {
		kind: "cluster",
		role: "inline",
		align: "center",
		children: [
			{ kind: "param-ref", param: "source" },
			{
				kind: "cluster",
				role: "inline",
				align: "center",
				children: [
					{
						kind: "icon",
						name: "arrow_forward",
						a11y: { role: "decorative" },
						intent: "provenance",
					},
					// The flow label rides as a caption beside the arrow (empty -> blank Text).
					{ kind: "param-ref", param: "label" },
				],
			},
			// The OPTIONAL intermediate hop. Defaulted blank (renders nothing) so the
			// single-hop case is unchanged; when supplied it carries its OWN arrow +
			// via-system, making source → via → target a two-hop read with no stray
			// glyph on the single-hop path.
			{ kind: "param-ref", param: "via" },
			{ kind: "param-ref", param: "target" },
		],
	},
};

/* ===========================================================================
 * SurfaceEvidence — one verifiable endpoint citation row.
 *
 * params: method (node, required) · path (string, required) · summary (string)
 *         · system (string) · direction (string)
 *
 * The load-bearing proof: a real endpoint, rendered like a citation. The HTTP
 * method is a Badge in the evidence register; the path reads in the caption
 * (monospace-ish) register; the summary is the human label lifted from the spec;
 * the system + direction trail as muted provenance. Nothing here is a claim — it
 * is an artifact a reader can check against the system's own API.
 * ========================================================================= */

export const SurfaceEvidence: CompoundDef = {
	name: "ComposeSurfaceEvidence",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			method: {
				type: "node",
				required: true,
				description:
					"HTTP method as a Badge node (e.g. GET / POST) — the badge label carries the accessible method text.",
			},
			path: {
				type: "string",
				required: true,
				description: "The endpoint path, e.g. /api/v2/timeclocks (caption register).",
			},
			summary: {
				type: "string",
				default: "",
				description: "Human label lifted from the spec.",
			},
			system: {
				type: "string",
				default: "",
				description: "System slug the endpoint belongs to.",
			},
			direction: {
				type: "string",
				default: "read",
				description: "read | write | event — the access posture.",
			},
		},
	},
	template: {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "center",
		children: [
			{
				kind: "cluster",
				role: "inline",
				align: "center",
				children: [
					// The verb of the citation — method as a Badge in the evidence register.
					// Filled by the call site (a Badge node) so the real method renders as the
					// badge's accessible label, never an empty color-only chip.
					{ kind: "param-ref", param: "method" },
					// The path reads as a citation locus (caption register).
					{
						kind: "stack",
						role: "inline",
						direction: "block",
						children: [
							{ kind: "param-ref", param: "path" },
							{ kind: "param-ref", param: "summary" },
						],
					},
				],
			},
			// Provenance trail: which system + which access direction.
			{
				kind: "cluster",
				role: "inline",
				align: "center",
				children: [
					{ kind: "param-ref", param: "system" },
					{ kind: "param-ref", param: "direction" },
				],
			},
		],
	},
};

/* ===========================================================================
 * ModelView — a compiled-model chip.
 *
 * params: name (string, required) · system (string)
 *
 * Proof that Hyle ingested the spec: the name of an Eidos/Pydantic model the
 * capability touches, rendered as a small accession-register chip with a schema
 * glyph. Reads like a catalogue accession code, not a claim.
 * ========================================================================= */

export const ModelView: CompoundDef = {
	name: "ComposeModelView",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			name: {
				type: "string",
				required: true,
				description: "The compiled model name (an Eidos/Pydantic model).",
			},
			system: {
				type: "string",
				default: "",
				description: "System slug the model belongs to.",
			},
		},
	},
	template: {
		kind: "cluster",
		role: "inline",
		align: "center",
		children: [
			// The schema glyph is a category marker; the model-name Text beside it carries
			// the meaning, so the icon is decorative — otherwise a card touching N models
			// makes a screen reader announce "Compiled model" N times before each name.
			{ kind: "icon", name: "schema", a11y: { role: "decorative" }, intent: "accession" },
			{ kind: "param-ref", param: "name" },
			{ kind: "param-ref", param: "system" },
		],
	},
};

/* ===========================================================================
 * CapabilityCard — one cross-system automation.
 *
 * params: title (node, required) · transform (node, required) · value (node,
 *         required) · tier (node, required) · pairing (node)
 * slots:  flow · evidence · models — the variable children the presenter fills.
 *
 * A raised panel: a header toolbar pairing (left) beside a tier Status (right),
 * the capability title, the flow slot (a FlowArrow ref), the transform sentence
 * in a muted caption, the value outcome, then the evidence slot (a Disclosure of
 * SurfaceEvidence rows) and the models slot (a cluster of ModelView chips).
 *
 * CRITICAL: this template references NO other compound by name. The flow /
 * evidence / models children arrive entirely through SLOTS from present.ts, so
 * the card registers cleanly regardless of registration order.
 * ========================================================================= */

export const CapabilityCard: CompoundDef = {
	name: "ComposeCapabilityCard",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			title: {
				type: "node",
				required: true,
				description: "The capability title (a Text node).",
			},
			transform: {
				type: "node",
				required: true,
				description: "One plain sentence: what it does (a Text node, caption/muted register).",
			},
			value: {
				type: "node",
				required: true,
				description: "The business outcome it produces (a Text node).",
			},
			tier: {
				type: "node",
				required: true,
				description:
					"Governance posture as a Status node — read-only vs proposes — whose signal text renders the honest tier label so a card never presents itself as more than it is.",
			},
			pairing: {
				type: "node",
				default: {
					kind: "text",
					value: "Cross-system",
					as: "caption",
					intent: "accession",
				},
				description: "The system pairing label shown in the header (a Text or Badge node).",
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
					// Header: the system pairing (left) + a tier Status (right).
					{
						kind: "cluster",
						role: "toolbar",
						justify: "between",
						align: "center",
						children: [
							{ kind: "param-ref", param: "pairing" },
							// The honest governance posture — a Status node from the call site,
							// tone + signal text driven by the capability's real tier.
							{ kind: "param-ref", param: "tier" },
						],
					},
					// The capability title — call site owns the register.
					{ kind: "param-ref", param: "title" },
					// Flow edge (source → target) filled by the presenter.
					{
						kind: "slot",
						name: "flow",
						fallback: [
							{ kind: "text", value: "Cross-system flow", as: "caption", emphasis: "muted" },
						],
					},
					// What it does — one plain sentence (call site sets caption/muted).
					{ kind: "param-ref", param: "transform" },
					// The outcome it produces.
					{ kind: "param-ref", param: "value" },
					{ kind: "spacer", size: "xs" },
					// Verifiable evidence: a Disclosure of SurfaceEvidence rows.
					{
						kind: "slot",
						name: "evidence",
						fallback: [
							{
								kind: "text",
								value: "Evidence pending compilation.",
								as: "caption",
								emphasis: "muted",
							},
						],
					},
					// Compiled-model chips.
					{
						kind: "slot",
						name: "models",
						fallback: [],
					},
				],
			},
		],
	},
};

/* ===========================================================================
 * Registration — through the factory gate, idempotent (mirrors
 * registerDemoCompounds in tree.ts). A failing def is never added; we surface a
 * registration failure loudly so an authoring mistake doesn't pass silently.
 * ========================================================================= */

export const COMPOSE_COMPOUNDS: readonly CompoundDef[] = [
	PainPrompt,
	FlowArrow,
	SurfaceEvidence,
	ModelView,
	CapabilityCard,
];

/**
 * Register all five compose compounds through the factory gate. Idempotent
 * (skips names already present, so HMR / repeated imports are safe) and DI-aware
 * (defaults to the process-wide registry, but accepts any `CompoundRegistry`).
 * Throws on a genuine registration failure so a malformed def surfaces loudly
 * instead of leaving the surface silently un-renderable.
 */
export function registerComposeCompounds(reg: CompoundRegistry = registry): void {
	for (const def of COMPOSE_COMPOUNDS) {
		if (reg.has(def.name)) continue;
		const result = reg.register(def);
		if (!result.ok) {
			throw new Error(`${def.name} failed registration: ${result.errors.join("; ")}`);
		}
	}
}

/**
 * The DIGNITY-TEST data — hand-authored, no agent.
 *
 * This module is the proof of Corollary 1: "No agent: hand-authored trees render
 * through the same grammar, algebra, and tokens — Morphe must stand as a good
 * design system before any model touches it, and a human authoring trees by hand
 * should find it pleasant." Everything here is DATA: a Node tree, a compound
 * definition registered through the factory, and a second dialect.
 *
 * The whole file lives under src/routes/ (authored/demo space). It touches the
 * library through its PUBLIC barrel only and never reaches into the core — an
 * authored tree references INTENTS and ROLES, never a scale or a raw value. That
 * is exactly what makes the dialect toggle a Lemma-3 fixed point: the SAME tree
 * below renders under both dialects with zero edits.
 */

import type { CompoundDef, Node } from "$morphe";
import { registry } from "$morphe";

/* ===========================================================================
 * 1. A COMPOUND, as DATA (Lemma 1 — algebraic closure).
 *
 * `CatalogueEntry` is the recurring shape of an archive record: a raised panel
 * with an accession line (folio code + a "catalogued" status), a record title,
 * a provenance caption, and a `body` Slot the call site fills (notes, badges,
 * sub-records — anything). It is `createCompoundComponent` lifted from code to
 * DATA:
 *   - ParamRef leaves are HYGIENIC — they resolve only against THIS compound's
 *     own args (folio / title / provenance), never the call site;
 *   - the `body` Slot fills from the call site's `slots.body`.
 *
 * `folio` is a string param (coerced to a Text node by the expander); `title`
 * and `provenance` are NODE params, so the call site authors them as Text nodes
 * and keeps full control of their register (`as` / `intent`) while staying
 * hygienic. Registering the compound runs the validation gate (expand with
 * default args, grammar type-check, acyclicity, depth bound). A failing compound
 * is simply not added — render stays total.
 * ========================================================================= */

export const CatalogueEntry: CompoundDef = {
	name: "CatalogueEntry",
	version: "1.0.0",
	grammarVersion: "0.1.0",
	params: {
		type: "object",
		properties: {
			folio: { type: "string", required: true, description: "Accession / folio code." },
			title: { type: "node", required: true, description: "Record title (a Text node)." },
			provenance: {
				type: "node",
				default: { kind: "text", value: "Provenance unrecorded.", as: "caption", emphasis: "muted" },
				description: "Provenance / date caption (a Text node).",
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
					// Accession line: folio code (left) + a "catalogued" status (right).
					{
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
									{
										kind: "icon",
										name: "folder_open",
										a11y: { role: "decorative" },
										intent: "accession",
									},
									// folio code: a hygienic ParamRef -> coerced to a Text node.
									{ kind: "param-ref", param: "folio" },
								],
							},
							{
								kind: "status",
								tone: "neutral",
								signal: { text: "Catalogued", icon: "verified" },
							},
						],
					},
					// Title + provenance: NODE ParamRefs spliced in with the call site's
					// chosen register.
					{ kind: "param-ref", param: "title" },
					{ kind: "param-ref", param: "provenance" },
					{ kind: "spacer", size: "xs" },
					// The call site fills the body.
					{
						kind: "slot",
						name: "body",
						fallback: [{ kind: "text", value: "No notes on file.", as: "caption", emphasis: "muted" }],
					},
				],
			},
		],
	},
};

/**
 * Register the demo compound through the factory gate. Guarded so HMR / repeated
 * imports don't error on a duplicate name; we assert the first registration
 * succeeded so an authoring mistake surfaces loudly instead of silently.
 */
export function registerDemoCompounds(): void {
	if (registry.has(CatalogueEntry.name)) return;
	const result = registry.register(CatalogueEntry);
	if (!result.ok) {
		throw new Error(`CatalogueEntry failed registration: ${result.errors.join("; ")}`);
	}
}

/* ===========================================================================
 * 2. THE SECOND DIALECT — now promoted to the library.
 *
 * `reykjavik-registry` used to be defined inline here. It now lives in the
 * library (`$morphe` → `dialects/reykjavik-registry.ts`) and is registered in
 * the global dialect registry, so the demo sources it from the registry like any
 * other shipped dialect rather than owning it locally. The fixed-point claim is
 * unchanged: toggling to it re-themes the page without touching the authored tree.
 * ========================================================================= */

/* ===========================================================================
 * 3. THE AUTHORED TREE — read top-to-bottom, hand-written, pleasant by hand.
 *
 * An archive accession sheet: a masthead, a two-up catalogue of CatalogueEntry
 * compounds (each with a filled body), an intake form (Field + Select + Range +
 * Toggle, all a11y-required), a feedback band (Status / InlineAlert / Progress),
 * and a colophon. The SAME tree is what re-themes under the dialect toggle.
 * ========================================================================= */

export const dignityTree: Node = {
	kind: "frame",
	role: "page",
	surface: "base",
	budget: 4,
	children: [
		// --- Masthead -------------------------------------------------------
		{
			kind: "stack",
			role: "section",
			direction: "block",
			emphasis: "strong",
			children: [
				{
					kind: "cluster",
					role: "toolbar",
					justify: "between",
					align: "baseline",
					children: [
						{ kind: "text", value: "Skjalasafn", as: "caption", intent: "accession" },
						{ kind: "text", value: "Fol. MMXXVI · 07", as: "caption", emphasis: "muted" },
					],
				},
				{ kind: "text", value: "The Accession Sheet", as: "display", emphasis: "strong" },
				{
					kind: "text",
					value:
						"A hand-authored record tree, rendered through Morphe's grammar, context algebra, and three-layer tokens — no agent in the loop. The unexamined workflow is not worth automating.",
					as: "body",
					emphasis: "muted",
				},
				{
					kind: "cluster",
					role: "inline",
					align: "center",
					children: [
						{ kind: "badge", label: "Svelte 5", intent: "provenance", icon: "bolt" },
						{ kind: "badge", label: "Hand-authored", intent: "accession", icon: "edit_note" },
						{ kind: "badge", label: "Corollary 1", intent: "success", icon: "check_circle" },
					],
				},
			],
		},

		{ kind: "spacer", size: "md" },

		// --- Catalogue: two CatalogueEntry compounds, bodies filled ---------
		{
			kind: "stack",
			role: "section",
			direction: "block",
			children: [
				{ kind: "text", value: "Catalogue", as: "heading" },
				{
					kind: "grid",
					role: "list",
					minTrack: "regular",
					children: [
						{
							kind: "compound",
							name: "CatalogueEntry",
							args: {
								folio: "AM 132 fol.",
								title: { kind: "text", value: "Möðruvallabók", as: "subheading", intent: "accession" },
								provenance: {
									kind: "text",
									value: "Provenance: Möðruvellir, Hörgárdalur · c. 1330–1370",
									as: "caption",
									emphasis: "muted",
								},
							},
							slots: {
								body: [
									{
										kind: "text",
										value:
											"The largest surviving medieval compendium of Icelandic family sagas. Eleven sagas, one hand, one vellum.",
										as: "body",
									},
									{
										kind: "cluster",
										role: "inline",
										align: "center",
										children: [
											{ kind: "badge", label: "Vellum", intent: "provenance" },
											{ kind: "badge", label: "11 sagas", intent: "neutral" },
										],
									},
								],
							},
						},
						{
							kind: "compound",
							name: "CatalogueEntry",
							args: {
								folio: "GKS 2365 4to",
								title: { kind: "text", value: "Codex Regius", as: "subheading", intent: "accession" },
								provenance: {
									kind: "text",
									value: "Provenance: acquired 1662 · Brynjólfur Sveinsson",
									as: "caption",
									emphasis: "muted",
								},
							},
							slots: {
								body: [
									{
										kind: "text",
										value:
											"The sole source for most of the Poetic Edda. Returned to Iceland in 1971 aboard the Vædderen, under naval escort.",
										as: "body",
									},
									{
										kind: "status",
										tone: "info",
										signal: { text: "Digitisation pending", icon: "hourglass_top" },
									},
								],
							},
						},
					],
				},
			],
		},

		{ kind: "spacer", size: "md" },

		// --- Intake form: every input a11y-required -------------------------
		{
			kind: "frame",
			role: "panel",
			surface: "sunken",
			children: [
				{
					kind: "stack",
					role: "form",
					direction: "block",
					children: [
						{ kind: "text", value: "Request access", as: "subheading" },
						{
							kind: "text",
							value: "Reading-room requests are reviewed by the duty registrar.",
							as: "caption",
							emphasis: "muted",
						},
						{
							kind: "field",
							a11y: {
								id: "intake-name",
								label: { mode: "visible", text: "Researcher name" },
								required: true,
							},
							inputType: "text",
							placeholder: "e.g. Hákon Freyr",
							hint: "As it appears on your institutional credential.",
						},
						{
							kind: "field",
							a11y: {
								id: "intake-email",
								label: { mode: "visible", text: "Contact email" },
								required: true,
							},
							inputType: "email",
							placeholder: "name@institution.is",
						},
						{
							kind: "select",
							a11y: {
								id: "intake-collection",
								label: { mode: "visible", text: "Collection" },
								required: true,
							},
							options: [
								{ value: "manuscripts", label: "Manuscripts (fol.)" },
								{ value: "charters", label: "Charters & diplomas" },
								{ value: "maps", label: "Maps & sea-charts" },
								{ value: "restricted", label: "Restricted — registrar approval", disabled: true },
							],
							hint: "Restricted holdings require separate clearance.",
						},
						{
							kind: "range",
							a11y: {
								id: "intake-days",
								label: { mode: "visible", text: "Requested reading days" },
							},
							min: 1,
							max: 14,
							step: 1,
							hint: "Reading-room sittings, 1–14 days.",
						},
						{
							kind: "toggle",
							a11y: {
								id: "intake-handling",
								label: { mode: "visible", text: "I have completed handling training" },
								required: true,
							},
							hint: "Required for direct contact with vellum originals.",
						},
					],
				},
			],
		},

		{ kind: "spacer", size: "md" },

		// --- Feedback band ---------------------------------------------------
		{
			kind: "stack",
			role: "section",
			direction: "block",
			children: [
				{ kind: "text", value: "Reading-room status", as: "heading" },
				{
					kind: "grid",
					role: "list",
					minTrack: "narrow",
					children: [
						{
							kind: "status",
							tone: "success",
							signal: { text: "Reading room open", icon: "lock_open" },
						},
						{
							kind: "status",
							tone: "caution",
							signal: { text: "Conservation lab closed today", icon: "construction" },
						},
						{
							kind: "status",
							tone: "info",
							signal: { text: "3 requests ahead of yours", icon: "groups" },
						},
					],
				},
				{
					kind: "inline-alert",
					tone: "info",
					title: "Climate hold in effect",
					detail:
						"Vellum originals are released only when the room holds 18 °C and 50% RH. Digital surrogates remain available.",
					live: "polite",
				},
				{
					kind: "progress",
					value: 0.62,
					label: "Digitisation of the Árni Magnússon collection",
					intent: "provenance",
				},
			],
		},

		{ kind: "spacer", size: "md" },

		// --- Colophon --------------------------------------------------------
		{
			kind: "frame",
			role: "panel",
			surface: "raised",
			children: [
				{
					kind: "stack",
					role: "panel",
					direction: "block",
					children: [
						{ kind: "text", value: "Colophon", as: "subheading", intent: "accession" },
						{
							kind: "text",
							value:
								"Composed by hand as a Node tree, set in Newsreader, Hanken Grotesk and IBM Plex Mono. Rendered total through Morphe — Phase 0 keystone. The same tree above re-themes under a second dialect without a single node changed.",
							as: "body",
							emphasis: "muted",
						},
						{
							kind: "cluster",
							role: "inline",
							justify: "between",
							align: "baseline",
							children: [
								{ kind: "text", value: "Morphe · μορφή", as: "caption", intent: "accession" },
								{ kind: "text", value: "Reykjavík · MMXXVI", as: "caption", emphasis: "muted" },
							],
						},
					],
				},
			],
		},
	],
};

/**
 * Neutral Morphe playground data.
 *
 * Everything exported here is authored data: one compound definition and one
 * Node tree. The Svelte host provides live choices, actions, and a store.
 */

import type { CompoundDef, Node } from "$lib";
import { PROMOTED_COMPOUNDS, registry } from "$lib";

const promotedSignalCard = PROMOTED_COMPOUNDS.find(
	(definition) => definition.name === "SignalCard",
);
if (!promotedSignalCard) throw new Error("Generated promoted catalog is missing SignalCard.");
export const SignalCard: CompoundDef = promotedSignalCard;

export function registerDemoCompounds(): void {
	if (!registry.has(SignalCard.name)) {
		throw new Error("Generated SignalCard was not registered by the package runtime.");
	}
}

export const dignityTree: Node = {
	kind: "frame",
	role: "page",
	surface: "base",
	budget: 4,
	children: [
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
						{ kind: "text", value: "Morphe Workbench", as: "caption", intent: "accession" },
						{ kind: "text", value: "grammar v0.1", as: "caption", emphasis: "muted" },
					],
				},
				{
					kind: "text",
					value: "A complete interface, authored as data",
					as: "display",
					emphasis: "strong",
				},
				{
					kind: "text",
					value:
						"One tree exercises layout, content, media, input, feedback, action, overlay, compound, bind, and vary surfaces through the public renderer.",
					as: "body",
					emphasis: "muted",
				},
				{
					kind: "cluster",
					role: "inline",
					align: "center",
					children: [
						{ kind: "badge", label: "Node grammar", intent: "provenance", icon: "account_tree" },
						{ kind: "badge", label: "Dialect safe", intent: "accession", icon: "palette" },
						{ kind: "badge", label: "Bound controls", intent: "evidence", icon: "input" },
						{ kind: "badge", label: "Action ids", intent: "success", icon: "bolt" },
					],
				},
			],
		},

		{ kind: "spacer", size: "md" },

		{
			kind: "grid",
			role: "list",
			minTrack: "regular",
			children: [
				{
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: {
							kind: "text",
							value: "context",
							as: "caption",
							intent: "provenance",
						},
						title: { kind: "text", value: "Algebra budget", as: "subheading" },
						measure: {
							kind: "number",
							value: 4,
							format: "integer",
							intent: "accession",
							emphasis: "strong",
						},
					},
					slots: {
						body: [
							{
								kind: "text",
								value:
									"Frames re-root context, surface, scale, and emphasis budget; children inherit the new local rules.",
								as: "body",
								emphasis: "muted",
							},
						],
					},
				},
				{
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: {
							kind: "text",
							value: "tokens",
							as: "caption",
							intent: "evidence",
						},
						title: { kind: "text", value: "Intent channels", as: "subheading" },
						measure: {
							kind: "number",
							value: 8,
							format: "integer",
							intent: "evidence",
							emphasis: "strong",
						},
					},
					slots: {
						body: [
							{
								kind: "text",
								value:
									"Authored nodes name semantic intents; dialects remap the intent layer without changing the tree.",
								as: "body",
								emphasis: "muted",
							},
						],
					},
				},
				{
					kind: "compound",
					name: "SignalCard",
					args: {
						kicker: {
							kind: "text",
							value: "state",
							as: "caption",
							intent: "success",
						},
						title: { kind: "text", value: "Tier-1 commits", as: "subheading" },
						measure: {
							kind: "number",
							value: 32,
							format: "integer",
							intent: "success",
							emphasis: "strong",
						},
					},
					slots: {
						body: [
							{
								kind: "text",
								value:
									"Bound primitives write through a root-provided store and keep a bounded recent-event window.",
								as: "body",
								emphasis: "muted",
							},
						],
					},
				},
			],
		},

		{ kind: "spacer", size: "md" },

		// The promoted EntityHeader — the detail-pane lede. Authored as data (its
		// string fields ride as call-site nodes, never interpolated params) and
		// re-themed by every shipped dialect, including the restricted `clinical`.
		{
			kind: "compound",
			name: "EntityHeader",
			args: {
				kicker: { kind: "text", value: "Detail pane", as: "caption", intent: "folio" },
				title: { kind: "text", value: "Vestfjörður roster", as: "heading" },
				keyFigure: {
					kind: "number",
					value: 2_450_000,
					format: "currency",
					currency: "ISK",
					intent: "evidence",
					emphasis: "strong",
				},
			},
			slots: {
				signal: [{ kind: "status", tone: "success", signal: { text: "Active" } }],
				meta: [
					{
						kind: "grid",
						role: "field-group",
						columns: ["content", "flexible"],
						children: [
							{ kind: "text", value: "Window", as: "caption", intent: "neutral" },
							{ kind: "text", value: "2026-W29", as: "body" },
							{ kind: "text", value: "Coverage", as: "caption", intent: "neutral" },
							{ kind: "text", value: "18 of 24 shifts", as: "body" },
						],
					},
				],
				provenance: [
					{ kind: "text", value: "roster:westfjords:2026-W29", as: "body", intent: "provenance" },
				],
			},
		},

		{ kind: "spacer", size: "md" },

		// The promoted StatBand — the KPI band. The band owns the auto-fit narrow-track
		// grid that wraps its tiles; the SignalCard tiles ride the single `tiles` slot.
		// Re-themed by every shipped dialect, including the restricted `clinical`.
		{
			kind: "compound",
			name: "StatBand",
			args: {},
			slots: {
				tiles: [
					{
						kind: "compound",
						name: "SignalCard",
						args: {
							kicker: { kind: "text", value: "Treasury", as: "caption", intent: "folio" },
							title: { kind: "text", value: "Net position", as: "subheading" },
							measure: {
								kind: "number",
								value: 2_450_000,
								format: "currency",
								currency: "ISK",
								intent: "evidence",
								emphasis: "strong",
							},
						},
						slots: { body: [] },
					},
					{
						kind: "compound",
						name: "SignalCard",
						args: {
							kicker: { kind: "text", value: "Route", as: "caption", intent: "folio" },
							title: { kind: "text", value: "Rail", as: "subheading" },
							measure: { kind: "text", value: "bank_batch", as: "body", emphasis: "strong" },
						},
						slots: { body: [] },
					},
				],
			},
		},

		{ kind: "spacer", size: "md" },

		// The promoted Breakdown — labeled proportion rows. Each row is a label +
		// progress + value cluster the presenter builds; the rows ride the `rows` slot.
		// Re-themed by every shipped dialect, including the restricted `clinical`.
		{
			kind: "compound",
			name: "Breakdown",
			args: { title: { kind: "text", value: "Allocation", as: "heading" } },
			slots: {
				rows: [
					{
						kind: "cluster",
						role: "inline",
						align: "baseline",
						children: [
							{ kind: "text", value: "Research", as: "caption", intent: "neutral" },
							{ kind: "progress", label: "Research", value: 0.2857142857142857 },
							{ kind: "number", value: 100_000, format: "currency", currency: "ISK" },
						],
					},
					{
						kind: "cluster",
						role: "inline",
						align: "baseline",
						children: [
							{ kind: "text", value: "Operations", as: "caption", intent: "neutral" },
							{ kind: "progress", label: "Operations", value: 0.5714285714285714 },
							{ kind: "number", value: 200_000, format: "currency", currency: "ISK" },
						],
					},
					{
						kind: "cluster",
						role: "inline",
						align: "baseline",
						children: [
							{ kind: "text", value: "Reserve", as: "caption", intent: "neutral" },
							{ kind: "progress", label: "Reserve", value: 0.14285714285714285 },
							{ kind: "number", value: 50_000, format: "currency", currency: "ISK" },
						],
					},
				],
			},
		},

		{ kind: "spacer", size: "md" },

		{
			kind: "grid",
			role: "section",
			minTrack: "regular",
			children: [
				{
					kind: "frame",
					role: "panel",
					surface: "sunken",
					children: [
						{
							kind: "stack",
							role: "form",
							children: [
								{ kind: "text", value: "Bound input surface", as: "heading" },
								{
									kind: "field",
									a11y: {
										id: "demo-goal",
										label: { mode: "visible", text: "Interface goal" },
										required: true,
									},
									inputType: "text",
									bind: "demo.goal",
									placeholder: "Review an exception queue",
									hint: "Committed on native change through the Morphe store.",
								},
								{
									kind: "field",
									a11y: {
										id: "demo-notes",
										label: { mode: "visible", text: "Operator note" },
									},
									multiline: true,
									rows: 3,
									bind: "demo.note",
									placeholder: "Keep the explanation short and evidence-led.",
									hint: "Multiline is a capability of Field, not a separate primitive.",
								},
								{
									kind: "select",
									a11y: {
										id: "demo-mode",
										label: { mode: "visible", text: "Review mode" },
									},
									options: [
										{ value: "triage", label: "Triage" },
										{ value: "approval", label: "Approval" },
										{ value: "audit", label: "Audit trail" },
									],
									bind: "demo.mode",
									variant: "radiogroup",
								},
								{
									kind: "range",
									a11y: {
										id: "demo-density",
										label: { mode: "visible", text: "Detail level" },
									},
									min: 1,
									max: 5,
									step: 1,
									bind: "demo.detail",
								},
								{
									kind: "toggle",
									a11y: {
										id: "demo-reviewed",
										label: { mode: "visible", text: "Mark panel reviewed" },
									},
									bind: "demo.reviewed",
									variant: "switch",
								},
							],
						},
					],
				},
				{
					kind: "stack",
					role: "section",
					children: [
						{
							kind: "media",
							src: "/images/demo/signal-map.svg",
							alt: "A neutral signal map with branching paths and annotated interface panels.",
							aspect: "video",
							width: 1280,
							height: 720,
						},
						{
							kind: "vary",
							id: "demo.mode",
							default: 0,
							objective: "salience",
							options: [
								{
									kind: "frame",
									role: "panel",
									surface: "raised",
									children: [
										{
											kind: "stack",
											role: "panel",
											children: [
												{ kind: "badge", label: "mode 1", intent: "provenance" },
												{ kind: "text", value: "Compact triage", as: "heading" },
												{
													kind: "text",
													value:
														"The variation picks a short, scannable surface when the goal is quick sorting.",
													as: "body",
													emphasis: "muted",
												},
											],
										},
									],
								},
								{
									kind: "frame",
									role: "panel",
									surface: "raised",
									children: [
										{
											kind: "stack",
											role: "panel",
											children: [
												{ kind: "badge", label: "mode 2", intent: "evidence" },
												{ kind: "text", value: "Evidence review", as: "heading" },
												{
													kind: "text",
													value:
														"The same slot can widen into evidence, diagnostics, and status without leaving the grammar.",
													as: "body",
													emphasis: "muted",
												},
											],
										},
									],
								},
								{
									kind: "frame",
									role: "panel",
									surface: "raised",
									children: [
										{
											kind: "stack",
											role: "panel",
											children: [
												{ kind: "badge", label: "mode 3", intent: "success" },
												{ kind: "text", value: "Decision close", as: "heading" },
												{
													kind: "text",
													value:
														"Actions stay declarative: buttons name host-owned action ids, not handlers.",
													as: "body",
													emphasis: "muted",
												},
											],
										},
									],
								},
							],
						},
						{
							kind: "cluster",
							role: "toolbar",
							align: "center",
							children: [
								{
									kind: "button",
									label: "Rotate mode",
									action: "demo.rotate",
									icon: "sync",
								},
								{
									kind: "button",
									label: "Record review",
									variant: "outline",
									intent: "success",
									action: "demo.review",
									icon: "done",
								},
							],
						},
					],
				},
			],
		},

		{ kind: "spacer", size: "md" },

		{
			kind: "stack",
			role: "section",
			children: [
				{ kind: "text", value: "Feedback and disclosure", as: "heading" },
				{
					kind: "grid",
					role: "list",
					minTrack: "narrow",
					children: [
						{
							kind: "status",
							tone: "success",
							signal: { text: "Grammar resolved", icon: "check_circle" },
						},
						{ kind: "status", tone: "info", signal: { text: "Store connected", icon: "database" } },
						{ kind: "status", tone: "caution", signal: { text: "Fallback active", icon: "info" } },
					],
				},
				{
					kind: "inline-alert",
					tone: "info",
					title: "Render remains total",
					detail:
						"Unknown actions, missing CMS files, and unavailable sidecars degrade to visible fallback states instead of breaking the tree.",
					live: "polite",
				},
				{
					kind: "progress",
					value: 0.84,
					label: "Surface coverage in this demo",
					intent: "evidence",
				},
				{
					kind: "disclosure",
					summary: "Primitive inventory",
					children: [
						{
							kind: "cluster",
							role: "inline",
							children: [
								{ kind: "badge", label: "Frame" },
								{ kind: "badge", label: "Stack" },
								{ kind: "badge", label: "Grid" },
								{ kind: "badge", label: "Cluster" },
								{ kind: "badge", label: "Media" },
								{ kind: "badge", label: "Field" },
								{ kind: "badge", label: "Select" },
								{ kind: "badge", label: "Range" },
								{ kind: "badge", label: "Toggle" },
								{ kind: "badge", label: "Status" },
								{ kind: "badge", label: "Alert" },
								{ kind: "badge", label: "Button" },
								{ kind: "badge", label: "Link" },
								{ kind: "badge", label: "Vary" },
								{ kind: "badge", label: "Compound" },
							],
						},
					],
				},
			],
		},
	],
};

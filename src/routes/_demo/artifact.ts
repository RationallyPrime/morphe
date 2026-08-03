import type { Node } from "$lib";

export const DEMO_ARTIFACT_ID = "capability-page.demo";
export const DEMO_PUBLICATION_SLUG = "demo";
export const DEMO_REVISION_ID = "rev-001";
export const DEMO_DIALECT_ID = "ledger";

export const demoArtifactTree: Node = {
	kind: "frame",
	role: "page",
	surface: "base",
	budget: 3,
	children: [
		{
			kind: "stack",
			role: "section",
			children: [
				{ kind: "badge", label: "cms fixture", intent: "provenance", icon: "schema" },
				{ kind: "text", value: "Published as data", as: "display", emphasis: "strong" },
				{
					kind: "text",
					value:
						"This neutral artifact is the built-in fallback for the CMS preview and publication routes. A real compiled tree on disk replaces it without changing the route contract.",
					as: "body",
					emphasis: "muted",
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
					kind: "frame",
					role: "panel",
					surface: "raised",
					children: [
						{
							kind: "stack",
							role: "panel",
							children: [
								{ kind: "text", value: "Validated tree", as: "heading" },
								{
									kind: "text",
									value:
										"Compiled JSON crosses the boundary as a Morphe Node, then renders through the package grammar and dialect layer.",
									as: "body",
									emphasis: "muted",
								},
								{
									kind: "status",
									tone: "success",
									signal: { text: "Schema gate passed", icon: "check_circle" },
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
								{ kind: "text", value: "Stable pointer", as: "heading" },
								{
									kind: "text",
									value:
										"Publication is pointer movement: the public slug resolves to one compiled revision and the renderer stays total.",
									as: "body",
									emphasis: "muted",
								},
								{ kind: "progress", value: 1, label: "Publication readiness", intent: "success" },
							],
						},
					],
				},
			],
		},
		{
			kind: "compound",
			name: "ActionSummary",
			args: {
				eyebrow: { kind: "text", value: "Preview host", as: "caption", intent: "accession" },
				title: { kind: "text", value: "Runtime sockets stay outside the artifact", as: "heading" },
				summary: {
					kind: "text",
					value: "The compiled tree carries ids; this preview route owns their temporary handlers.",
					as: "body",
				},
			},
			slots: {
				signal: [{ kind: "status", tone: "success", signal: { text: "Catalog valid" } }],
				context: [
					{
						kind: "vary",
						id: "preview.mode",
						default: 0,
						objective: "salience",
						options: [
							{ kind: "text", value: "Authored branch", as: "body" },
							{ kind: "text", value: "Host-selected branch", as: "body" },
						],
					},
				],
				action: [
					{
						kind: "button",
						label: "Record preview action",
						action: "preview_record",
						intent: "primary-action",
					},
				],
				detail: [
					{
						kind: "within",
						id: "preview.detail",
						dimension: "collapse",
						range: [0, 1],
						default: 0,
						summary: "Inspect preview authority",
						target: {
							kind: "text",
							value: "Actions are receipts in preview, never production side effects.",
							as: "caption",
							intent: "aside",
						},
					},
				],
			},
		},
	],
};

export function isDemoPreview(artifactId: string, revisionId: string): boolean {
	return artifactId === DEMO_ARTIFACT_ID && revisionId === DEMO_REVISION_ID;
}

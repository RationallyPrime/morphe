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
	],
};

export function isDemoPreview(artifactId: string, revisionId: string): boolean {
	return artifactId === DEMO_ARTIFACT_ID && revisionId === DEMO_REVISION_ID;
}

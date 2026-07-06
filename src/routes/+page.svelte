<script lang="ts">
	import type { Node } from "$lib";
	import { MorpheRoot } from "$lib/components";

	const overview: Node = {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 3,
		children: [
			{
				kind: "grid",
				role: "section",
				minTrack: "regular",
				children: [
					{
						kind: "stack",
						role: "section",
						direction: "block",
						emphasis: "strong",
						children: [
							{ kind: "badge", label: "substrate", intent: "provenance", icon: "deployed_code" },
							{
								kind: "text",
								value: "A typed adaptive-interface workbench",
								as: "display",
								emphasis: "strong",
							},
							{
								kind: "text",
								value:
									"Morphe renders interface intent as data: grammar, context algebra, token strata, dialects, actions, bindings, variation choices, and CMS-published trees.",
								as: "body",
								emphasis: "muted",
							},
							{
								kind: "cluster",
								role: "inline",
								align: "center",
								children: [
									{ kind: "link", href: "/substrate", label: "Open the playground" },
									{ kind: "link", href: "/preview/capability-page.demo/rev-001", label: "Preview artifact" },
									{ kind: "link", href: "/p/demo", label: "Published artifact" },
								],
							},
						],
					},
					{
						kind: "media",
						src: "/images/demo/interface-lab.svg",
						alt: "A neutral abstract interface map made of panels, token channels, and branching state paths.",
						aspect: "square",
						width: 960,
						height: 960,
						eager: true,
					},
				],
			},
		],
	};

	const surfaces: Node = {
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
							{ kind: "badge", label: "runtime", intent: "evidence", icon: "route" },
							{ kind: "text", value: "Playground", as: "heading" },
							{
								kind: "text",
								value:
									"One hand-authored tree exercises primitives, compounds, dialect switching, actions, bound inputs, and variation choices.",
								as: "body",
								emphasis: "muted",
							},
							{ kind: "link", href: "/substrate", label: "Launch playground" },
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
							{ kind: "badge", label: "cms", intent: "accession", icon: "verified" },
							{ kind: "text", value: "Compiled Preview", as: "heading" },
							{
								kind: "text",
								value:
									"The preview route renders validated CMS tree artifacts through the same public Morphe renderer.",
								as: "body",
								emphasis: "muted",
							},
							{
								kind: "link",
								href: "/preview/capability-page.demo/rev-001",
								label: "Open preview",
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
							{ kind: "badge", label: "publication", intent: "success", icon: "public" },
							{ kind: "text", value: "Published Pointer", as: "heading" },
							{
								kind: "text",
								value:
									"The public route follows a publication pointer to a compiled revision, with a built-in neutral fixture for this demo.",
								as: "body",
								emphasis: "muted",
							},
							{ kind: "link", href: "/p/demo", label: "Open publication" },
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
							{ kind: "badge", label: "media", intent: "info", icon: "image" },
							{ kind: "text", value: "Plate Proof", as: "heading" },
							{
								kind: "text",
								value:
									"One Timaeus plate exercises responsive sources, explicit dimensions, and the stable fallback path.",
								as: "body",
								emphasis: "muted",
							},
							{ kind: "link", href: "/plate-proof", label: "Open plate proof" },
						],
					},
				],
			},
		],
	};
</script>

<svelte:head>
	<title>Morphe Workbench</title>
	<meta
		name="description"
		content="A neutral Morphe workbench for the adaptive UI substrate, CMS preview, publication routes, and dialect playground."
	/>
</svelte:head>

<section class="workbench workbench--hero">
	<div class="workbench__inner">
		<MorpheRoot tree={overview} />
	</div>
</section>

<section class="workbench">
	<div class="workbench__inner">
		<MorpheRoot tree={surfaces} />
	</div>
</section>

<style>
	.workbench {
		padding: clamp(var(--mo-space-6), 7vw, var(--mo-space-9))
			clamp(var(--mo-space-4), 5vw, var(--mo-space-8));
	}
	.workbench--hero {
		padding-block-start: clamp(var(--mo-space-7), 9vw, var(--mo-space-10));
	}
	.workbench__inner {
		max-inline-size: 78rem;
		margin-inline: auto;
	}
	.workbench :global(.mo-root) {
		background: transparent;
	}
</style>

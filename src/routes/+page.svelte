<script lang="ts">
	/*
	 * Phase-0 keystone smoke page: a hand-authored tree rendered through the core.
	 * This is the Corollary 1 "dignity test" in miniature — a human authoring a
	 * tree by hand, no agent, no compound, rendering through grammar + algebra +
	 * tokens + the default dialect.
	 */

	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import type { Node } from "$morphe/grammar/types.js";

	const tree: Node = {
		kind: "frame",
		role: "page",
		surface: "base",
		children: [
			{
				kind: "stack",
				role: "section",
				direction: "block",
				children: [
					{ kind: "text", value: "Morphe", as: "display", emphasis: "strong" },
					{
						kind: "text",
						value: "Stratified adaptive UI — Phase 0 keystone.",
						as: "body",
						emphasis: "muted",
					},
					{
						kind: "cluster",
						role: "inline",
						children: [
							{ kind: "badge", label: "Svelte 5", intent: "provenance" },
							{ kind: "badge", label: "Icelandic Archive", intent: "accession", icon: "archive" },
						],
					},
					{
						kind: "status",
						tone: "success",
						signal: { text: "Renderer total", icon: "check_circle" },
					},
					{
						kind: "field",
						a11y: {
							id: "demo-name",
							label: { mode: "visible", text: "Name" },
							required: true,
						},
						placeholder: "e.g. Hákon",
						hint: "The keystone proves a11y is a required field.",
					},
				],
			},
		],
	};
</script>

<main>
	<MorpheRoot {tree} />
</main>

<style>
	main {
		max-width: 1280px;
		margin-inline: auto;
		padding: 3rem 1.5rem;
	}
</style>

<script lang="ts">
	/*
	 * /onboarding — the guided intake flow. A Morphe intro tree frames it; the flow
	 * itself is a native control surface ($lib/site/Onboarding). Reachable from the
	 * marketing CTAs and the nav.
	 */
	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import { registerSiteCompounds } from "$lib/site";
	import type { Node } from "$morphe";
	import Onboarding from "$lib/site/Onboarding.svelte";

	registerSiteCompounds();

	const intro: Node = {
		kind: "compound",
		name: "SiteHero",
		args: {
			eyebrow: { kind: "text", value: "Onboarding", as: "caption", intent: "accession" },
			title: { kind: "text", value: "Tell us what runs your operation.", as: "display", emphasis: "strong" },
			lede: {
				kind: "text",
				value:
					"A few minutes now sharpens the first conversation. The more you tell us about your systems and where the cross-system work hurts, the more concrete Sókrates can be. Your draft saves as you go, so you can stop and come back.",
				as: "body",
				emphasis: "muted",
			},
		},
	};
</script>

<svelte:head>
	<title>Onboarding — Sókrates</title>
	<meta
		name="description"
		content="Tell us what runs your operation: your systems, the workflows that hurt, and what good would look like. A guided intake that saves as you go."
	/>
</svelte:head>

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={intro} />
	</div>
</section>

<section class="s-section recessed">
	<div class="s-wrap--wide">
		<Onboarding />
	</div>
</section>

<style>
	.recessed {
		background: var(--mo-intent-surface-sunken);
	}
	.recessed :global(.mo-root) {
		background: transparent;
	}
</style>

<script lang="ts">
	/*
	 * /substrate — the engine, demoted from /. The whole marketing site is rendered
	 * through Morphe; this page exposes the substrate itself: one hand-authored Node
	 * tree, re-themed live by the dialect toggle, with no agent in the loop (the
	 * Corollary-1 dignity test). A short native intro frames why it is here, then the
	 * demo carries the proof.
	 */
	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import { registerSiteCompounds } from "$lib/site";
	import type { Node } from "$morphe";
	import CtaLink from "$lib/site/CtaLink.svelte";
	import DignityDemo from "../_demo/DignityDemo.svelte";

	// Registers SiteHero (and the rest) through the factory gate, so the intro tree's
	// `name: "SiteHero"` resolves.
	registerSiteCompounds();

	const intro: Node = {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			eyebrow: { kind: "text", value: "Built on Morphe", as: "caption", intent: "accession" },
			title: { kind: "text", value: "The whole site is data.", as: "display", emphasis: "strong" },
			lede: {
				kind: "text",
				value:
					"Every surface you have seen is a typed Node tree rendered through one grammar, one context algebra and one token system. Flip the dialect below and watch the same tree re-theme without a single node changing. That fixed point is the substrate Sókrates renders through.",
				as: "body",
				emphasis: "muted",
			},
		},
	};
</script>

<svelte:head>
	<title>The substrate — Sókrates · Morphe</title>
	<meta
		name="description"
		content="The Morphe substrate the Sókrates site is rendered through: one hand-authored Node tree, re-themed live by a dialect toggle, no agent in the loop."
	/>
</svelte:head>

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={intro} />
		<div class="s-cta-row">
			<CtaLink href="/" label="Back to the composer" variant="secondary" />
		</div>
	</div>
</section>

<div class="s-wrap--wide substrate-demo">
	<DignityDemo />
</div>

<style>
	/* The demo owns its own inner padding; just cap and center it like a work surface. */
	.substrate-demo {
		padding-inline: clamp(1rem, 4vw, 2.5rem);
	}
</style>

<script lang="ts">
	/*
	 * /architecture — the deep cut. Third-person structural voice, the Greek lexicon
	 * (Hyle / Eidos / Demiurge / Aition) and the four-agent core. For the technical
	 * influencer who gates on architecture.
	 */
	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import { registerSiteCompounds, architectureHero, architectureBody, closingCta } from "$lib/site";
	import CtaLink from "$lib/site/CtaLink.svelte";

	registerSiteCompounds();

	const heroTree = architectureHero();
	const bodyTree = architectureBody();
	const ctaTree = closingCta();
</script>

<svelte:head>
	<title>Architecture — Sókrates</title>
	<meta
		name="description"
		content="Five primitives, one typed hypergraph, a signed envelope on every act. Hyle, Eidos, Demiurge, Aition, and the four-agent core, in third-person structural detail."
	/>
</svelte:head>

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={heroTree} />
		<div class="s-cta-row">
			<CtaLink href="/" label="See it compose" variant="primary" />
			<CtaLink href="/how-it-works" label="How it works" variant="secondary" />
		</div>
		<p class="s-proof">Read-side discovery always on. Write-side action only under a current envelope.</p>
	</div>
</section>

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={bodyTree} />
	</div>
</section>

<section class="s-section recessed">
	<div class="s-wrap">
		<MorpheRoot tree={ctaTree} />
		<div class="s-cta-row">
			<CtaLink href="/#contact" label="Start the conversation" variant="primary" />
			<CtaLink href="/onboarding" label="Begin onboarding" variant="secondary" />
		</div>
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

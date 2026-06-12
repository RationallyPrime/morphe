<script lang="ts">
	/*
	 * /architecture — the deep cut. Third-person structural voice, the Greek lexicon
	 * (Hyle / Eidos / Demiurge / Aition) and the four-agent core. For the technical
	 * influencer who gates on architecture.
	 */
	import { MorpheRoot } from "$lib/components";
	import { architectureBody, architectureHero, closingCta, registerSiteCompounds } from "$site";
	import CtaLink from "$site/CtaLink.svelte";

	registerSiteCompounds();

	const heroTree = architectureHero();
	const bodyTree = architectureBody();
	const ctaTree = closingCta();
</script>

<svelte:head>
	<title>Architecture — Sókrates</title>
	<meta
		name="description"
		content="Five primitives, one typed hypergraph, one authority record for every act. Hyle, Eidos, Demiurge, Aition, and the four-agent core, in third-person structural detail."
	/>
</svelte:head>

<section class="s-section s-hero">
	<div class="s-wrap s-hero__grid">
		<div class="s-hero__copy">
			<MorpheRoot tree={heroTree} />
			<div class="s-cta-row">
				<CtaLink href="/" label="See what it can do" variant="primary" />
				<CtaLink href="/how-it-works" label="How it works" variant="secondary" />
			</div>
			<p class="s-proof">Evidence first. Action only with current authority.</p>
		</div>
		<figure class="s-hero__seal" aria-hidden="true">
			<img class="s-hero__seal-img" src="/images/sokrates-mark.svg" alt="" width="220" height="220" />
		</figure>
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
			<CtaLink href="/#contact" label="Talk to us" variant="primary" />
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

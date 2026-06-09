<script lang="ts">
	/*
	 * /how-it-works — the grounding + governance explainer. Editorial copy authored
	 * as Morphe trees; the conversion CTAs are native.
	 */
	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import { registerSiteCompounds, howItWorksHero, howItWorksBody, closingCta } from "$lib/site";
	import CtaLink from "$lib/site/CtaLink.svelte";

	registerSiteCompounds();

	const heroTree = howItWorksHero();
	const bodyTree = howItWorksBody();
	const ctaTree = closingCta();
</script>

<svelte:head>
	<title>How it works — Sókrates</title>
	<meta
		name="description"
		content="Sókrates compiles your systems into one typed map, answers with cited evidence, and acts only under a signed envelope you authorise. On-premises, exit-symmetric."
	/>
</svelte:head>

<section class="s-section s-hero">
	<div class="s-wrap s-hero__grid s-hero__grid--flip">
		<div class="s-hero__copy">
			<MorpheRoot tree={heroTree} />
			<div class="s-cta-row">
				<CtaLink href="/" label="See what it can do" variant="primary" />
				<CtaLink href="/#contact" label="Talk to us" variant="secondary" />
			</div>
			<p class="s-proof">Finance and operations first. The rest of the back office as the map grows.</p>
		</div>
		<figure class="s-plate s-hero__plate">
			<img
				class="s-plate__img"
				src="/images/the-box.png"
				alt="The Sókrates appliance on a wooden desk, the philosopher mark etched into the lid."
				width="512"
				height="512"
				decoding="async"
			/>
			<figcaption class="s-plate__cap">One appliance, compiling the systems you already run into a map you can question.</figcaption>
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

<script lang="ts">
	/*
	 * /how-it-works — the Timaeus narrative (KRA-327): the operating lifecycle
	 * told as nine plates in two acts. Editorial copy authored as Morphe trees;
	 * the conversion CTAs are native.
	 *
	 * The page is pinned to the `timaeus` dialect PER-SURFACE: an explicit
	 * `dialect` prop on each MorpheRoot (never a global-store override), so the
	 * rest of the site stays on the visitor's active dialect while the story
	 * renders in the world its figures are drawn in. The wrapper div re-themes
	 * the NATIVE chrome (section grounds, CTAs) the same way +layout.svelte
	 * themes the shell — same vars, one boundary further in.
	 */
	import { applyDialect, dialectStyle, getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { closingCta, howItWorksBody, howItWorksHero, registerSiteCompounds } from "$site";
	import CtaLink from "$site/CtaLink.svelte";

	registerSiteCompounds();

	const timaeus = getDialect("timaeus");
	const timaeusStyle = dialectStyle(applyDialect(timaeus));

	const heroTree = howItWorksHero();
	const bodyTree = howItWorksBody();
	const ctaTree = closingCta();
</script>

<svelte:head>
	<title>How it works — Sókrates</title>
	<meta
		name="description"
		content="The Sókrates operating lifecycle in nine plates: boot on-premises, bind the sources, the authoring loop that never stops sharpening, and authorized work that runs to done."
	/>
</svelte:head>

<div class="timaeus-scope" data-mo-dialect="timaeus" style={timaeusStyle}>
	<!-- A copy-only overture: the plates themselves start one scroll below (B1 is
	     the eager LCP image), so the hero carries no figure — the constellation
	     ground and the cobalt register already say which world this page is. -->
	<section class="s-section s-hero">
		<div class="s-wrap">
			<div class="s-hero__copy">
				<MorpheRoot tree={heroTree} dialect={timaeus} />
				<div class="s-cta-row">
					<CtaLink href="/" label="See what it can do" variant="primary" />
					<CtaLink href="/#contact" label="Talk to us" variant="secondary" />
				</div>
				<p class="s-proof">Two acts. Nine plates. The whole lifecycle on the record.</p>
			</div>
		</div>
	</section>

	<section class="s-section">
		<div class="s-wrap">
			<MorpheRoot tree={bodyTree} dialect={timaeus} />
		</div>
	</section>

	<section class="s-section recessed">
		<div class="s-wrap">
			<MorpheRoot tree={ctaTree} dialect={timaeus} />
			<div class="s-cta-row">
				<CtaLink href="/#contact" label="Talk to us" variant="primary" />
				<CtaLink href="/onboarding" label="Begin onboarding" variant="secondary" />
			</div>
		</div>
	</section>
</div>

<style>
	/* The page ground rides the timaeus surface vars set on the wrapper — the
	   native sections and the Morphe trees share one constellation darkness. */
	.timaeus-scope {
		background: var(--mo-intent-surface-base);
	}
	.recessed {
		background: var(--mo-intent-surface-sunken);
	}
	.recessed :global(.mo-root) {
		background: transparent;
	}
</style>

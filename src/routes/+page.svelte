<script lang="ts">
/*
 * / — the Sókrates home. A marketing landing whose interactive centerpiece is the
 * capability composer. Editorial copy is authored as Morphe Node trees (rendered
 * through MorpheRoot under the active dialect); the conversion CTAs, the composer
 * and the contact form are native control surfaces sitting beside those trees.
 */

import Composer from "$lib/compose/Composer.svelte";
import {
	closingCta,
	contactLead,
	homeBody,
	homeHero,
	registerSiteCompounds,
} from "$lib/site";
import ContactForm from "$lib/site/ContactForm.svelte";
import CtaLink from "$lib/site/CtaLink.svelte";
import MorpheRoot from "$morphe/render/MorpheRoot.svelte";

// Register the site compounds through the factory gate. Idempotent.
registerSiteCompounds();

const heroTree = homeHero();
const bodyTree = homeBody();
const contactTree = contactLead();
const ctaTree = closingCta();
</script>

<svelte:head>
	<title>Sókrates — Your AI Department</title>
	<meta
		name="description"
		content="Software waits for instructions. Sókrates looks for friction. An on-premises AI department that runs the cross-system operational work, under governance you control."
	/>
</svelte:head>

<!-- Hero — an asymmetric archive plate: copy hung off the left axis, the appliance
     as the dominant artifact on the right (no more dead space, and the page's one
     photograph leads instead of hiding below the fold). -->
<section class="s-section s-hero">
	<div class="s-wrap s-hero__grid">
		<div class="s-hero__copy">
			<MorpheRoot tree={heroTree} />
			<div class="s-cta-row">
				<CtaLink href="/#contact" label="Start the conversation" variant="primary" />
				<CtaLink href="/onboarding" label="Begin onboarding" variant="secondary" />
			</div>
			<p class="s-proof">On-premises · Read-only until you authorise · Clean exit, no fees</p>
		</div>
		<figure class="s-plate s-hero__plate">
			<img
				class="s-plate__img"
				src="/images/the-box.png"
				alt="The Sókrates appliance: a matte-black on-premises box with the philosopher mark etched into the lid, on a wooden desk."
				width="512"
				height="512"
				fetchpriority="high"
				decoding="async"
			/>
			<figcaption class="s-plate__cap">The department, in a box. On your premises, behind your firewall.</figcaption>
		</figure>
	</div>
</section>

<!-- The composer — the interactive centerpiece (a recessed work surface). -->
<section class="s-section recessed" id="composer">
	<div class="s-wrap--wide">
		<Composer />
	</div>
</section>

<!-- The argument: differentiators, the box, the governance ladder. -->
<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={bodyTree} />
	</div>
</section>

<!-- Contact — the front door (a recessed work surface). -->
<section class="s-section recessed" id="contact">
	<div class="s-wrap">
		<MorpheRoot tree={contactTree} />
		<div class="contact__form">
			<ContactForm />
		</div>
	</div>
</section>

<!-- Closing CTA. -->
<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={ctaTree} />
		<div class="s-cta-row">
			<CtaLink href="/#contact" label="Start the conversation" variant="primary" />
			<CtaLink href="/onboarding" label="Begin onboarding" variant="secondary" />
		</div>
	</div>
</section>

<style>
	/*
	 * A recessed band: the section paints the sunken surface, and the Morphe roots
	 * inside drop their own base paint so the band shows through. The raised inputs
	 * and the outlined results well then read as lifted off the recess.
	 */
	.recessed {
		background: var(--mo-intent-surface-sunken);
	}
	.recessed :global(.mo-root) {
		background: transparent;
	}
	.contact__form {
		margin-block-start: var(--mo-space-6);
	}
</style>

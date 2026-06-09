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

<!--
  The composer — the interactive CENTERPIECE, given a distinct work-surface
  treatment so it reads as the demonstration it is, not as one more editorial
  band. It runs on the wide (105rem) application cap, the recessed surface marks
  it as a place you DO something, and a single deliberate kicker ("Try it") above
  the heading invites the act of composing. This is the one kicker on the page,
  and it carries real information: this surface is interactive.
-->
<section class="s-section recessed s-work" id="composer">
	<div class="s-wrap--wide">
		<p class="s-work__kicker">Try it · live, read-only</p>
		<Composer />
	</div>
</section>

<!-- The argument: differentiators, the sovereignty beat, the governance ladder. -->
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

<!--
  Closing CTA — an asymmetric close: the copy + conversion CTAs hung off the
  left axis, the Sókrates mark beside them as a faint archival SEAL (the page's
  second committed artifact — the "signed seal" motif belongs at the close, where
  you sign). Not the box plate again; DESIGN §8 keeps one appliance photograph
  per page, so the mark, not the box, carries the imagery here.
-->
<section class="s-section">
	<div class="s-wrap s-close__grid">
		<div class="s-close__copy">
			<MorpheRoot tree={ctaTree} />
			<div class="s-cta-row">
				<CtaLink href="/#contact" label="Start the conversation" variant="primary" />
				<CtaLink href="/onboarding" label="Begin onboarding" variant="secondary" />
			</div>
		</div>
		<div class="s-close__seal" aria-hidden="true">
			<img class="s-close__seal-img" src="/images/sokrates-mark.svg" alt="" width="320" height="320" decoding="async" />
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

	/*
	 * The composer WORK SURFACE. The recess already marks it as a place you act;
	 * the kicker is the page's one deliberate mono label (it carries real
	 * information — this surface is interactive and read-only), set off above the
	 * composer with a hairline amber index tick, echoing the archive-plate motif.
	 */
	.s-work__kicker {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-3);
		margin: 0 0 var(--mo-space-5);
		padding-inline-start: var(--mo-space-4);
		position: relative;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
	}
	.s-work__kicker::before {
		content: "";
		position: absolute;
		inset-inline-start: 0;
		inset-block: 0.1em;
		inline-size: 2px;
		background: var(--mo-intent-primary-action-surface);
	}

	/*
	 * The CLOSING band — an asymmetric split: the copy + CTAs own the dominant
	 * left track, the Sókrates mark sits as a faint archival seal in the minor
	 * right track. Single column on narrow (the seal drops below the copy); the
	 * off-centre split engages once there is room to read both.
	 */
	.s-close__grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: clamp(var(--mo-space-7), 6vw, var(--mo-space-9));
		align-items: center;
	}
	.s-close__copy {
		min-inline-size: 0;
	}
	.s-close__seal {
		display: flex;
		justify-content: center;
	}
	.s-close__seal-img {
		inline-size: clamp(7rem, 16vw, 14rem);
		block-size: auto;
		opacity: 0.14;
		/* Tonal, never a loud graphic: the mark is a watermark-grade presence. */
		filter: grayscale(0.2);
	}
	@media (min-width: 60rem) {
		.s-close__grid {
			/* Off-centre: copy owns the dominant track, the seal the minor one. */
			grid-template-columns: 1.3fr 0.7fr;
		}
		.s-close__seal {
			justify-self: end;
		}
	}
</style>

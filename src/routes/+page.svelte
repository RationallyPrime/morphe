<script lang="ts">
/*
 * / — the Sókrates home. A composer-first marketing landing: a brief intro hands
 * straight to the capability composer (the interactive centerpiece), and the
 * supporting editorial — proof, governance, sovereignty — sits below it as support,
 * not competition. Conversion is one path: the contact "conversation" at the close.
 * Editorial copy is authored as Morphe Node trees (rendered through MorpheRoot under
 * the active dialect); the composer, the onboarding link and the contact form are
 * native control surfaces sitting beside those trees.
 *
 * Beacon discipline (D1): exactly TWO ambers, in two non-co-visible folds — the
 * composer's submit (the composer fold) and the contact form's submit (the close).
 * The nav "Talk to us" and the onboarding link are deliberately NON-amber so nothing
 * else competes for the eye's one warm signal.
 */

import Composer from "$lib/compose/Composer.svelte";
import {
	closingCta,
	homeBody,
	homeHero,
	onboardingBand,
	registerSiteCompounds,
} from "$lib/site";
import ContactForm from "$lib/site/ContactForm.svelte";
import CtaLink from "$lib/site/CtaLink.svelte";
import MorpheRoot from "$morphe/render/MorpheRoot.svelte";

// Register the site compounds through the factory gate. Idempotent.
registerSiteCompounds();

const heroTree = homeHero();
const bodyTree = homeBody();
const onboardingTree = onboardingBand();
const ctaTree = closingCta();
</script>

<svelte:head>
	<title>Sókrates — Your AI Department</title>
	<meta
		name="description"
		content="Software waits for instructions. Sókrates looks for friction. An on-premises AI department that runs the cross-system operational work, under governance you control."
	/>
</svelte:head>

<!-- Intro — a brief ease-in: one display line + a single hand-off sentence on the
     left axis, the appliance plate on the right. No CTA, no proof line; the intro
     exists only to hand off to the composer below, which is the real top-fold
     action (WS1a — the editorial wall that used to bury the product is gone). -->
<section class="s-section">
	<div class="s-wrap s-hero__grid">
		<div class="s-hero__copy">
			<MorpheRoot tree={heroTree} />
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
  The composer — the interactive CENTERPIECE, the immediate second fold. It runs on
  the wide (105rem) application cap and a recessed work surface so it reads as a
  place you DO something, not one more editorial band. Its submit is amber beacon #1
  (D1). No kicker (DESIGN §9): the recess and the composer's own heading carry the
  "this is interactive" signal without a label.
-->
<section class="s-section recessed" id="composer">
	<div class="s-wrap--wide">
		<Composer />
	</div>
</section>

<!-- The support — proof, the governance ladder, the sovereignty beat. Subordinate to
     the composer by width (the editorial 80rem cap) and surface (base, not the
     composer's recessed work surface). WS1b. -->
<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={bodyTree} />
	</div>
</section>

<!-- Onboarding — its own prominent near-close fold (D1), high-emphasis but NON-amber:
     the structured-intake path, kept distinct from the conversational close. The CTA
     is the quiet (secondary) variant on purpose, so amber stays exclusive to the
     composer and the contact conversation. -->
<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={onboardingTree} />
		<div class="s-cta-row">
			<CtaLink href="/onboarding" label="Begin onboarding" variant="secondary" />
		</div>
	</div>
</section>

<!--
  The close — the one conversion path (#contact). An asymmetric band: the closing
  copy + the contact form hung off the left axis, the Sókrates mark beside them as a
  faint archival SEAL (the "signed seal" motif belongs at the close, where you sign).
  The contact form's own submit is amber beacon #2 — the sole conversion beacon,
  "Talk to us" (the retired "Start the conversation" label is gone). The recessed
  band lets the form's raised inputs read as lifted off the surface.
-->
<section class="s-section recessed" id="contact">
	<div class="s-wrap s-close__grid">
		<div class="s-close__copy">
			<MorpheRoot tree={ctaTree} />
			<div class="contact__form">
				<ContactForm />
			</div>
			<p class="s-proof">On-premises · Read-only until you authorise · Clean exit, no fees</p>
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
	 * The CLOSING band — an asymmetric split: the copy + form own the dominant left
	 * track, the Sókrates mark sits as a faint archival seal in the minor right
	 * track. Single column on narrow (the seal drops below the copy); the off-centre
	 * split engages once there is room to read both.
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

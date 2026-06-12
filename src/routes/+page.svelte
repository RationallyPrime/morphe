<script lang="ts">
/*
 * / — the Sókrates home as a stage: a brief statement hands straight to the
 * capability composer, then the page offers only the few paths a visitor naturally
 * needs next. Editorial copy is authored as Morphe Node trees; the composer,
 * links and contact form are native control surfaces sitting beside those trees.
 *
 * Beacon discipline (D1): exactly TWO primary-action beacons, in two non-co-visible
 * folds — the composer's submit (the composer fold) and the contact form's submit
 * (the close). The nav "Talk to us" and the onboarding link are deliberately
 * non-beacon so nothing else competes for the eye's one strong signal.
 */

import { untrack } from "svelte";
import { page } from "$app/state";
import Composer from "$compose/Composer.svelte";
import { MorpheRoot } from "$lib/components";
import {
	closingCta,
	homeHero,
	homeIntentStageEnvelope,
	intentEngine,
	registerSiteCompounds,
	registerSiteIntents,
	resolveArrivalIntent,
} from "$site";
import ContactForm from "$site/ContactForm.svelte";
import IntentChips from "$site/IntentChips.svelte";
import IntentPalette from "$site/IntentPalette.svelte";

// Register the site compounds through the factory gate. Idempotent.
registerSiteCompounds();

const heroTree = homeHero();
const ctaTree = closingCta();
const stageEnvelope = homeIntentStageEnvelope();

// Register the gated vocabulary before arrival resolution (idempotent; the
// chips/palette register too, but this page must not depend on child order).
registerSiteIntents();

$effect(() => {
	intentEngine.setStage(stageEnvelope);
	// ARRIVAL INTENT (KRA-376): a valid `?intent=` landing param opens its
	// stage morph through the same execute() path the chips ride. The URL
	// read is untrack'd, so this applies ONCE on arrival (the layout's
	// `?cohort=` idiom) and never fights a later chip click. SSR renders the
	// default branch; resolution is client-only by $effect discipline.
	const arrival = resolveArrivalIntent(untrack(() => page.url.searchParams.get("intent")));
	if (arrival !== null) intentEngine.execute(arrival);
	return () => intentEngine.setStage(null);
});
</script>

<svelte:head>
	<title>Sókrates — Your AI Department</title>
	<meta
		name="description"
		content="Software waits for instructions. Sókrates looks for friction. An on-premises AI department for the cross-system work that keeps landing on one senior person."
	/>
</svelte:head>

<!-- Intro — a brief ease-in: one display line + a single hand-off sentence on the
     left axis, the appliance plate on the right. No CTA, no proof line; the intro
     exists only to hand off to the composer below, which is the real top-fold
     action (WS1a — the editorial wall that used to bury the product is gone). -->
<section class="s-section s-section--hero">
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
			<figcaption class="s-plate__cap">The department, in a box. A physical appliance for the work between systems.</figcaption>
		</figure>
	</div>
</section>

<!--
  The composer — the interactive CENTERPIECE, the immediate second fold. It runs on
  the wide (105rem) application cap and a recessed work surface so it reads as a
  place you DO something, not one more editorial band. Its submit is beacon #1
  (D1). No kicker (DESIGN §9): the recess and the composer's own heading carry the
  "this is interactive" signal without a label.
-->
<section class="s-section recessed" id="composer">
	<div class="s-wrap--wide">
		<Composer />
	</div>
</section>

<!--
  The intent row — the engine's primary affordance (ADR-0006 §2, KRA-355). Every
  chip is a real anchor to canonical content (no-JS ground truth); with JS, a
  morphing intent reshapes the page in place through the same engine path the
  Cmd/Ctrl+K palette rides. The stage's DEFAULT branch is the standing plates
  tease, so "Tell me the story" transforms that surface into the nine beats in
  place (no stacked duplicate), and closing a story puts the tease back.
-->
<section class="s-section s-section--tight">
	<div class="s-wrap">
		<IntentChips />
		<div class="intent-stage">
			<MorpheRoot tree={stageEnvelope.tree} choices={intentEngine.choices ?? stageEnvelope.choices} />
		</div>
	</div>
</section>

<IntentPalette />

<!--
  The close — the one conversion path (#contact). An asymmetric band: the closing
  copy + the contact form hung off the left axis, the Sókrates mark beside them as a
  faint archival SEAL (the "signed seal" motif belongs at the close, where you sign).
  The contact form's own submit is beacon #2 — the sole conversion beacon,
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
			<p class="s-whisper">
				<a href="mailto:hakon@sokrates.is">hakon@sokrates.is</a>
				<span>Krates ehf., Reykjavík</span>
				<span>© 2026</span>
			</p>
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
	.s-whisper a {
		color: var(--mo-intent-on-surface);
		text-decoration: underline;
		text-underline-offset: 0.22em;
	}
	.s-whisper a:hover {
		color: var(--mo-intent-accession-on);
	}
	.s-whisper a:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
		border-radius: var(--mo-radius-1);
	}
	.s-whisper {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-2) var(--mo-space-4);
		margin: var(--mo-space-5) 0 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
	}
	.intent-stage {
		margin-block-start: var(--mo-space-5);
	}
	.intent-stage :global(.mo-root) {
		background: transparent;
	}
	/* The vitrine mat for stage PLATES (ADR-0005, KRA-359): dark artwork sits
	   in a dark well and glows against whatever ground is active — the same
	   treatment as the hero's box render. On night the well merges. Scoped to
	   plate assets: the team portraits in the identity morph are photographs,
	   not self-luminous artwork, and take no mat. */
	.intent-stage :global(.mo-media:has(img[src^="/images/plates/"])) {
		background: var(--mo-cobalt-950);
		padding: var(--mo-space-4);
		border-radius: var(--mo-radius-3);
	}
	.intent-stage :global(.mo-media img) {
		border-radius: var(--mo-radius-2);
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

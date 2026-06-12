<script lang="ts">
/*
 * Nav — the site chrome's top bar. Native (outside any Morphe tree), styled from
 * the `--mo-*` tokens so it follows the active dialect. Deliberately minimal (D2):
 * brand mark + wordmark on the left, a single QUIET, non-amber "Talk to us" on the
 * right. No link row, no burger — the footer already carries every route, and a
 * five-link bar is too much chrome for a one-conversation landing. The CTA is the
 * `secondary` (outline) variant on purpose: amber stays exclusive to the composer's
 * Compose and the close conversion beacon, so the always-visible nav CTA never
 * collides with the composer's amber when both are on screen.
 */

import CtaLink from "./CtaLink.svelte";
</script>

<header class="nav">
	<div class="nav__inner">
		<a class="brand" href="/" aria-label="Sókrates — home">
			<img class="brand__mark" src="/images/sokrates-mark.svg" alt="" width="32" height="32" aria-hidden="true" />
			<span class="brand__word">Sókrates</span>
		</a>

		<CtaLink href="/#contact" label="Talk to us" variant="secondary" />
	</div>
</header>

<style>
	.nav {
		position: sticky;
		top: 0;
		z-index: 50;
		background: var(--mo-intent-surface-base);
		/* Quiet bottom hairline — chrome separation, not content sectioning. */
		border-block-end: 1px solid color-mix(in srgb, var(--mo-intent-outline) 60%, transparent);
	}
	.nav__inner {
		max-inline-size: 1800px;
		margin-inline: auto;
		padding: var(--mo-space-3) clamp(1rem, 4vw, 2.5rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--mo-space-5);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-3);
		text-decoration: none;
		flex: none;
	}
	.brand__mark {
		inline-size: 2rem;
		block-size: 2rem;
		display: block;
	}
	.brand__word {
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-5);
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--mo-intent-on-surface);
	}
</style>

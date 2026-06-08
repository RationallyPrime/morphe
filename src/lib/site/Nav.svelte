<script lang="ts">
/*
 * Nav — the site chrome's top bar. Native (outside any Morphe tree), styled from
 * the `--mo-*` tokens so it follows the active dialect. Brand mark + wordmark on
 * the left, the page links and the primary CTA on the right. Active link is
 * derived from the current pathname. On narrow viewports the links collapse into
 * a disclosure menu (a real $state toggle, closed on navigation).
 */

import { afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import CtaLink from "./CtaLink.svelte";

const LINKS: readonly { href: string; label: string }[] = [
	{ href: "/", label: "Composer" },
	{ href: "/how-it-works", label: "How it works" },
	{ href: "/architecture", label: "Architecture" },
	{ href: "/onboarding", label: "Onboarding" },
	{ href: "/substrate", label: "Substrate" },
];

let open = $state(false);

// A link is current when the path matches exactly ("/" is exact; the rest match
// their own segment so a nested path still highlights its section).
function isActive(href: string, pathname: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}

// Close the mobile menu after any navigation completes.
afterNavigate(() => {
	open = false;
});
</script>

<header class="nav">
	<div class="nav__inner">
		<a class="brand" href="/" aria-label="Sókrates — home">
			<img class="brand__mark" src="/images/sokrates-mark.svg" alt="" width="32" height="32" aria-hidden="true" />
			<span class="brand__word">Sókrates</span>
		</a>

		<nav class="links" aria-label="Primary" data-open={open}>
			{#each LINKS as l (l.href)}
				<a
					class="links__link"
					href={l.href}
					data-active={isActive(l.href, page.url.pathname)}
					aria-current={isActive(l.href, page.url.pathname) ? "page" : undefined}
				>
					{l.label}
				</a>
			{/each}
			<div class="links__cta">
				<CtaLink href="/#contact" label="Talk to us" variant="primary" />
			</div>
		</nav>

		<button
			class="burger"
			type="button"
			aria-expanded={open}
			aria-controls="nav-links"
			aria-label={open ? "Close menu" : "Open menu"}
			onclick={() => (open = !open)}
		>
			<span class="burger__glyph material-symbols-outlined" aria-hidden="true">{open ? "close" : "menu"}</span>
		</button>
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

	.links {
		display: flex;
		align-items: center;
		gap: var(--mo-space-2);
	}
	.links__link {
		padding: var(--mo-space-2) var(--mo-space-3);
		border-radius: var(--mo-radius-2);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 500;
		text-decoration: none;
		color: var(--mo-intent-on-surface-muted);
		transition: color 0.16s ease;
	}
	.links__link:hover {
		color: var(--mo-intent-on-surface);
	}
	.links__link[data-active="true"] {
		color: var(--mo-intent-accession-on);
	}
	.links__link:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.links__cta {
		margin-inline-start: var(--mo-space-3);
	}

	.burger {
		display: none;
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--mo-intent-on-surface);
		cursor: pointer;
		padding: var(--mo-space-2);
		border-radius: var(--mo-radius-2);
		line-height: 0;
	}
	.burger:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.burger__glyph {
		font-size: 1.75rem;
	}

	/* Mobile: collapse the links into a disclosure panel under the bar. */
	@media (max-width: 60rem) {
		.burger {
			display: inline-flex;
		}
		.links {
			position: absolute;
			inset-inline: 0;
			top: 100%;
			flex-direction: column;
			align-items: stretch;
			gap: var(--mo-space-1);
			padding: var(--mo-space-4) clamp(1rem, 4vw, 2.5rem) var(--mo-space-5);
			background: var(--mo-intent-surface-raised);
			border-block-end: 1px solid color-mix(in srgb, var(--mo-intent-outline) 60%, transparent);
			display: none;
		}
		.links[data-open="true"] {
			display: flex;
		}
		.links__link {
			padding: var(--mo-space-3) var(--mo-space-3);
			font-size: var(--mo-type-4);
		}
		.links__cta {
			margin-inline-start: 0;
			margin-block-start: var(--mo-space-2);
		}
	}
</style>

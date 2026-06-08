<script lang="ts">
/*
 * Footer — site chrome, native, styled from the `--mo-*` tokens. Carries the
 * canon pull line, the page navigation, and the colophon. The "Built on Morphe"
 * link is the one route into the substrate demo for the curious.
 */
const COLUMNS: readonly {
	title: string;
	links: { href: string; label: string }[];
}[] = [
	{
		title: "Product",
		links: [
			{ href: "/", label: "Composer" },
			{ href: "/how-it-works", label: "How it works" },
			{ href: "/architecture", label: "Architecture" },
		],
	},
	{
		title: "Start",
		links: [
			{ href: "/#contact", label: "Talk to us" },
			{ href: "/onboarding", label: "Onboarding" },
			{ href: "/substrate", label: "Built on Morphe" },
		],
	},
];
</script>

<footer class="footer">
	<div class="footer__inner">
		<div class="footer__lead">
			<p class="footer__quote">The unexamined workflow is not worth automating.</p>
			<p class="footer__sub">The map is a function of the territory.</p>
		</div>

		<nav class="footer__nav" aria-label="Footer">
			{#each COLUMNS as col (col.title)}
				<div class="footer__col">
					<p class="footer__coltitle">{col.title}</p>
					{#each col.links as l (l.href)}
						<a class="footer__link" href={l.href}>{l.label}</a>
					{/each}
				</div>
			{/each}
		</nav>
	</div>

	<div class="footer__base">
		<span>© 2026 Krates ehf. Reykjavík, Iceland.</span>
		<span class="footer__addr">Köllunarklettsvegi 1, 104 Reykjavík</span>
	</div>
</footer>

<style>
	.footer {
		background: var(--mo-intent-surface-sunken);
		color: var(--mo-intent-on-surface-muted);
		margin-block-start: clamp(3rem, 8vw, 6rem);
	}
	.footer__inner {
		max-inline-size: 1800px;
		margin-inline: auto;
		padding: clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2.5rem) var(--mo-space-6);
		display: flex;
		flex-wrap: wrap;
		gap: clamp(2rem, 6vw, 5rem);
		justify-content: space-between;
	}

	.footer__lead {
		max-inline-size: 42ch;
	}
	.footer__quote {
		margin: 0;
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-6);
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--mo-intent-on-surface);
		text-wrap: balance;
	}
	.footer__sub {
		margin: var(--mo-space-3) 0 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-on-surface-muted);
	}

	.footer__nav {
		display: flex;
		gap: clamp(2rem, 6vw, 5rem);
	}
	.footer__col {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.footer__coltitle {
		margin: 0 0 var(--mo-space-1);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-accession-on);
	}
	.footer__link {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		text-decoration: none;
		color: var(--mo-intent-on-surface-muted);
		transition: color 0.16s ease;
	}
	.footer__link:hover {
		color: var(--mo-intent-on-surface);
	}
	.footer__link:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
		border-radius: var(--mo-radius-1);
	}

	.footer__base {
		max-inline-size: 1800px;
		margin-inline: auto;
		padding: var(--mo-space-5) clamp(1rem, 4vw, 2.5rem) clamp(2rem, 5vw, 3rem);
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-2) var(--mo-space-5);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		letter-spacing: 0.02em;
		color: color-mix(in srgb, var(--mo-intent-on-surface-muted) 80%, transparent);
	}
	.footer__addr {
		color: color-mix(in srgb, var(--mo-intent-on-surface-muted) 60%, transparent);
	}
</style>

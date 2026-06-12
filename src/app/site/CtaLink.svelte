<script lang="ts">
/*
 * CtaLink — a conversion CTA. A real `<a href>` (native navigation, middle-click,
 * cmd-click) styled with the system's `--mo-*` tokens. This is the native
 * "control surface" half of the marketing site: a prominent amber primary button
 * must NAVIGATE, and the grammar's Button is declarative while its Link is an
 * inline underlined anchor — so conversion CTAs live here, outside the Morphe
 * tree, exactly as the composer's submit button does. The `primary` variant is
 * the amber beacon, used sparingly (one per fold).
 */
interface Props {
	href: string;
	label: string;
	variant?: "primary" | "secondary";
	icon?: string;
}
let { href, label, variant = "primary", icon }: Props = $props();

// Absolute http(s) targets open in a new tab with the safety floor + an SR cue.
const external = $derived(/^https?:\/\//.test(href));
</script>

<a
	{href}
	class="cta"
	data-variant={variant}
	target={external ? "_blank" : undefined}
	rel={external ? "noopener noreferrer" : undefined}
>
	{#if icon}<span class="cta__icon material-symbols-outlined" aria-hidden="true">{icon}</span>{/if}
	<span class="cta__label">{label}</span>{#if external}<span class="cta__sr"> (opens in new tab)</span>{/if}
</a>

<style>
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-3) var(--mo-space-6);
		min-block-size: 2.75rem;
		border-radius: var(--mo-radius-3);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		font-weight: 600;
		line-height: 1;
		text-align: center;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		border: 1px solid transparent;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			border-color 0.16s ease;
	}
	/* primary = the amber beacon. */
	.cta[data-variant="primary"] {
		background: var(--mo-intent-primary-action-surface);
		color: var(--mo-intent-primary-action-on);
	}
	.cta[data-variant="primary"]:hover {
		background: var(--mo-intent-primary-action-hover);
	}
	.cta[data-variant="primary"]:active {
		background: var(--mo-intent-primary-action-active);
	}
	/* secondary = a quiet outline that does not compete with the beacon. */
	.cta[data-variant="secondary"] {
		background: transparent;
		color: var(--mo-intent-on-surface);
		border-color: var(--mo-intent-outline);
	}
	.cta[data-variant="secondary"]:hover {
		border-color: var(--mo-intent-accession-on);
	}
	.cta:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.cta__icon {
		font-size: 1.2em;
		line-height: 1;
		flex: none;
	}
	.cta__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.cta {
			transition: none;
		}
	}
</style>

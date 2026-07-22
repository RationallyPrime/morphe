<script lang="ts">
	/*
	 * Gloss — one self-explanation disclosure with two honest trigger paths.
	 *
	 * A term normally exposes a real button, so click/tap, Enter, and Space all
	 * reveal its plain-string explanation. The panel uses the native Popover API
	 * where available (top layer + Escape/light-dismiss); `hidden` is the total
	 * fallback for older browsers and the DOM test environment. A pane-level
	 * reveal flag switches this SAME component into its in-flow revealed state.
	 * Hover is deliberately irrelevant: touch and keyboard users lose nothing.
	 */

	import type { Snippet } from "svelte";
	import { useGlossReveal } from "./state.svelte.js";

	interface Props {
		/** The painted term, used to give the disclosure trigger a complete name. */
		label: string;
		/** Producer-authored plain text; no runtime glossary lookup exists. */
		gloss: string;
		/** Host override for native chrome outside a MorpheRoot context. */
		revealAll?: boolean;
		/** Contrast-guaranteed ink from a painted sibling; inherited by default. */
		ink?: string;
		/** Optional painted term. Interactive primitives paint their anchor first. */
		children?: Snippet;
	}

	let { label, gloss, revealAll, ink, children }: Props = $props();
	const inherited = useGlossReveal();
	const instanceId = $props.id();
	const panelId = `${instanceId}-panel`;
	const anchorName = `--${instanceId}-anchor`;

	let open = $state(false);
	let panel = $state<HTMLElement | null>(null);
	const globallyRevealed = $derived(revealAll ?? inherited?.current ?? false);

	$effect(() => {
		const element = panel;
		if (!element || globallyRevealed || typeof element.togglePopover !== "function") return;
		const shown = element.matches(":popover-open");
		if (open && !shown) element.showPopover();
		else if (!open && shown) element.hidePopover();
	});

	function toggle(): void {
		open = !open;
	}

	function onToggle(event: ToggleEvent): void {
		open = event.newState === "open";
	}
</script>

{#if children}<span class="mo-gloss__term">{@render children()}</span>{/if}
{#if globallyRevealed}
	<span id={panelId} class="mo-gloss__definition" role="note" data-revealed>
		<span class="mo-gloss__sr">Explanation for {label}: </span>{gloss}
	</span>
{:else}
	<button
		type="button"
		class="mo-gloss__trigger"
		aria-label={`Explain ${label}`}
		aria-controls={panelId}
		aria-expanded={open}
		onclick={toggle}
		style:color={ink}
		style:--mo-gloss-anchor={anchorName}
	>
		<span aria-hidden="true">?</span>
	</button>
	<span
		bind:this={panel}
		id={panelId}
		class="mo-gloss__popover"
		popover="auto"
		role="tooltip"
		aria-label={`Explanation for ${label}`}
		hidden={!open}
		ontoggle={onToggle}
		style:--mo-gloss-anchor={anchorName}
	>
		{gloss}
	</span>
{/if}

<style>
	.mo-gloss__term {
		display: inline;
	}

	.mo-gloss__trigger {
		display: inline-grid;
		place-items: center;
		min-inline-size: var(--mo-space-6);
		min-block-size: var(--mo-space-6);
		margin-inline-start: var(--mo-space-1);
		padding: 0;
		border: 1px solid currentColor;
		border-radius: 999rem;
		background: transparent;
		color: currentColor;
		font: 600 var(--mo-type-1) / 1 var(--mo-font-label);
		letter-spacing: normal;
		text-transform: none;
		white-space: normal;
		vertical-align: 0.1em;
		cursor: help;
		anchor-name: var(--mo-gloss-anchor);
	}

	.mo-gloss__trigger:hover {
		opacity: 1;
		background: color-mix(in srgb, currentColor 10%, transparent);
	}

	.mo-gloss__trigger:focus-visible {
		opacity: 1;
		outline: var(--mo-ring-width) solid var(--mo-intent-primary-action-ring);
		outline-offset: var(--mo-ring-offset);
	}

	.mo-gloss__popover {
		margin: var(--mo-space-2);
		inset: auto;
		inline-size: min(92vw, 24rem);
		padding: var(--mo-space-4);
		border: var(--mo-border-width) solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-overlay);
		color: var(--mo-intent-on-surface);
		font: var(--mo-type-3) / var(--mo-leading-normal) var(--mo-font-body);
		overflow-wrap: anywhere;
		position-anchor: var(--mo-gloss-anchor);
		position-area: block-end span-inline-end;
		position-try-fallbacks: block-start span-inline-end, block-end span-inline-start;
		opacity: 1;
		transition:
			opacity 120ms ease,
			overlay 120ms allow-discrete,
			display 120ms allow-discrete;
	}

	.mo-gloss__popover:not(:popover-open) {
		opacity: 0;
	}

	.mo-gloss__definition {
		display: inline;
		margin-inline-start: var(--mo-space-2);
		color: var(--mo-intent-on-surface-muted);
		font-family: var(--mo-font-body);
		font-size: 0.9em;
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
	}

	.mo-gloss__definition::before {
		content: "— ";
	}

	.mo-gloss__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	@media (forced-colors: active) {
		.mo-gloss__trigger {
			border-color: ButtonText;
		}
		.mo-gloss__trigger:focus-visible {
			outline-color: Highlight;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mo-gloss__popover {
			transition: none;
		}
	}
</style>

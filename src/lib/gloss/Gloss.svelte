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

{#if globallyRevealed}
	{#if children}<span class="mo-gloss__term">{@render children()}</span>{/if}
	<span id={panelId} class="mo-gloss__definition" role="note" data-revealed>
		<span class="mo-gloss__sr">Explanation for {label}: </span>{gloss}
	</span>
{:else}
	{#if children}
		<!-- The glossed term IS the trigger: a quiet dotted underline instead of
		     appended chrome, so a pane of glosses reads as typography, not as a
		     row of floating buttons. Inline-text targets take the WCAG 2.5.8
		     inline exception; the padding/margin pair still widens the hit area
		     without shifting layout. -->
		<button
			type="button"
			class="mo-gloss__trigger mo-gloss__trigger--term"
			aria-label={`Explain ${label}`}
			aria-controls={panelId}
			aria-expanded={open}
			onclick={toggle}
			style:color={ink}
			style:--mo-gloss-anchor={anchorName}
		>
			{@render children()}
		</button>
	{:else}
		<button
			type="button"
			class="mo-gloss__trigger mo-gloss__trigger--mark"
			aria-label={`Explain ${label}`}
			aria-controls={panelId}
			aria-expanded={open}
			onclick={toggle}
			style:color={ink}
			style:--mo-gloss-anchor={anchorName}
		>
			<span aria-hidden="true">?</span>
		</button>
	{/if}
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
		border: 0;
		background: transparent;
		color: currentColor;
		cursor: help;
		anchor-name: var(--mo-gloss-anchor);
	}

	/* Term trigger: inherit the term's own typography completely; the only added
	   signal is the dotted rule, solidified on hover. */
	.mo-gloss__trigger--term {
		display: inline;
		padding: 0.2em;
		margin: -0.2em;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		text-align: inherit;
		white-space: inherit;
		text-decoration-line: underline;
		text-decoration-style: dotted;
		text-decoration-thickness: 1px;
		text-decoration-color: color-mix(in srgb, currentColor 55%, transparent);
		text-underline-offset: 0.24em;
	}

	.mo-gloss__trigger--term:hover {
		text-decoration-style: solid;
		text-decoration-color: currentColor;
	}

	/* Mark trigger — for terms whose anchor is already interactive (Link, linked
	   Status): a small superscript mark, no ring chrome. Quietness comes from
	   the reduced size and dotted rule, NEVER from alpha — the ink it carries is
	   contrast-guaranteed and must stay at full opacity (contrast-a11y gate). */
	.mo-gloss__trigger--mark {
		display: inline-grid;
		place-items: center;
		padding: 0.3em;
		margin: -0.15em 0 -0.15em;
		margin-inline-start: 0.05em;
		font: 500 0.8em / 1 var(--mo-font-body);
		vertical-align: super;
		text-decoration-line: underline;
		text-decoration-style: dotted;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}

	.mo-gloss__trigger--mark:hover {
		text-decoration-style: solid;
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
		.mo-gloss__trigger--term,
		.mo-gloss__trigger--mark {
			text-decoration-color: ButtonText;
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

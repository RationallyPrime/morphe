<script lang="ts">

	/*
	 * Badge — a compact labelled chip carrying an intent (Content family leaf).
	 *
	 * Functional color is never the only signal: the badge's intent contributes
	 * surface/on color, but the always-present, color-independent signals are the
	 * label text itself (a non-color channel) and an optional shape `icon` — so no
	 * edge rule is needed (a colored side-stripe is a DESIGN §9 ban, and the label
	 * already carries the non-color signal it would duplicate).
	 *
	 * The badge consumes an intent only (no layout descent — it is a leaf); it
	 * references SLOTS via `slot()`, never an intent name welded into the markup or
	 * a raw scale. An unknown dialect intent degrades to the neutral fallback.
	 *
	 * Agent edits ONLY this file.
	 */

	import Gloss from "../../gloss/Gloss.svelte";
	import type { Badge } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Badge> = $props();

	const intent = $derived(node.intent ?? "neutral");
	/* Defensive fallbacks so an unknown dialect intent still renders legibly. */
	const surface = $derived(slot(intent, "surface", "var(--mo-intent-neutral-surface)"));
	const on = $derived(slot(intent, "on", "var(--mo-intent-on-surface)"));
</script>

<span class="mo-badge" style:background={surface} style:color={on}>
	{#if node.icon}
		<span class="mo-badge__icon material-symbols-outlined" aria-hidden="true">{node.icon}</span>
	{/if}
	<span class="mo-badge__label">
		{#if node.gloss}
			<Gloss label={node.label} gloss={node.gloss}>
				{#snippet children()}{node.label}{/snippet}
			</Gloss>
		{:else}
			{node.label}
		{/if}
	</span>
</span>

<style>
	.mo-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-1) var(--mo-space-3);
		border-radius: var(--mo-radius-2);
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		line-height: var(--mo-leading-tight);
		white-space: nowrap;
		vertical-align: middle;
	}
	.mo-badge__icon {
		font-size: 1.1em;
		line-height: 1;
		/* Optical alignment of the symbol with the cap height of the label. */
		margin-block-start: -0.05em;
	}
	.mo-badge__label {
		display: inline-block;
	}
</style>

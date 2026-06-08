<script lang="ts">
	/*
	 * Range — a bounded numeric slider. a11y is REQUIRED (InputA11y). tier-0 local
	 * state (Lemma 5).
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Range } from "../../grammar/types.js";

	let { node }: PrimitiveProps<Range> = $props();
	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const describedBy = $derived([a11y.describedBy, hintId].filter(Boolean).join(" ") || undefined);
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);

	// tier-0 local state (Lemma 5); seeded once from node.min at init.
	// svelte-ignore state_referenced_locally
	let value = $state(node.min);
</script>

<div class="mo-range">
	{#if a11y.label.mode === "visible"}
		<label class="mo-range__label" for={a11y.id}>{a11y.label.text}</label>
	{/if}
	<input
		id={a11y.id}
		class="mo-range__control"
		type="range"
		min={node.min}
		max={node.max}
		step={node.step ?? 1}
		bind:value
		required={a11y.required}
		aria-label={ariaLabel}
		aria-labelledby={ariaLabelledby}
		aria-describedby={describedBy}
		data-bind={node.bind}
	/>
	{#if node.hint}
		<p id={hintId} class="mo-range__hint">{node.hint}</p>
	{/if}
</div>

<style>
	.mo-range {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.mo-range__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-range__control {
		accent-color: var(--mo-intent-primary-action-surface);
	}
	.mo-range__control:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.mo-range__hint {
		margin: 0;
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
</style>

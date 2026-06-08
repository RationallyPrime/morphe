<script lang="ts">
	/*
	 * Toggle — a boolean switch. a11y is REQUIRED (InputA11y). State is
	 * component-owned (Lemma 5, tier-0); the wire carries a binding path, not a
	 * live value.
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Toggle } from "../../grammar/types.js";

	let { node }: PrimitiveProps<Toggle> = $props();
	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const describedBy = $derived([a11y.describedBy, hintId].filter(Boolean).join(" ") || undefined);
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);

	// tier-0 local state (Lemma 5): never leaves the component in Phase 0.
	let on = $state(false);
</script>

<div class="mo-toggle">
	<button
		id={a11y.id}
		type="button"
		class="mo-toggle__switch"
		role="switch"
		aria-checked={on}
		aria-required={a11y.required}
		aria-label={ariaLabel}
		aria-labelledby={ariaLabelledby}
		aria-describedby={describedBy}
		data-bind={node.bind}
		onclick={() => (on = !on)}
	>
		<span class="mo-toggle__thumb" data-on={on}></span>
	</button>
	{#if a11y.label.mode === "visible"}
		<label class="mo-toggle__label" for={a11y.id}>{a11y.label.text}</label>
	{/if}
	{#if node.hint}
		<p id={hintId} class="mo-toggle__hint">{node.hint}</p>
	{/if}
</div>

<style>
	.mo-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-3);
	}
	.mo-toggle__switch {
		inline-size: 2.5rem;
		block-size: 1.4rem;
		border-radius: var(--mo-radius-full);
		border: 1px solid var(--mo-intent-outline);
		background: var(--mo-intent-neutral-surface);
		padding: 2px;
		cursor: pointer;
	}
	.mo-toggle__switch:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.mo-toggle__thumb {
		display: block;
		inline-size: 1rem;
		block-size: 1rem;
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-on-surface-muted);
		transition: transform 0.15s ease;
	}
	.mo-toggle__thumb[data-on="true"] {
		transform: translateX(1.1rem);
		background: var(--mo-intent-primary-action-surface);
	}
	.mo-toggle__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-on-surface);
	}
	.mo-toggle__hint {
		margin: 0;
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
</style>

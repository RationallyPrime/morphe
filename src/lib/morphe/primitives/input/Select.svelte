<script lang="ts">
	/*
	 * Select — a single-choice list. a11y is REQUIRED (InputA11y).
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Select } from "../../grammar/types.js";

	let { node }: PrimitiveProps<Select> = $props();
	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const errorId = $derived(node.error ? `${a11y.id}-error` : undefined);
	const describedBy = $derived(
		[a11y.describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined,
	);
	const invalid = $derived(Boolean(node.error));
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);
</script>

<div class="mo-select">
	{#if a11y.label.mode === "visible"}
		<label class="mo-select__label" for={a11y.id}>{a11y.label.text}</label>
	{/if}
	<select
		id={a11y.id}
		class="mo-select__control"
		required={a11y.required}
		aria-required={a11y.required}
		aria-invalid={invalid}
		aria-label={ariaLabel}
		aria-labelledby={ariaLabelledby}
		aria-describedby={describedBy}
		data-bind={node.bind}
	>
		{#each node.options as opt (opt.value)}
			<option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
		{/each}
	</select>
	{#if node.hint}
		<p id={hintId} class="mo-select__hint">{node.hint}</p>
	{/if}
	{#if node.error}
		<p id={errorId} class="mo-select__error" role="alert">{node.error}</p>
	{/if}
</div>

<style>
	.mo-select {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.mo-select__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-select__control {
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-on-surface);
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3) var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
	}
	.mo-select__control:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.mo-select__hint {
		margin: 0;
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-select__error {
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-caution-on);
	}
</style>

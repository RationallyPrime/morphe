<script lang="ts">
	/*
	 * Field — a single-line text input. a11y is REQUIRED (InputA11y): the label
	 * relationship is wired into the DOM here; an unlabelled Field is impossible by
	 * the grammar type. Functional error color is paired with text (never alone).
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Field } from "../../grammar/types.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Field> = $props();
	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const errorId = $derived(node.error ? `${a11y.id}-error` : undefined);
	const describedBy = $derived(
		[a11y.describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined,
	);
	const invalid = $derived(Boolean(node.error));
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);
	const borderColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.border());
</script>

<div class="mo-field">
	{#if a11y.label.mode === "visible"}
		<label class="mo-field__label" for={a11y.id}>{a11y.label.text}</label>
	{/if}
	<input
		id={a11y.id}
		class="mo-field__input"
		type={node.inputType ?? "text"}
		placeholder={node.placeholder}
		required={a11y.required}
		aria-required={a11y.required}
		aria-invalid={invalid}
		aria-label={ariaLabel}
		aria-labelledby={ariaLabelledby}
		aria-describedby={describedBy}
		data-bind={node.bind}
		style:border-color={borderColor}
	/>
	{#if node.hint}
		<p id={hintId} class="mo-field__hint">{node.hint}</p>
	{/if}
	{#if node.error}
		<p id={errorId} class="mo-field__error" role="alert">{node.error}</p>
	{/if}
</div>

<style>
	.mo-field {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.mo-field__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-field__input {
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-on-surface);
		border: 0;
		border-bottom: 1px solid;
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-4) var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
	}
	.mo-field__input:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.mo-field__hint {
		margin: 0;
		font-family: var(--mo-font-body);
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-field__error {
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-caution-on);
	}
</style>

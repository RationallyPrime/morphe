<script lang="ts">
	/*
	 * Select — a single-choice list (a native <select>, so keyboard + AT support is
	 * the platform's, not re-implemented). A stateful provider (Lemma 5): the
	 * chosen value is tier-0, component-owned $state that never leaves the
	 * component; the wire carries only a `bind` store-path (data-bind).
	 *
	 * a11y is REQUIRED (InputA11y): the grammar makes an unlabelled Select
	 * unrepresentable. The error state pairs caution color with an alert message
	 * AND a shape (the error glyph + thicker rule), never color alone (WCAG 1.4.1).
	 *
	 * Continuous sizing rides the boundary vars (--mo-ctx-type/space); stateful
	 * chrome rides this component's --mo-select-* vars. Colors resolve through
	 * SLOTS -> intents -> scales; no raw scale or hex is named here.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Select } from "../../grammar/types.js";
	import { SLOTS } from "../../tokens/slots.js";

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

	const borderColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.border());
	const ringColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.ring());

	// tier-0 local state (Lemma 5): seed once from the first option, never leaves.
	// svelte-ignore state_referenced_locally
	let value = $state(node.options[0]?.value ?? "");
</script>

<div class="mo-select" data-invalid={invalid} style:--mo-select-border={borderColor} style:--mo-select-ring={ringColor}>
	{#if a11y.label.mode === "visible"}
		<label class="mo-select__label" for={a11y.id}>
			{a11y.label.text}
			{#if a11y.required}
				<span class="mo-select__req" aria-hidden="true">*</span>
				<span class="mo-select__sr">(required)</span>
			{/if}
		</label>
	{/if}
	<div class="mo-select__shell">
		<select
			bind:value
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
		<span class="mo-select__chevron material-symbols-outlined" aria-hidden="true">expand_more</span>
	</div>
	{#if node.hint && !invalid}
		<p id={hintId} class="mo-select__hint">{node.hint}</p>
	{/if}
	{#if node.error}
		<p id={errorId} class="mo-select__error" role="alert">
			<span class="mo-select__error-icon material-symbols-outlined" aria-hidden="true">error</span>
			<span>{node.error}</span>
		</p>
	{/if}
</div>

<style>
	.mo-select {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.mo-select__label {
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-select__req {
		color: var(--mo-intent-caution-on);
		margin-inline-start: var(--mo-space-1);
	}
	.mo-select__sr {
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
	.mo-select__shell {
		position: relative;
		display: flex;
		align-items: center;
	}
	.mo-select__control {
		appearance: none;
		inline-size: 100%;
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-on-surface);
		border: 1px solid var(--mo-select-border, var(--mo-intent-outline));
		border-radius: var(--mo-radius-2);
		padding: var(--mo-ctx-space, var(--mo-space-3)) var(--mo-space-8) var(--mo-ctx-space, var(--mo-space-3))
			var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-snug);
		cursor: pointer;
		transition: border-color 0.15s ease;
	}
	.mo-select__control:focus-visible {
		outline: 2px solid var(--mo-select-ring, var(--mo-intent-primary-action-ring));
		outline-offset: 2px;
		border-color: var(--mo-select-ring, var(--mo-intent-primary-action-ring));
	}
	/* Shape channel for error: a thicker rule, not color alone. */
	.mo-select[data-invalid="true"] .mo-select__control {
		border-width: 2px;
	}
	.mo-select__chevron {
		position: absolute;
		inset-inline-end: var(--mo-space-3);
		font-size: 1.25em;
		color: var(--mo-intent-on-surface-muted);
		pointer-events: none;
	}
	.mo-select__hint {
		margin: 0;
		font-family: var(--mo-font-body);
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-select__error {
		display: flex;
		align-items: center;
		gap: var(--mo-space-2);
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-caution-on);
	}
	.mo-select__error-icon {
		font-size: 1.1em;
		line-height: 1;
	}
</style>

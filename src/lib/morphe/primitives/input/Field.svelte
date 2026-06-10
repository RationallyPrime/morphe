<script lang="ts">

	/*
	 * Field — a text input. The simplest stateful provider (Lemma 5): its value is
	 * tier-0, component-owned $state that never leaves the component; the wire
	 * carries only a `bind` store-path (exposed as data-bind for a host to adopt),
	 * never a live value.
	 *
	 * TWO MODES, ONE PRIMITIVE (CONTRACT §3): single-line is the default native
	 * `<input>`; `multiline` switches the substrate to a native `<textarea>` (the
	 * grammar fixed-point holds — every Field authored before `multiline` existed
	 * still renders single-line). A mode is a CAPABILITY of the same primitive, not
	 * a new kind: both arms share the identical a11y wiring, the same stateful-chrome
	 * CSS-var carriers, and the same error/hint markup. `inputType` is ignored when
	 * multiline; `rows`/`resizable` are ignored single-line.
	 *
	 * a11y is REQUIRED by the grammar (InputA11y): the label relationship is wired
	 * into the DOM here, so an unlabelled Field is unrepresentable, not merely
	 * discouraged. The error state is signalled by THREE channels — caution color,
	 * an alert text message, AND a shape (the error glyph + a thicker rule) — so
	 * functional color is never the only signal (WCAG 1.4.1).
	 *
	 * Continuous sizing rides the boundary CSS vars (--mo-ctx-type, --mo-ctx-space)
	 * the nearest Layout ancestor set; stateful chrome (border, ring) rides this
	 * component's own --mo-field-* vars (the C9 carrier lifted from the legacy:
	 * discrete decisions stay declarative, continuous/stateful values flow through
	 * the cascade — no runtime className synthesis). Colors resolve through
	 * SLOTS -> intents -> scales; no raw scale or hex is named here.
	 *
	 * Note the seed's TextArea (atoms/TextArea.tsx) put its focus ring on the
	 * WRAPPER div (focus-within) — the documented a11y bug. Here the control owns
	 * its own :focus-visible, mirroring the single-line arm, and the seed's
	 * variant/size className tables + dark: doubling are discarded per the seed-mining
	 * report (the surface comes from the dialect, not a className matrix).
	 */

	import type { Field } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { boundString, commitTier1, useMorpheStore } from "../../state/store.svelte.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Field> = $props();
	const store = useMorpheStore();

	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const errorId = $derived(node.error ? `${a11y.id}-error` : undefined);
	const describedBy = $derived(
		[a11y.describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined,
	);
	const invalid = $derived(Boolean(node.error));
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);

	// Mode selection (CONTRACT §3): the multiline capability swaps the substrate
	// to a <textarea>. Defaulted/optional so the grammar fixed-point holds.
	const multiline = $derived(node.multiline === true);
	// Native <textarea> rows default; only meaningful in the multiline arm.
	const rows = $derived(node.rows ?? 3);
	// User-resize is a genuine textarea capability; on by default like the platform.
	// "none" is the only deviation from the native "vertical" default — never let it
	// grow horizontally (would break the editorial column), so we cap to vertical.
	const resize = $derived(node.resizable === false ? "none" : "vertical");

	// Stateful chrome through the CSS-var channel: resting border vs. error border.
	// (borderError IS the caution color; identical to the single-line arm.)
	const borderColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.border());
	const ringColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.ring());

	// tier-0 local state (Lemma 5): seed from tier-1 when bound, then commit only
	// on native change. Keystrokes stay component-owned and do not leave the field.
	// svelte-ignore state_referenced_locally
	let value = $state(boundString(store, node.bind, ""));

	function commitValue(): void {
		commitTier1(store, node.bind, "filter-edit", value);
	}
</script>

<div
	class="mo-field"
	data-invalid={invalid}
	data-multiline={multiline}
	style:--mo-field-border={borderColor}
	style:--mo-field-ring={ringColor}
>
	{#if a11y.label.mode === "visible"}
		<label class="mo-field__label" for={a11y.id}>
			{a11y.label.text}
			{#if a11y.required}
				<span class="mo-field__req" aria-hidden="true">*</span>
				<span class="mo-field__sr">(required)</span>
			{/if}
		</label>
	{/if}
	{#if multiline}
		<textarea
			bind:value
			id={a11y.id}
			class="mo-field__input mo-field__input--multiline"
			{rows}
			placeholder={node.placeholder}
			required={a11y.required}
			aria-required={a11y.required}
			aria-invalid={invalid}
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledby}
			aria-describedby={describedBy}
			data-bind={node.bind}
			onchange={commitValue}
			style:resize
		></textarea>
	{:else}
		<input
			bind:value
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
			onchange={commitValue}
		/>
	{/if}
	{#if node.hint && !invalid}
		<p id={hintId} class="mo-field__hint">{node.hint}</p>
	{/if}
	{#if node.error}
		<p id={errorId} class="mo-field__error" role="alert">
			<span class="mo-field__error-icon material-symbols-outlined" aria-hidden="true">error</span>
			<span>{node.error}</span>
		</p>
	{/if}
</div>

<style>
	.mo-field {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.mo-field__label {
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-field__req {
		color: var(--mo-intent-caution-on);
		margin-inline-start: var(--mo-space-1);
	}
	.mo-field__sr {
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
	/* Shared chrome for both substrates: the <input> and the <textarea> read
	   identically (same surface, same border carrier, same focus-visible ring). */
	.mo-field__input {
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-on-surface);
		border: 0;
		border-bottom: var(--mo-ctx-stroke, var(--mo-border-width)) solid
			var(--mo-field-border, var(--mo-intent-outline));
		border-radius: var(--mo-radius-2) var(--mo-radius-2) 0 0;
		padding: var(--mo-ctx-space, var(--mo-space-4)) var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-snug);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	/* Multiline substrate: a native <textarea>. The bottom-rule chrome would read
	   oddly against a tall box, so the box gets a full outline-variant edge and a
	   relaxed reading line-height; resize is vertical-only (see `resize` derived). */
	.mo-field__input--multiline {
		display: block;
		inline-size: 100%;
		min-block-size: calc(var(--mo-ctx-type, var(--mo-type-4)) * 3);
		line-height: var(--mo-leading-normal);
		font-family: var(--mo-font-body);
	}
	.mo-field__input::placeholder {
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-field__input:focus-visible {
		/* The control owns its ring (NOT the wrapper — fixes the seed's bug). */
		outline: var(--mo-ring-width, 2px) solid
			var(--mo-field-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-ring-offset, 2px);
		border-bottom-color: var(--mo-field-ring, var(--mo-intent-primary-action-ring));
	}
	/* Shape channel for the error state: the stroke steps up to the emphasis tier
	   (a thicker rule, not color alone) by overriding the orbit var locally. */
	.mo-field[data-invalid="true"] .mo-field__input {
		--mo-ctx-stroke: var(--mo-border-width-strong);
	}
	.mo-field__hint {
		margin: 0;
		font-family: var(--mo-font-body);
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-field__error {
		display: flex;
		align-items: center;
		gap: var(--mo-space-2);
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-caution-on);
	}
	.mo-field__error-icon {
		font-size: 1.1em;
		line-height: 1;
	}
	/* Reduced motion: drop the stateful-chrome transition for users who ask for it
	   (CONTRACT §7 / DNA — respect prefers-reduced-motion for any transition). */
	@media (prefers-reduced-motion: reduce) {
		.mo-field__input {
			transition: none;
		}
	}
</style>

<script lang="ts">

	/*
	 * Toggle — a boolean control in ONE of two semantic MODES of the SAME
	 * primitive (CONTRACT §3, grammar `Toggle.variant`). The mode is a capability,
	 * not a new kind; the wire carries only `variant` + `bind`, and every Toggle
	 * authored before `variant` existed still renders (defaulted to "switch").
	 *
	 *   - "switch" (DEFAULT): a real `<button role="switch" aria-checked>` — an
	 *     on/off SETTING that takes effect immediately. The platform gives
	 *     Space/Enter toggling and Tab focus for free; we never reimplement them.
	 *   - "checkbox": a NATIVE `<input type="checkbox">` — a selectable item in a
	 *     set / a form value committed on submit. Real checkbox semantics: Space
	 *     toggles for free, it participates in form submission, and it supports the
	 *     indeterminate (tri-state) `aria-checked="mixed"` value. The visual box is
	 *     a custom shape painted over an `appearance:none` input so the real
	 *     element keeps the semantics; the check / dash are SHAPE cues, never color
	 *     alone (WCAG 1.4.1).
	 *
	 * State is tier-0, component-owned `$state` (Lemma 5) that never leaves the
	 * component in Phase 0; the wire carries only the `bind` store-path (data-bind).
	 * `indeterminate` is checkbox-only: it drives `el.indeterminate` through an
	 * `$effect` on the bound element (the seed's imperative `useEffect` +
	 * `useImperativeHandle` ceremony collapses to one Svelte effect) and surfaces
	 * `aria-checked="mixed"`. It is ignored in switch mode.
	 *
	 * a11y is REQUIRED (InputA11y): the grammar makes an unlabelled Toggle
	 * unrepresentable. The visible label uses `for` to extend the hit target onto
	 * the text. Colors resolve through SLOTS -> intents -> scales; geometry through
	 * neutral scale vars. No raw px or hex is named here.
	 */

	import type { Toggle } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { boundBoolean, commitTier1, useMorpheStore } from "../../state/store.svelte.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Toggle> = $props();
	const store = useMorpheStore();

	const a11y = $derived(node.a11y);
	// "switch" is the default mode so every pre-variant Toggle stays valid.
	const isCheckbox = $derived(node.variant === "checkbox");
	// indeterminate is a checkbox-only tri-state; meaningless on a switch.
	const indeterminate = $derived(isCheckbox && node.indeterminate === true);

	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const describedBy = $derived([a11y.describedBy, hintId].filter(Boolean).join(" ") || undefined);
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);

	// tier-0 local state (Lemma 5): seed from tier-1 when bound, then commit only
	// when the control's boolean value changes.
	// svelte-ignore state_referenced_locally
	let on = $state(boundBoolean(store, node.bind, false));

	// The bound DOM element for the checkbox mode — indeterminate is a DOM-only
	// property (no HTML attribute), so it MUST be set imperatively on the element.
	let checkboxEl = $state<HTMLInputElement | null>(null);

	// Mirror the tri-state onto the real element. `el.indeterminate` is visual
	// only; the underlying `checked` is independent, so we drive it every time
	// either input changes. This replaces the seed's useEffect/useImperativeHandle.
	$effect(() => {
		if (checkboxEl) {
			checkboxEl.indeterminate = indeterminate;
		}
	});

	// aria-checked: a switch is boolean; a checkbox reports "mixed" while
	// indeterminate, otherwise its boolean state.
	const ariaChecked = $derived<"true" | "false" | "mixed">(
		indeterminate ? "mixed" : on ? "true" : "false",
	);

	// Stateful track / accent color through the CSS-var channel (no hardcoded hex).
	const accent = $derived(SLOTS.action.surface());
	// Focus-ring geometry is neutral (CONTRACT §7); color stays per-intent.
	const ringColor = $derived(SLOTS.focus.ring());
	const ringWidth = $derived(SLOTS.focus.width());
	const ringOffset = $derived(SLOTS.focus.offset());

	function setOn(next: boolean): void {
		on = next;
		commitTier1(store, node.bind, "selection", next);
	}

	function onCheckboxChange(event: Event & { currentTarget: HTMLInputElement }): void {
		// Activating an indeterminate checkbox resolves it to checked (native
		// behaviour: the indeterminate flag clears and the box becomes checked).
		setOn(indeterminate ? true : event.currentTarget.checked);
	}
</script>

<div
	class="mo-toggle"
	data-variant={isCheckbox ? "checkbox" : "switch"}
	style:--mo-toggle-accent={accent}
	style:--mo-toggle-ring={ringColor}
	style:--mo-toggle-ring-width={ringWidth}
	style:--mo-toggle-ring-offset={ringOffset}
>
	{#if isCheckbox}
		<span class="mo-toggle__box-wrap">
			<input
				bind:this={checkboxEl}
				id={a11y.id}
				type="checkbox"
				class="mo-toggle__checkbox"
				checked={on}
				onchange={onCheckboxChange}
				aria-checked={ariaChecked}
				aria-required={a11y.required}
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledby}
				aria-describedby={describedBy}
				data-bind={node.bind}
			/>
			<span class="mo-toggle__box" data-state={indeterminate ? "mixed" : on ? "on" : "off"} aria-hidden="true">
				<span class="mo-toggle__mark mo-toggle__mark--check material-symbols-outlined">check</span>
				<span class="mo-toggle__mark mo-toggle__mark--mixed material-symbols-outlined">remove</span>
			</span>
		</span>
	{:else}
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
			data-on={on}
			onclick={() => setOn(!on)}
		>
			<span class="mo-toggle__track" aria-hidden="true">
				<span class="mo-toggle__glyph mo-toggle__glyph--on material-symbols-outlined">check</span>
				<span class="mo-toggle__glyph mo-toggle__glyph--off material-symbols-outlined">remove</span>
			</span>
			<span class="mo-toggle__thumb" data-on={on} aria-hidden="true"></span>
		</button>
	{/if}
	{#if a11y.label.mode === "visible"}
		<label class="mo-toggle__label" for={a11y.id}>
			{a11y.label.text}
			{#if a11y.required}
				<span class="mo-toggle__req" aria-hidden="true">*</span>
				<span class="mo-toggle__sr">(required)</span>
			{/if}
		</label>
	{/if}
	{#if node.hint}
		<p id={hintId} class="mo-toggle__hint">{node.hint}</p>
	{/if}
</div>

<style>
	.mo-toggle {
		display: inline-grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		column-gap: var(--mo-space-3);
		row-gap: var(--mo-space-1);
	}

	/* --- switch mode (default) ------------------------------------------- */
	.mo-toggle__switch {
		position: relative;
		inline-size: 2.75rem;
		block-size: 1.5rem;
		border-radius: var(--mo-radius-full);
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid var(--mo-intent-outline);
		background: var(--mo-intent-neutral-surface);
		padding: 0;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}
	.mo-toggle__switch[data-on="true"] {
		background: var(--mo-toggle-accent, var(--mo-intent-primary-action-surface));
		border-color: var(--mo-toggle-accent, var(--mo-intent-primary-action-surface));
	}
	.mo-toggle__switch:focus-visible {
		outline: var(--mo-toggle-ring-width, var(--mo-ring-width)) solid
			var(--mo-toggle-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-toggle-ring-offset, var(--mo-ring-offset));
	}
	/* Shape channel: a glyph on each side of the track, the active one revealed. */
	.mo-toggle__track {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: 0.2rem;
	}
	.mo-toggle__glyph {
		font-size: 0.85rem;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.mo-toggle__glyph--on {
		color: var(--mo-intent-primary-action-on);
	}
	.mo-toggle__glyph--off {
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-toggle__switch[data-on="true"] .mo-toggle__glyph--on {
		opacity: 1;
	}
	.mo-toggle__switch[data-on="false"] .mo-toggle__glyph--off {
		opacity: 1;
	}
	.mo-toggle__thumb {
		position: absolute;
		inset-block-start: 50%;
		inset-inline-start: 2px;
		inline-size: 1.1rem;
		block-size: 1.1rem;
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-on-surface);
		transform: translate(0, -50%);
		transition: transform 0.15s ease;
	}
	.mo-toggle__thumb[data-on="true"] {
		transform: translate(1.25rem, -50%);
		background: var(--mo-intent-primary-action-on);
	}

	/* --- checkbox mode --------------------------------------------------- */
	/*
	 * The real <input type="checkbox"> stays in the DOM (semantics, form
	 * participation, Space-toggle) but is visually flattened (appearance:none) and
	 * stretched over the painted box, so the native focus/hit-target is preserved
	 * while we draw a tonal box with a shape mark. State is signalled by the mark
	 * SHAPE (check / dash) AND the fill, never color alone.
	 */
	.mo-toggle__box-wrap {
		position: relative;
		display: inline-grid;
		place-items: center;
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}
	.mo-toggle__checkbox {
		position: absolute;
		inset: 0;
		margin: 0;
		inline-size: 100%;
		block-size: 100%;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		/* the input owns the focus ring; the box below is purely decorative */
		border-radius: var(--mo-radius-1);
	}
	.mo-toggle__box {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border-radius: var(--mo-radius-1);
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid var(--mo-intent-outline);
		background: var(--mo-intent-neutral-surface);
		pointer-events: none;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}
	.mo-toggle__box[data-state="on"],
	.mo-toggle__box[data-state="mixed"] {
		background: var(--mo-toggle-accent, var(--mo-intent-primary-action-surface));
		border-color: var(--mo-toggle-accent, var(--mo-intent-primary-action-surface));
	}
	.mo-toggle__mark {
		grid-area: 1 / 1;
		font-size: 1rem;
		line-height: 1;
		color: var(--mo-intent-primary-action-on);
		opacity: 0;
		transform: scale(0.6);
		transition: opacity 0.12s ease, transform 0.12s ease;
	}
	.mo-toggle__box[data-state="on"] .mo-toggle__mark--check {
		opacity: 1;
		transform: scale(1);
	}
	.mo-toggle__box[data-state="mixed"] .mo-toggle__mark--mixed {
		opacity: 1;
		transform: scale(1);
	}
	/* Focus ring sits on the real input, shared neutral geometry + intent color. */
	.mo-toggle__checkbox:focus-visible {
		outline: var(--mo-toggle-ring-width, var(--mo-ring-width)) solid
			var(--mo-toggle-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-toggle-ring-offset, var(--mo-ring-offset));
	}

	/* --- shared label / hint -------------------------------------------- */
	.mo-toggle__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-3));
		color: var(--mo-intent-on-surface);
		cursor: pointer;
	}
	.mo-toggle__req {
		color: var(--mo-intent-caution-on);
		margin-inline-start: var(--mo-space-1);
	}
	.mo-toggle__sr {
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
	.mo-toggle__hint {
		grid-column: 2;
		margin: 0;
		font-family: var(--mo-font-body);
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.mo-toggle__switch,
		.mo-toggle__glyph,
		.mo-toggle__thumb,
		.mo-toggle__box,
		.mo-toggle__mark {
			transition: none;
		}
	}
</style>

<script lang="ts">
	/*
	 * Toggle — a boolean switch (role="switch", a real button so platform keyboard
	 * support is free: Space/Enter toggle, Tab focuses). A stateful provider
	 * (Lemma 5): the on/off state is tier-0, component-owned $state that never
	 * leaves the component; the wire carries only a `bind` store-path (data-bind).
	 *
	 * a11y is REQUIRED (InputA11y): the grammar makes an unlabelled Toggle
	 * unrepresentable. The on/off distinction is signalled by SHAPE (thumb
	 * position + a track glyph) as well as color, so state is never color-only
	 * (WCAG 1.4.1). The visible label uses `for` to extend the hit target onto the
	 * text.
	 *
	 * Colors resolve through SLOTS -> intents -> scales; the stateful track color
	 * rides this component's --mo-toggle-track var. No raw scale or hex named here.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Toggle } from "../../grammar/types.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Toggle> = $props();

	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const describedBy = $derived([a11y.describedBy, hintId].filter(Boolean).join(" ") || undefined);
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);

	// tier-0 local state (Lemma 5): never leaves the component in Phase 0.
	let on = $state(false);

	// Stateful track color through the CSS-var channel.
	const trackOn = $derived(SLOTS.action.surface());
</script>

<div class="mo-toggle" style:--mo-toggle-track={trackOn}>
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
		onclick={() => (on = !on)}
	>
		<span class="mo-toggle__track" aria-hidden="true">
			<span class="mo-toggle__glyph mo-toggle__glyph--on material-symbols-outlined">check</span>
			<span class="mo-toggle__glyph mo-toggle__glyph--off material-symbols-outlined">remove</span>
		</span>
		<span class="mo-toggle__thumb" data-on={on} aria-hidden="true"></span>
	</button>
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
	.mo-toggle__switch {
		position: relative;
		inline-size: 2.75rem;
		block-size: 1.5rem;
		border-radius: var(--mo-radius-full);
		border: 1px solid var(--mo-intent-outline);
		background: var(--mo-intent-neutral-surface);
		padding: 0;
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}
	.mo-toggle__switch[data-on="true"] {
		background: var(--mo-toggle-track, var(--mo-intent-primary-action-surface));
		border-color: var(--mo-toggle-track, var(--mo-intent-primary-action-surface));
	}
	.mo-toggle__switch:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
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
</style>

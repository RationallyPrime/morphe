<script lang="ts">
	/*
	 * Range — a bounded numeric slider (native type="range", so the platform owns
	 * keyboard support and exposes aria-valuemin/max/now automatically). A stateful
	 * provider (Lemma 5): the value is tier-0, component-owned $state that never
	 * leaves the component; the wire carries only a `bind` store-path (data-bind).
	 *
	 * a11y is REQUIRED (InputA11y): the grammar makes an unlabelled Range
	 * unrepresentable. A live <output> announces the current value (a non-visual
	 * channel beyond the thumb position) and the endpoints are labelled in text, so
	 * the value is never communicated by position alone.
	 *
	 * The track fill is a continuous value carried through this component's
	 * --mo-range-pct CSS var (the C9 carrier: continuous/stateful values flow
	 * through the cascade, not runtime className synthesis). Colors resolve through
	 * SLOTS -> intents -> scales; no raw scale or hex is named here.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Range } from "../../grammar/types.js";
	import { boundNumber, commitTier1, useMorpheStore } from "../../state/store.svelte.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Range> = $props();
	const store = useMorpheStore();

	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const outputId = $derived(`${a11y.id}-value`);
	const describedBy = $derived(
		[a11y.describedBy, hintId, outputId].filter(Boolean).join(" ") || undefined,
	);
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);

	// tier-0 local state (Lemma 5); seeded from tier-1 when bound, otherwise min.
	// svelte-ignore state_referenced_locally
	let value = $state(boundNumber(store, node.bind, node.min));

	// Continuous fill position as a percentage, carried through a CSS var.
	const pct = $derived(
		node.max > node.min ? ((value - node.min) / (node.max - node.min)) * 100 : 0,
	);
	const fill = $derived(SLOTS.action.surface());

	function onRangeChange(event: Event & { currentTarget: HTMLInputElement }): void {
		const next = Number(event.currentTarget.value);
		value = Number.isFinite(next) ? next : node.min;
		commitTier1(store, node.bind, "filter-edit", value);
	}
</script>

<div class="mo-range" style:--mo-range-pct={`${pct}%`} style:--mo-range-fill={fill}>
	<div class="mo-range__head">
		{#if a11y.label.mode === "visible"}
			<label class="mo-range__label" for={a11y.id}>
				{a11y.label.text}
				{#if a11y.required}
					<span class="mo-range__req" aria-hidden="true">*</span>
					<span class="mo-range__sr">(required)</span>
				{/if}
			</label>
		{/if}
		<output id={outputId} class="mo-range__value" for={a11y.id} aria-live="off">{value}</output>
	</div>
	<input
		bind:value
		id={a11y.id}
		class="mo-range__control"
		type="range"
		min={node.min}
		max={node.max}
		step={node.step ?? 1}
		aria-label={ariaLabel}
		aria-labelledby={ariaLabelledby}
		aria-describedby={describedBy}
		data-bind={node.bind}
		onchange={onRangeChange}
	/>
	<div class="mo-range__scale" aria-hidden="true">
		<span class="mo-range__bound">{node.min}</span>
		<span class="mo-range__bound">{node.max}</span>
	</div>
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
	.mo-range__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--mo-space-3);
	}
	.mo-range__label {
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-range__req {
		color: var(--mo-intent-caution-on);
		margin-inline-start: var(--mo-space-1);
	}
	.mo-range__sr {
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
	.mo-range__value {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		color: var(--mo-intent-on-surface);
		font-variant-numeric: tabular-nums;
	}
	.mo-range__control {
		inline-size: 100%;
		appearance: none;
		block-size: 0.5rem;
		border-radius: var(--mo-radius-full);
		/* The fill tracks the value via --mo-range-pct; the rest is the rail. */
		background: linear-gradient(
			to right,
			var(--mo-range-fill, var(--mo-intent-primary-action-surface)) var(--mo-range-pct, 0%),
			var(--mo-intent-neutral-surface) var(--mo-range-pct, 0%)
		);
		cursor: pointer;
	}
	.mo-range__control:focus-visible {
		outline: var(--mo-ring-width) solid var(--mo-intent-primary-action-ring);
		outline-offset: var(--mo-ring-offset);
	}
	.mo-range__control::-webkit-slider-thumb {
		appearance: none;
		inline-size: 1.1rem;
		block-size: 1.1rem;
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-on-surface);
		border: var(--mo-border-width-strong) solid var(--mo-range-fill, var(--mo-intent-primary-action-surface));
		cursor: pointer;
	}
	.mo-range__control::-moz-range-thumb {
		inline-size: 1.1rem;
		block-size: 1.1rem;
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-on-surface);
		border: var(--mo-border-width-strong) solid var(--mo-range-fill, var(--mo-intent-primary-action-surface));
		cursor: pointer;
	}
	.mo-range__scale {
		display: flex;
		justify-content: space-between;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		color: var(--mo-intent-on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	.mo-range__hint {
		margin: 0;
		font-family: var(--mo-font-body);
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
</style>

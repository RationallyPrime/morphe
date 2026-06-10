<script lang="ts">

	/*
	 * Select — a single, mutually-exclusive choice from a small option set. ONE
	 * primitive, TWO presentation MODES (the grammar's `variant`, not a new kind):
	 *
	 *   - "dropdown"   (default): a native <select>. Keyboard, type-ahead, and the
	 *                  platform's mobile picker are the BROWSER's, not re-implemented.
	 *   - "radiogroup": a <fieldset>/<legend> group of role="radio" options with a
	 *                  ROVING tabindex (one tab stop for the group, arrows move AND
	 *                  select, Home/End jump, Space/Enter confirm). For small sets
	 *                  that read as one choice the author wants laid out in full.
	 *
	 * A stateful provider (Lemma 5): the chosen value is tier-0, component-owned
	 * $state that never leaves the component; the wire carries only a `bind`
	 * store-path (data-bind).
	 *
	 * a11y is REQUIRED (InputA11y): the grammar makes an unlabelled Select
	 * unrepresentable. Both modes wire the label relation, hint+error via
	 * aria-describedby, and aria-required/aria-invalid. The error state pairs
	 * caution color with an alert message AND a shape (the error glyph + a thicker
	 * rule / a thicker selected radio ring), never color alone (WCAG 1.4.1).
	 *
	 * Continuous sizing rides the boundary vars (--mo-ctx-type/space); stateful
	 * chrome rides this component's --mo-select-* vars. Colors resolve through
	 * SLOTS -> intents -> scales; no raw scale or hex is named here. Reduced motion
	 * is honoured for the radio-dot/transition via a media query in the styles.
	 */

	import type { Select } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { boundString, commitTier1, useMorpheStore } from "../../state/store.svelte.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Select> = $props();
	const store = useMorpheStore();

	const variant = $derived(node.variant ?? "dropdown");

	const a11y = $derived(node.a11y);
	const hintId = $derived(node.hint ? `${a11y.id}-hint` : undefined);
	const errorId = $derived(node.error ? `${a11y.id}-error` : undefined);
	const describedBy = $derived(
		[a11y.describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined,
	);
	const invalid = $derived(Boolean(node.error));
	const ariaLabel = $derived(a11y.label.mode === "aria-label" ? a11y.label.text : undefined);
	const ariaLabelledby = $derived(a11y.label.mode === "labelledby" ? a11y.label.id : undefined);
	// The radiogroup container is named by its own <legend> when the label is
	// visible, else by the external labelledby id; aria-label covers the rest.
	const legendId = $derived(a11y.label.mode === "visible" ? `${a11y.id}-legend` : undefined);
	const groupLabelledby = $derived(legendId ?? ariaLabelledby);

	const borderColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.border());
	const ringColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.field.ring());
	// The selected radio's dot/ring rides the primary-action register (the beacon)
	// when valid, the caution register when invalid — color is one of TWO signals.
	const markColor = $derived(invalid ? SLOTS.field.borderError() : SLOTS.action.surface());

	// tier-0 local state (Lemma 5): seed from tier-1 when bound, then commit only
	// when the selected option changes.
	// svelte-ignore state_referenced_locally
	let value = $state(boundString(store, node.bind, node.options[0]?.value ?? ""));

	/* ---- radiogroup roving model (one tab stop, arrows move selection) ---- */

	// The indices of options that can actually receive focus (enabled ones).
	const enabledIndices = $derived(
		node.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0),
	);

	// Per-radio element refs so roving can move DOM focus, not just selection.
	let radioEls = $state<(HTMLButtonElement | null)[]>([]);

	// The single tab stop: the selected option if it is enabled, else the first
	// enabled option (ARIA APG — a radiogroup always has exactly one tabbable radio).
	const tabStopIndex = $derived.by(() => {
		const selected = node.options.findIndex((o) => o.value === value && !o.disabled);
		if (selected >= 0) return selected;
		return enabledIndices[0] ?? -1;
	});

	function selectIndex(index: number, moveFocus: boolean): void {
		const opt = node.options[index];
		if (!opt || opt.disabled) return;
		value = opt.value;
		commitTier1(store, node.bind, "selection", value);
		if (moveFocus) radioEls[index]?.focus();
	}

	function onDropdownChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		value = event.currentTarget.value;
		commitTier1(store, node.bind, "selection", value);
	}

	// Arrow/Home/End roving across ENABLED options, wrapping at the ends. In a
	// radiogroup, moving focus also moves selection (the APG "selection follows
	// focus" pattern), so the arrows are the whole keyboard contract.
	function rove(from: number, dir: 1 | -1 | "first" | "last"): void {
		if (enabledIndices.length === 0) return;
		const pos = enabledIndices.indexOf(from);
		let nextPos: number;
		if (dir === "first") nextPos = 0;
		else if (dir === "last") nextPos = enabledIndices.length - 1;
		else {
			const base = pos < 0 ? (dir === 1 ? -1 : 0) : pos;
			nextPos = (base + dir + enabledIndices.length) % enabledIndices.length;
		}
		const nextIndex = enabledIndices[nextPos];
		if (nextIndex === undefined) return;
		selectIndex(nextIndex, true);
	}

	function onRadioKeydown(event: KeyboardEvent, index: number): void {
		switch (event.key) {
			case "ArrowDown":
			case "ArrowRight":
				event.preventDefault();
				rove(index, 1);
				break;
			case "ArrowUp":
			case "ArrowLeft":
				event.preventDefault();
				rove(index, -1);
				break;
			case "Home":
				event.preventDefault();
				rove(index, "first");
				break;
			case "End":
				event.preventDefault();
				rove(index, "last");
				break;
			case " ":
			case "Enter":
				// Native radios commit on Space; mirror that and keep focus put.
				event.preventDefault();
				selectIndex(index, false);
				break;
		}
	}
</script>

{#if variant === "radiogroup"}
	<fieldset
		class="mo-select mo-select--radiogroup"
		data-invalid={invalid}
		style:--mo-select-border={borderColor}
		style:--mo-select-ring={ringColor}
		style:--mo-select-mark={markColor}
	>
		{#if a11y.label.mode === "visible"}
			<legend id={legendId} class="mo-select__legend">
				{a11y.label.text}
				{#if a11y.required}
					<span class="mo-select__req" aria-hidden="true">*</span>
					<span class="mo-select__sr">(required)</span>
				{/if}
			</legend>
		{/if}
		<!--
			ARIA group semantics ride the role="radiogroup" element: the implicit
			`group` role of <fieldset> does not support aria-required/aria-invalid,
			the explicit `radiogroup` role does (and is the correct APG container).
		-->
		<div
			class="mo-select__options"
			role="radiogroup"
			aria-required={a11y.required}
			aria-invalid={invalid}
			aria-label={ariaLabel}
			aria-labelledby={groupLabelledby}
			aria-describedby={describedBy}
			data-bind={node.bind}
		>
			{#each node.options as opt, index (opt.value)}
				{@const selected = opt.value === value}
				<button
					bind:this={radioEls[index]}
					type="button"
					class="mo-select__radio"
					role="radio"
					aria-checked={selected}
					disabled={opt.disabled}
					tabindex={index === tabStopIndex ? 0 : -1}
					data-selected={selected}
					data-value={opt.value}
					onclick={() => selectIndex(index, true)}
					onkeydown={(e) => onRadioKeydown(e, index)}
				>
					<span class="mo-select__mark" aria-hidden="true"></span>
					<span class="mo-select__option-label">{opt.label}</span>
				</button>
			{/each}
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
	</fieldset>
{:else}
	<div
		class="mo-select"
		data-invalid={invalid}
		style:--mo-select-border={borderColor}
		style:--mo-select-ring={ringColor}
	>
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
				onchange={onDropdownChange}
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
{/if}

<style>
	.mo-select {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	/* The fieldset carries no chrome of its own — the sectioning is structural,
	   not a 1px box (CONTRACT: no borders for sectioning). */
	.mo-select--radiogroup {
		min-inline-size: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.mo-select__label,
	.mo-select__legend {
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
		font-weight: 600;
	}
	.mo-select__legend {
		padding: 0;
		margin-block-end: var(--mo-space-2);
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

	/* ---- dropdown mode ---- */
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
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid
			var(--mo-select-border, var(--mo-intent-outline));
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
		outline: var(--mo-ring-width) solid var(--mo-select-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-ring-offset);
		border-color: var(--mo-select-ring, var(--mo-intent-primary-action-ring));
	}
	/* Shape channel for error: a thicker rule, not color alone. */
	.mo-select[data-invalid="true"] .mo-select__control {
		--mo-ctx-stroke: var(--mo-border-width-strong);
	}
	.mo-select__chevron {
		position: absolute;
		inset-inline-end: var(--mo-space-3);
		font-size: 1.25em;
		color: var(--mo-intent-on-surface-muted);
		pointer-events: none;
	}

	/* ---- radiogroup mode ---- */
	.mo-select__options {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.mo-select__radio {
		display: flex;
		align-items: center;
		gap: var(--mo-space-3);
		inline-size: 100%;
		text-align: start;
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-on-surface);
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid
			var(--mo-select-border, var(--mo-intent-outline));
		border-radius: var(--mo-radius-2);
		padding: var(--mo-ctx-space, var(--mo-space-3)) var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-snug);
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}
	.mo-select__radio:hover:not(:disabled) {
		border-color: var(--mo-select-mark, var(--mo-intent-primary-action-surface));
	}
	.mo-select__radio:focus-visible {
		outline: var(--mo-ring-width) solid var(--mo-select-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-ring-offset);
	}
	.mo-select__radio:disabled {
		cursor: not-allowed;
		opacity: var(--mo-disabled-opacity, 0.5);
	}
	/* Shape channel for selection: a filled ring whose center fills in — a SHAPE
	   change, present even without color. Selected also thickens the rule. */
	.mo-select__radio[data-selected="true"] {
		border-color: var(--mo-select-mark, var(--mo-intent-primary-action-surface));
		--mo-ctx-stroke: var(--mo-border-width-strong);
		/* Compensate the content shift from the heavier (strong) selected border. */
		padding-inline: calc(var(--mo-space-4) - (var(--mo-border-width-strong) - var(--mo-border-width)));
	}
	.mo-select__mark {
		position: relative;
		flex: none;
		inline-size: 1.15rem;
		block-size: 1.15rem;
		border-radius: var(--mo-radius-full);
		border: var(--mo-border-width-strong) solid var(--mo-intent-on-surface-muted);
		transition: border-color 0.15s ease;
	}
	.mo-select__radio[data-selected="true"] .mo-select__mark {
		border-color: var(--mo-select-mark, var(--mo-intent-primary-action-surface));
	}
	.mo-select__mark::after {
		content: "";
		position: absolute;
		inset: 50%;
		inline-size: 0;
		block-size: 0;
		border-radius: var(--mo-radius-full);
		background: var(--mo-select-mark, var(--mo-intent-primary-action-surface));
		transform: translate(-50%, -50%);
		transition: inline-size 0.15s ease, block-size 0.15s ease;
	}
	.mo-select__radio[data-selected="true"] .mo-select__mark::after {
		inline-size: 0.6rem;
		block-size: 0.6rem;
	}
	.mo-select__option-label {
		min-inline-size: 0;
	}

	/* ---- shared hint / error ---- */
	.mo-select__hint {
		margin: 0;
		font-family: var(--mo-font-body);
		font-style: italic;
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-select--radiogroup .mo-select__hint,
	.mo-select--radiogroup .mo-select__error {
		margin-block-start: var(--mo-space-2);
	}
	/* biome-ignore lint/style/noDescendingSpecificity: the radiogroup margin override above wins on specificity by design; the base rule reads better beside its siblings. */
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

	/* Reduced motion: drop the dot-grow / chrome transitions. */
	@media (prefers-reduced-motion: reduce) {
		.mo-select__control,
		.mo-select__radio,
		.mo-select__mark,
		.mo-select__mark::after {
			transition: none;
		}
	}
</style>

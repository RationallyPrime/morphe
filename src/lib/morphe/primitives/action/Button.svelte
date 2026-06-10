<script lang="ts">

	/*
	 * Button — the ACTION affordance (genuine browser capability). A real button
	 * element: native Space/Enter activation, focus, and disabled semantics for
	 * free. A clickable div is FORBIDDEN — this primitive exists precisely so the
	 * action affordance is always the real element (CONTRACT §3, seed report §1).
	 *
	 * a11y is REQUIRED by the grammar: a button either has visible `label` text
	 * (its accessible name) or — when icon-only — carries an explicit `a11y`
	 * name relation; "icon-only and unlabelled" is unrepresentable at the type
	 * level (the Button union, CONTRACT §7). This component never has to defend
	 * against the missing-name case; the grammar made it impossible.
	 *
	 * VARIANT is channel SELECTION, not a className matrix (the legacy's central
	 * liability, seed report §0.1): solid paints surface+on; outline paints
	 * border+on over a transparent surface; ghost paints on only with a hover
	 * surface. The chosen channels ride this component's own --mo-action-* CSS
	 * vars; the discrete variant rides a `data-variant` attribute selected in the
	 * style block. No className synthesis, no per-intent lookup tables.
	 *
	 * R1.4 action binding: the declarative `action` id resolves through the
	 * MorpheRoot-provided action map at click time. The tree still emits intent
	 * (an opaque id), never a handler. The busy spinner honours prefers-reduced-
	 * motion via a media query in the style block, never a JS hook.
	 */

	import type { Button } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { invokeAction, useActions } from "../../state/actions.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Button> = $props();
	const actions = useActions();

	const intent = $derived(node.intent ?? "primary-action");
	const variant = $derived(node.variant ?? "solid");

	// The accessible name. The Button union guarantees one of these is present:
	// a visible `label` IS the name; an icon-only button carries `a11y`. When both
	// a visible label and an explicit a11y relation are given, the explicit
	// relation wins (it overrides the text node as the computed name).
	const ariaLabel = $derived(node.a11y?.mode === "aria-label" ? node.a11y.text : undefined);
	const ariaLabelledby = $derived(node.a11y?.mode === "labelledby" ? node.a11y.id : undefined);

	// Icon-only ⇒ a square target with no visible text. The grammar guarantees an
	// a11y name exists in that case, so the icon stays decorative (aria-hidden).
	const iconOnly = $derived(node.label === undefined);

	// Stateful chrome through the CSS-var channel (the C9 carrier). Variant selects
	// WHICH of these the style block paints; every variant reads the same intent.
	const surface = $derived(SLOTS.action.surface(intent));
	const onColor = $derived(SLOTS.action.on(intent));
	const hoverColor = $derived(SLOTS.action.hover(intent));
	const activeColor = $derived(SLOTS.action.active(intent));
	const borderColor = $derived(SLOTS.action.border(intent));
	const ringColor = $derived(SLOTS.focus.ring(intent));

	function handleClick(): void {
		invokeAction(actions?.current, node.action);
	}
</script>

<button
	type={node.type ?? "button"}
	class="mo-action"
	data-variant={variant}
	data-icon-only={iconOnly || undefined}
	disabled={node.disabled || node.busy || undefined}
	aria-busy={node.busy || undefined}
	aria-label={ariaLabel}
	aria-labelledby={ariaLabelledby}
	data-action={node.action}
	onclick={handleClick}
	style:--mo-action-surface={surface}
	style:--mo-action-on={onColor}
	style:--mo-action-hover={hoverColor}
	style:--mo-action-active={activeColor}
	style:--mo-action-border={borderColor}
	style:--mo-action-ring={ringColor}
>
	{#if node.busy}
		<span class="mo-action__spin material-symbols-outlined" aria-hidden="true">progress_activity</span>
	{:else if node.icon}
		<span class="mo-action__icon material-symbols-outlined" aria-hidden="true">{node.icon}</span>
	{/if}
	{#if node.label !== undefined}
		<span class="mo-action__label">{node.label}</span>
	{/if}
</button>

<style>
	.mo-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-3) var(--mo-space-5);
		/* WCAG 2.5.5/2.5.8: keep the activation target tappable regardless of the
		   density tier the context hands down. */
		min-block-size: 2.5rem;
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid transparent;
		border-radius: var(--mo-radius-2);
		font-family: var(--mo-font-body);
		/* Type follows the boundary the nearest Layout ancestor set; falls back to
		   the label scale step. No size prop, no size ramp (seed report §0.7). */
		font-size: var(--mo-ctx-type, var(--mo-type-3));
		font-weight: 600;
		line-height: var(--mo-leading-tight);
		text-align: center;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	/* Icon-only: a square target, glyph centred, no horizontal text padding. */
	.mo-action[data-icon-only] {
		padding-inline: var(--mo-space-3);
		aspect-ratio: 1;
	}

	/* solid = surface + on (the painted affordance). */
	.mo-action[data-variant="solid"] {
		background: var(--mo-action-surface);
		color: var(--mo-action-on);
	}
	.mo-action[data-variant="solid"]:hover:not(:disabled) {
		background: var(--mo-action-hover);
	}
	.mo-action[data-variant="solid"]:active:not(:disabled) {
		background: var(--mo-action-active);
	}

	/* outline = border + on over a transparent surface; press fills with hover. */
	.mo-action[data-variant="outline"] {
		background: transparent;
		color: var(--mo-action-on);
		border-color: var(--mo-action-border);
	}
	.mo-action[data-variant="outline"]:hover:not(:disabled) {
		background: var(--mo-action-hover);
	}
	.mo-action[data-variant="outline"]:active:not(:disabled) {
		background: var(--mo-action-active);
	}

	/* ghost = on only; a surface appears on hover, deepens on press. */
	.mo-action[data-variant="ghost"] {
		background: transparent;
		color: var(--mo-action-on);
	}
	.mo-action[data-variant="ghost"]:hover:not(:disabled) {
		background: var(--mo-action-hover);
	}
	.mo-action[data-variant="ghost"]:active:not(:disabled) {
		background: var(--mo-action-active);
	}

	/* Keyboard affordance: a focus-visible ring from the shared geometry tokens
	   over the per-intent ring color — never hardcoded px (CONTRACT §7). */
	.mo-action:focus-visible {
		outline: var(--mo-ring-width) solid var(--mo-action-ring);
		outline-offset: var(--mo-ring-offset);
	}

	/* Disabled (and busy, which is disabled): the native :disabled covers both. The
	   dimmed surface is the shape/contrast cue; cursor signals non-interactivity. */
	.mo-action:disabled {
		opacity: var(--mo-disabled-opacity, 0.5);
		cursor: not-allowed;
	}

	.mo-action__icon,
	.mo-action__spin {
		font-size: 1.15em;
		line-height: 1;
		/* Glyphs are optical, not part of the box; keep them from stretching the
		   flex line and never let them shrink below their drawn size. */
		flex: none;
	}

	.mo-action__label {
		display: inline-block;
	}

	/* Busy is shape-bearing (a spinner) AND announced (aria-busy) — never color
	   alone (CONTRACT §7). The spin is motion, so it is gated on reduced-motion. */
	.mo-action__spin {
		animation: mo-action-spin 0.9s linear infinite;
	}
	@keyframes mo-action-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mo-action {
			transition: none;
		}
		.mo-action__spin {
			/* No spin; the static progress glyph + aria-busy still convey "busy". */
			animation: none;
		}
	}
</style>

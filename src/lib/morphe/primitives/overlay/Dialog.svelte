<script lang="ts">
	/*
	 * Dialog — a MODAL overlay on the PLATFORM TOP LAYER. The native dialog element
	 * + showModal(): the top layer (above everything, no z-index wars, no portal,
	 * no overflow clipping), a built-in ::backdrop, a built-in focus trap, built-in
	 * Escape (the `cancel` event), and focus restoration to the opener — all for
	 * free. We do NOT fake this with an absolutely-positioned div in an overflow
	 * container; that is the legacy mistake this primitive exists to retire.
	 *
	 * What this primitive ADDS on top of the platform:
	 *  - aria-labelledby (title, REQUIRED) + aria-describedby (optional description),
	 *    on deterministic ids hashed from the title (SSR/replay-safe, no Math.random);
	 *  - backdrop light-dismiss — ::backdrop is a pseudo-element with no event of its
	 *    own, so we detect a click that lands on the dialog box itself (i.e. OUTSIDE
	 *    the inner panel) and close. Gated by `dismissable`;
	 *  - `dismissable: false` cancels Escape (the native `cancel` event) and removes
	 *    the close affordance + backdrop dismissal, so a required modal can't be
	 *    skipped;
	 *  - a reduced-motion-aware enter transition (scale+fade of the panel, fade of
	 *    the scrim) expressed entirely in the style block — a media query, not a JS
	 *    hook.
	 *
	 * Open state is tier-0 $state; the wire carries only a `bind` store-path + an
	 * `open?` default (Lemma 5 — never a live value). An $effect reflects it onto
	 * the element via showModal()/close(). The scrim is the tonal `--mo-scrim`
	 * token (no drop shadow); the surface is the overlay tonal tier. Colors resolve
	 * through SLOTS -> intents -> scales; no raw scale or hex is named here.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Dialog } from "../../grammar/types.js";
	import { SLOTS } from "../../tokens/slots.js";
	import Node from "../../render/Node.svelte";

	let { node, ctx }: PrimitiveProps<Dialog> = $props();

	// A deterministic id base (no Math.random — SSR/replay-safe). Derived from the
	// title so the labelledby relationship is stable across re-emits.
	const nodeId = $derived(`mo-dialog-${cyrb(node.title)}`);
	const titleId = $derived(`${nodeId}-title`);
	const descId = $derived(node.description ? `${nodeId}-desc` : undefined);

	// Dismissable defaults to true; computed once so the markup reads cleanly.
	const dismissable = $derived(node.dismissable !== false);

	// Overlay chrome via SLOTS -> intents -> scales (no raw scale / hex here).
	const surface = $derived(SLOTS.overlay.surface());
	const onColor = $derived(SLOTS.overlay.on());
	const scrim = $derived(SLOTS.overlay.scrim());
	const borderColor = $derived(SLOTS.overlay.border());
	const ringColor = $derived(SLOTS.focus.ring());
	const ringWidth = $derived(SLOTS.focus.width());
	const ringOffset = $derived(SLOTS.focus.offset());

	// tier-0 local open state; the wire carries only a `bind` store-path + default.
	// svelte-ignore state_referenced_locally
	let open = $state(node.open ?? false);
	let el = $state<HTMLDialogElement | null>(null);

	// Reflect open state onto the native element. showModal() lifts the dialog to
	// the platform top layer (focus trap, ::backdrop, Escape, focus restoration all
	// come with it); close() returns focus to the opener. Guarded against
	// double-invocation (showModal on an already-open dialog throws).
	$effect(() => {
		const dlg = el;
		if (!dlg) return;
		if (open && !dlg.open) dlg.showModal();
		else if (!open && dlg.open) dlg.close();
	});

	// Native Escape fires `cancel` before close. A non-dismissable modal vetoes it.
	function onCancel(e: Event): void {
		if (!dismissable) {
			e.preventDefault();
			return;
		}
		open = false;
	}

	// Backdrop light-dismiss. The ::backdrop pseudo-element raises no event, but a
	// click on the dialog's own box (the area around the inner panel) targets the
	// dialog element itself; a click inside the panel does not. So `target === el`
	// means the backdrop was hit. Gated by `dismissable`.
	function onBackdropPointer(e: MouseEvent): void {
		if (!dismissable) return;
		if (e.target === el) open = false;
	}

	/** Tiny deterministic FNV-1a hash for a stable id (no runtime randomness). */
	function cyrb(s: string): string {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return (h >>> 0).toString(36);
	}
</script>

<dialog
	bind:this={el}
	class="mo-dialog"
	aria-labelledby={titleId}
	aria-describedby={descId}
	data-bind={node.bind}
	oncancel={onCancel}
	onclose={() => (open = false)}
	onclick={onBackdropPointer}
	style:--mo-overlay-surface={surface}
	style:--mo-overlay-on={onColor}
	style:--mo-overlay-scrim={scrim}
	style:--mo-overlay-border={borderColor}
	style:--mo-overlay-ring={ringColor}
	style:--mo-overlay-ring-width={ringWidth}
	style:--mo-overlay-ring-offset={ringOffset}
>
	<div class="mo-dialog__panel">
		<header class="mo-dialog__header">
			<h2 id={titleId} class="mo-dialog__title">{node.title}</h2>
			{#if dismissable}
				<button
					type="button"
					class="mo-dialog__close"
					aria-label="Close dialog"
					onclick={() => (open = false)}
				>
					<span class="material-symbols-outlined" aria-hidden="true">close</span>
				</button>
			{/if}
		</header>
		{#if node.description}
			<p id={descId} class="mo-dialog__desc">{node.description}</p>
		{/if}
		<div class="mo-dialog__body">
			{#each node.children as child (child)}
				<Node node={child} {ctx} />
			{/each}
		</div>
	</div>
</dialog>

<style>
	.mo-dialog {
		padding: 0;
		border: var(--mo-ctx-stroke, var(--mo-border-width)) solid var(--mo-overlay-border);
		border-radius: var(--mo-radius-3);
		background: var(--mo-overlay-surface);
		color: var(--mo-overlay-on);
		inline-size: min(92vw, 40rem);
		max-block-size: min(88dvh, 48rem);
		/* The dialog box is the backdrop hit-target; the inner panel owns the chrome. */
		overflow: clip;
	}
	.mo-dialog::backdrop {
		/* Tonal scrim only — no drop shadow, no gradient (CONTRACT design DNA). */
		background: var(--mo-overlay-scrim);
	}
	.mo-dialog__panel {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
		padding: var(--mo-space-7);
		max-block-size: inherit;
		overflow-y: auto;
	}
	.mo-dialog__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--mo-space-4);
	}
	.mo-dialog__title {
		margin: 0;
		font-family: var(--mo-font-headline);
		font-size: var(--mo-type-6);
		line-height: var(--mo-leading-tight);
	}
	.mo-dialog__desc {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		line-height: var(--mo-leading-snug);
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-dialog__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		padding: var(--mo-space-2);
		margin: calc(-1 * var(--mo-space-2)); /* keep the glyph optically aligned */
		border: 0;
		border-radius: var(--mo-radius-full);
		background: transparent;
		color: var(--mo-overlay-on);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}
	.mo-dialog__close:hover {
		background: var(--mo-intent-neutral-surface);
	}
	.mo-dialog__close:focus-visible {
		outline: var(--mo-overlay-ring-width, var(--mo-ring-width)) solid
			var(--mo-overlay-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-overlay-ring-offset, var(--mo-ring-offset));
	}
	.mo-dialog__body {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
	}

	/*
	 * Enter transition. The platform top-layer element animates from `display:none`,
	 * so we transition `display` via `allow-discrete` and pair it with `overlay` so
	 * the leave keeps it in the top layer until the animation completes. The scrim
	 * fades; the panel scales and fades up. All gated by reduced-motion below.
	 */
	.mo-dialog {
		opacity: 0;
		translate: 0 0.5rem;
		scale: 0.98;
		transition:
			opacity 0.18s ease,
			translate 0.18s ease,
			scale 0.18s ease,
			display 0.18s allow-discrete,
			overlay 0.18s allow-discrete;
	}
	.mo-dialog[open] {
		opacity: 1;
		translate: 0 0;
		scale: 1;
	}
	@starting-style {
		.mo-dialog[open] {
			opacity: 0;
			translate: 0 0.5rem;
			scale: 0.98;
		}
	}
	.mo-dialog::backdrop {
		opacity: 0;
		transition:
			opacity 0.18s ease,
			display 0.18s allow-discrete,
			overlay 0.18s allow-discrete;
	}
	.mo-dialog[open]::backdrop {
		opacity: 1;
	}
	@starting-style {
		.mo-dialog[open]::backdrop {
			opacity: 0;
		}
	}

	/* Reduced motion: state still toggles, but no movement or fade timing. */
	@media (prefers-reduced-motion: reduce) {
		.mo-dialog,
		.mo-dialog[open],
		.mo-dialog::backdrop,
		.mo-dialog[open]::backdrop {
			transition: none;
			translate: none;
			scale: none;
		}
		.mo-dialog__close {
			transition: none;
		}
	}
</style>

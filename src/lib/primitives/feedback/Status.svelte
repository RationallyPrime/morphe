<script lang="ts">

	/*
	 * Status — a compact tone chip reporting the state of a thing.
	 *
	 * A11y (Lemma 1, WCAG 1.4.1): functional color is NEVER the only signal. The
	 * grammar makes `signal.text` REQUIRED, so the state is always carried by text.
	 * We additionally guarantee a SHAPE signal: an icon is rendered for every tone,
	 * falling back to a tone-appropriate glyph when the author omits one, so the
	 * meaning survives for monochrome / color-blind / low-vision readers. The tone
	 * is also reflected as `data-tone` for non-visual styling hooks.
	 *
	 * An inert chip carries `role="status"` so a change is announced politely. When
	 * `href` is present, the same chip is a native anchor (implicit link role and
	 * keyboard activation) with an explicit polite live region; the link role is
	 * never overwritten with `role="status"`.
	 *
	 * Context (Lemma 2): in a compact context the chip drops its surface fill and
	 * tightens to a text+icon run so dense toolbars do not fill with coloured pills
	 * — a discrete decision read from `ctx.density`. Type follows the boundary.
	 *
	 * Tokens (Lemma 3): scales -> intents -> slots only, via `toneIntent` + `slot`.
	 */

	import Gloss from "../../gloss/Gloss.svelte";
	import type { Status } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { SLOTS, slot, toneIntent } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<Status> = $props();

	const intent = $derived(toneIntent(node.tone));
	const on = $derived(slot(intent, "on"));
	const surface = $derived(slot(intent, "surface"));
	const border = $derived(slot(intent, "border"));
	const ring = $derived(SLOTS.focus.ring(intent));

	/* Tone -> default shape glyph, so the shape channel is never empty. */
	const DEFAULT_ICON: Record<Status["tone"], string> = {
		success: "check_circle",
		caution: "warning",
		info: "info",
		neutral: "circle",
	};
	const icon = $derived(node.signal.icon ?? DEFAULT_ICON[node.tone]);

	/* Discrete density decision: compact contexts render the quiet text+icon run. */
	const compact = $derived(ctx.density === "compact");
</script>

{#if node.href !== undefined}
	<a
		class="mo-status"
		href={node.href}
		aria-live="polite"
		aria-atomic="true"
		data-tone={node.tone}
		data-compact={compact}
		style:--mo-status-on={on}
		style:--mo-status-surface={surface}
		style:--mo-status-border={border}
		style:--mo-status-ring={ring}
	>
		<span class="mo-status__icon material-symbols-outlined" aria-hidden="true">{icon}</span>
		<span class="mo-status__text">{node.signal.text}</span>
	</a>
	{#if node.gloss}
		<Gloss label={node.signal.text} gloss={node.gloss} ink="var(--mo-intent-on-surface)" />
	{/if}
{:else}
	<span
		class="mo-status"
		role="status"
		data-tone={node.tone}
		data-compact={compact}
		style:--mo-status-on={on}
		style:--mo-status-surface={surface}
		style:--mo-status-border={border}
	>
		<span class="mo-status__icon material-symbols-outlined" aria-hidden="true">{icon}</span>
		<span class="mo-status__text">{node.signal.text}</span>
	</span>
	{#if node.gloss}
		<Gloss label={node.signal.text} gloss={node.gloss} ink="var(--mo-intent-on-surface)" />
	{/if}
{/if}

<style>
	.mo-status {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-1) var(--mo-space-3);
		border-radius: var(--mo-radius-2);
		background: var(--mo-status-surface);
		color: var(--mo-status-on);
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.04em;
		line-height: var(--mo-leading-tight);
	}
	/* Compact: shed the fill, keep an outline tick + text+icon — quieter in a dense
	   band. The text must NOT keep the on-surface ink (chosen for the filled chip):
	   on a transparent ground it loses contrast. Text takes the dialect's
	   contrast-guaranteed page ink; the tone stays triple-signaled via the icon
	   color, the glyph shape, and the outline ring. */
	.mo-status[data-compact="true"] {
		background: transparent;
		padding-inline: var(--mo-space-1);
		box-shadow: inset 0 0 0 1px var(--mo-status-border);
		color: var(--mo-intent-on-surface);
	}
	.mo-status__icon {
		font-size: 1.1em;
		flex: none;
	}
	.mo-status[data-compact="true"] .mo-status__icon {
		color: var(--mo-status-border);
	}
	.mo-status__text {
		white-space: nowrap;
	}
	a.mo-status {
		cursor: pointer;
		text-decoration: none;
	}
	a.mo-status .mo-status__text {
		text-decoration-line: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.18em;
	}
	a.mo-status:hover .mo-status__text {
		text-decoration-thickness: 2px;
	}
	a.mo-status:focus-visible {
		outline: var(--mo-ring-width) solid var(--mo-status-ring);
		outline-offset: var(--mo-ring-offset);
	}
	@media (forced-colors: active) {
		a.mo-status:focus-visible {
			outline-color: Highlight;
		}
	}
</style>

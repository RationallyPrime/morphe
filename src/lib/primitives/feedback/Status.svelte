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
	 * The chip carries `role="status"` so a change is announced politely; the text
	 * is the announced payload.
	 *
	 * Context (Lemma 2): in a compact context the chip drops its surface fill and
	 * tightens to a text+icon run so dense toolbars do not fill with coloured pills
	 * — a discrete decision read from `ctx.density`. Type follows the boundary.
	 *
	 * Tokens (Lemma 3): scales -> intents -> slots only, via `toneIntent` + `slot`.
	 */

	import type { Status } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { slot, toneIntent } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<Status> = $props();

	const intent = $derived(toneIntent(node.tone));
	const on = $derived(slot(intent, "on"));
	const surface = $derived(slot(intent, "surface"));
	const border = $derived(slot(intent, "border"));

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
	.mo-status[data-compact="true"] .mo-status__icon {
		color: var(--mo-status-border);
	}
	.mo-status__icon {
		font-size: 1.1em;
		flex: none;
	}
	.mo-status__text {
		white-space: nowrap;
	}
</style>

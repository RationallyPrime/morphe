<script lang="ts">

	/*
	 * InlineAlert — a banner-style message attached to the flow it concerns.
	 *
	 * A11y (Lemma 1, WCAG 1.4.1): functional color is NEVER the only signal. Tone
	 * is paired with a REQUIRED `title` (text) and a leading tone glyph (shape),
	 * and reflected as `data-tone` for non-visual styling. `live` selects the
	 * announcement politeness: "assertive" -> role="alert" (interrupts, for errors
	 * that must be heard now); "polite" -> role="status" (announced at the next
	 * idle point). The leading icon is decorative to AT — the container's role +
	 * the title text are the announced payload, so the icon must not double-speak.
	 *
	 * Context (Lemma 2): the banner reads the DISCRETE `density` from `ctx` to pick
	 * its internal padding step (a continuous value emitted as this boundary's own
	 * CSS var); body type follows the boundary's `--mo-ctx-type`.
	 *
	 * Tokens (Lemma 3): scales -> intents -> slots only. The tone resolves through
	 * `slot(tone, channel)` — tone names ARE core intents (success/caution/info).
	 */

	import type { InlineAlert } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { slot } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<InlineAlert> = $props();

	const on = $derived(slot(node.tone, "on"));
	const surface = $derived(slot(node.tone, "surface"));
	const border = $derived(slot(node.tone, "border"));

	const live = $derived(node.live ?? "polite");
	const role = $derived(live === "assertive" ? "alert" : "status");

	/* Tone -> shape glyph; the shape channel that color must never stand in for. */
	const ICON: Record<InlineAlert["tone"], string> = {
		success: "check_circle",
		caution: "error",
		info: "info",
	};
	const icon = $derived(ICON[node.tone]);

	/* Discrete density -> padding step (continuous value as this boundary's var). */
	const padStep = $derived(
		ctx.density === "compact"
			? "var(--mo-space-3)"
			: ctx.density === "spacious"
				? "var(--mo-space-6)"
				: "var(--mo-space-5)",
	);
</script>

<div
	class="mo-alert"
	{role}
	aria-live={live}
	data-tone={node.tone}
	style:--mo-alert-on={on}
	style:--mo-alert-surface={surface}
	style:--mo-alert-border={border}
	style:--mo-alert-pad={padStep}
>
	<span class="mo-alert__icon material-symbols-outlined" aria-hidden="true">{icon}</span>
	<div class="mo-alert__body">
		<p class="mo-alert__title">{node.title}</p>
		{#if node.detail}
			<p class="mo-alert__detail">{node.detail}</p>
		{/if}
	</div>
</div>

<style>
	.mo-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--mo-space-3);
		padding: var(--mo-alert-pad, var(--mo-space-5));
		border-radius: var(--mo-radius-2);
		background: var(--mo-alert-surface);
		color: var(--mo-alert-on);
		/* A grid/flex item refuses to shrink below its content min-size by
		   default, so an alert in a narrow track kept its longest token's width
		   (LIVE_VIOLATIONS…) and painted its tonal surface far over the
		   neighboring cell. A bare `min-inline-size: 0` swings the other way: a
		   squeezed fr/subgrid track then collapses the alert to zero (hidden).
		   Floor it at a readable fixed minimum instead — it compresses below
		   its content min-size (unbroken tokens wrap via `break-word`, which
		   unlike `anywhere` keeps intrinsic contributions intact) but never
		   out of existence, and any residual overflow is bounded by the floor,
		   not by token length. */
		min-inline-size: min(12rem, 100vw - 2 * var(--mo-space-5));
		overflow-wrap: break-word;
		/* Tone is carried by the tonal surface + the leading glyph (shape) + the
		   required title (text) — never a colored edge rule (DESIGN §9 side-stripe
		   ban). The glyph already IS the shape signal the rule was duplicating. */
	}
	.mo-alert__icon {
		font-size: var(--mo-type-6);
		line-height: var(--mo-leading-tight);
		flex: none;
		color: var(--mo-alert-border);
	}
	.mo-alert__body {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
		min-inline-size: 0;
	}
	.mo-alert__title {
		margin: 0;
		font-family: var(--mo-font-body);
		font-weight: 600;
		font-size: var(--mo-type-4);
		line-height: var(--mo-leading-snug);
	}
	.mo-alert__detail {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-3));
		line-height: var(--mo-leading-normal);
		color: var(--mo-alert-on);
		opacity: 0.85;
	}
</style>

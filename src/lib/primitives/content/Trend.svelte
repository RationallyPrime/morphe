<script lang="ts">

	/*
	 * Trend — a sampled quantity over a period axis (Content family leaf, ADR-0019).
	 *
	 * The REQUIRED `summary` is the primary channel: it renders as visible caption
	 * text, and the SVG figure is aria-hidden — the shape is an enhancement over
	 * the words, never the only signal (the same law Status obeys). The figure is
	 * a single ink stroke with a terminal dot on the latest value; no fills, no
	 * gradients, no ambient decoration.
	 *
	 * Geometric honesty rides `baseline`: "zero" (the default) anchors the y-axis
	 * at zero so amplitude is proportional truth; "min" is the authored variation
	 * lens for dense sparklines whose magnitude is carried elsewhere.
	 *
	 * Tokens: the stroke is UNFILLED INK on the page surface — it consumes the
	 * dialect's ink channel (`--mo-intent-<intent>-ink`, the Phase-0 contrast
	 * contract) and falls back to the guaranteed on-surface ink where a dialect
	 * predates the channel. It never reads an intent's `surface` or `on` channel
	 * as freestanding stroke color (the audit's P0 contrast class).
	 *
	 * Emphasis is the parent's GRANT (ctx.renderedEmphasis) and modulates stroke
	 * weight — a non-color channel.
	 *
	 * Agent edits ONLY this file.
	 */

	import type { Trend } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";

	let { node, ctx }: PrimitiveProps<Trend> = $props();

	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");
	const baseline = $derived(node.baseline ?? "zero");

	/**
	 * Unfilled ink: the intent's ink channel, falling back to on-surface ink.
	 * A muted grant tones the whole figure through the muted ink (computed here
	 * so the grant beats the inline custom property — the Text.svelte contract).
	 */
	const ink = $derived(
		emphasis === "muted"
			? "var(--mo-intent-on-surface-muted)"
			: node.intent
				? `var(--mo-intent-${node.intent}-ink, var(--mo-intent-on-surface))`
				: "var(--mo-intent-on-surface)",
	);

	const VIEW_W = 100;
	const VIEW_H = 32;
	const PAD = 3; // keeps the stroke and terminal dot inside the viewBox

	interface Projected {
		readonly x: number;
		readonly y: number;
	}

	/** Project the typed series into viewBox space. Pure geometry — no derivation. */
	const projected = $derived.by((): readonly Projected[] => {
		const points = node.points;
		if (points.length === 0) return [];
		const values = points.map((p) => p.value);
		const max = Math.max(...values, baseline === "zero" ? 0 : Number.NEGATIVE_INFINITY);
		const min = baseline === "zero" ? Math.min(0, ...values) : Math.min(...values);
		const span = max - min;
		const innerW = VIEW_W - 2 * PAD;
		const innerH = VIEW_H - 2 * PAD;
		const step = points.length > 1 ? innerW / (points.length - 1) : 0;
		return points.map((point, index) => ({
			x: PAD + (points.length > 1 ? index * step : innerW / 2),
			// A flat series (span 0) draws mid-height: honest, not dramatic.
			y: PAD + (span > 0 ? (1 - (point.value - min) / span) * innerH : innerH / 2),
		}));
	});

	const path = $derived(
		projected.length > 1
			? projected
					.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
					.join(" ")
			: undefined,
	);
	const terminal = $derived(projected.at(-1));
</script>

<div class="mo-trend" data-emphasis={emphasis} style:--mo-trend-ink={ink}>
	{#if projected.length > 0}
		<!-- The figure is decorative to AT: the summary text IS the announced payload. -->
		<svg
			class="mo-trend__figure"
			viewBox="0 0 {VIEW_W} {VIEW_H}"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			{#if path}
				<path class="mo-trend__line" d={path} fill="none" vector-effect="non-scaling-stroke" />
			{/if}
			{#if terminal}
				<!-- The terminal dot is a zero-length round-capped stroke: under the
				     non-uniform viewBox stretch a <circle> would smear into an
				     ellipse; a non-scaling stroke cap stays a perfect dot. -->
				<path
					class="mo-trend__dot"
					d="M{terminal.x.toFixed(2)} {terminal.y.toFixed(2)} l0.0001 0"
					fill="none"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
		</svg>
	{/if}
	<small class="mo-trend__summary">{node.summary}</small>
</div>

<style>
	.mo-trend {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
		inline-size: 100%;
	}

	.mo-trend__figure {
		inline-size: 100%;
		/* Height rides the context type step so a trend in a compact list stays
		   proportionate to the text around it — intent, not pixels. */
		block-size: calc(var(--mo-ctx-type, var(--mo-type-4)) * 2.25);
		overflow: visible;
	}

	.mo-trend__figure path {
		stroke: var(--mo-trend-ink);
		stroke-width: 1.5px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mo-trend__dot {
		stroke-width: 4px;
	}

	/* The paired words: caption register, same law as Status text. */
	.mo-trend__summary {
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-2);
		line-height: var(--mo-leading-snug);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
	}

	/* Emphasis is weight (a non-color channel): the stroke thickens, the ink
	   never changes hue. The muted grant rides the computed ink above. */
	.mo-trend[data-emphasis="strong"] .mo-trend__line {
		stroke-width: 2px;
	}
	.mo-trend[data-emphasis="critical"] .mo-trend__line {
		stroke-width: 2.5px;
	}
</style>

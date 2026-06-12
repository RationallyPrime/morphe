<script lang="ts">

	/*
	 * Number — a formatted numeric value (Content family leaf).
	 *
	 * Locale-aware: formatting resolves at render via `Intl.NumberFormat` with the
	 * platform default locale (the host app sets the document locale; SSR and the
	 * client agree because both read `undefined` -> the runtime default). Figures
	 * are tabular (`tnum`) so columns of numbers align.
	 *
	 * Like Text, a leaf reads its size from the boundary `--mo-ctx-type` (which
	 * encodes scale_tier) and renders the emphasis its Layout parent GRANTED it
	 * (`ctx.renderedEmphasis`, the renormalized result), not a raw claim. Emphasis
	 * rides weight, a non-color channel, so functional color is never the sole signal.
	 *
	 * Agent edits ONLY this file.
	 */

	import type { NumberNode } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { SURFACE_VARS } from "../../tokens/intents.js";
	import { slot } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<NumberNode> = $props();

	// Render the emphasis the Layout parent GRANTED this leaf (the renormalized
	// result), not a raw claim or a per-leaf self-clamp. Absent ⇒ normal baseline.
	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");
	const color = $derived(node.intent ? slot(node.intent, "on") : `var(${SURFACE_VARS.on})`);

	/** Locale-aware formatting. The default locale is the runtime's (host-driven). */
	function format(n: NumberNode): string {
		switch (n.format ?? "plain") {
			case "integer":
				return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n.value);
			case "currency":
				return new Intl.NumberFormat(undefined, {
					style: "currency",
					currency: n.currency ?? "ISK",
					currencyDisplay: "narrowSymbol",
				}).format(n.value);
			case "percent":
				return new Intl.NumberFormat(undefined, {
					style: "percent",
					maximumFractionDigits: 1,
				}).format(n.value);
			case "compact":
				return new Intl.NumberFormat(undefined, {
					notation: "compact",
					maximumFractionDigits: 1,
				}).format(n.value);
			default:
				return new Intl.NumberFormat(undefined).format(n.value);
		}
	}

	const formatted = $derived(format(node));
	/** Sign as a non-color shape signal so a negative reads without relying on color. */
	const sign = $derived(node.value < 0 ? "negative" : node.value > 0 ? "positive" : "zero");
</script>

<span class="mo-number" data-emphasis={emphasis} data-sign={sign} style:color={color}>{formatted}</span>

<style>
	.mo-number {
		font-family: var(--mo-font-mono);
		/* Tabular, lining figures so numeric columns align. */
		font-feature-settings: "tnum" 1, "lnum" 1;
		font-variant-numeric: tabular-nums lining-nums;
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-snug);
		color: var(--mo-intent-on-surface);
		white-space: nowrap;
	}

	/* Emphasis as weight (non-color channel). */
	.mo-number[data-emphasis="muted"] {
		/* biome-ignore lint/complexity/noImportantStyles: muted must beat the inline intent color — same contract as Text. */
		color: var(--mo-intent-on-surface-muted) !important;
	}
	.mo-number[data-emphasis="strong"] {
		font-weight: 600;
	}
	.mo-number[data-emphasis="critical"] {
		font-weight: 700;
	}
</style>

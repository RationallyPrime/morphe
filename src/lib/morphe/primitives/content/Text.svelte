<script lang="ts">

	/*
	 * Text — semantic text content (Content family leaf).
	 *
	 * A leaf reads its position from `ctx` and the continuous values the nearest
	 * Layout ancestor emitted as `--mo-ctx-*` CSS vars; it never descends and never
	 * names a scale or a raw value directly. Size flows through the type scale via
	 * the boundary's `--mo-ctx-type` (which already encodes scale_tier); the
	 * semantic `as` level modulates that tier with a relative step (Lemma 2: "the
	 * algebra maps `as` onto the type scale + tier").
	 *
	 * Headings vs body are a Text concern (the `as` prop), not separate primitives.
	 *
	 * Emphasis is a CLAIM the Layout parent renormalizes against the budget B (the
	 * one place the whole sibling set + B are in scope); this leaf renders the
	 * emphasis it was GRANTED, carried on `ctx.renderedEmphasis`, not its raw claim.
	 * Locality holds — it reads only its own resolved ctx.
	 *
	 * Intent contributes color only; functional color is never the only signal, so
	 * emphasis is also carried by weight (a non-color channel).
	 *
	 * Agent edits ONLY this file.
	 */

	import type { Text } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { SURFACE_VARS } from "../../tokens/intents.js";
	import { slot } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<Text> = $props();

	const as = $derived(node.as ?? "body");

	// Render the emphasis the Layout parent GRANTED this leaf (it renormalized the
	// sibling set against B). No per-leaf self-clamp: that duplicated the law with
	// less information. Absent grant (standalone render) ⇒ the normal baseline.
	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");

	/**
	 * Color comes from the intent's `on` channel; with no intent we read the base
	 * on-surface var. A muted claim overrides to the muted on-surface tone (handled
	 * in CSS so an explicit intent color still wins for non-muted claims).
	 */
	const color = $derived(node.intent ? slot(node.intent, "on") : `var(${SURFACE_VARS.on})`);

	/** Line clamp: author intent (a line count), not a pixel height. */
	const clampLines = $derived(node.clamp && node.clamp > 0 ? node.clamp : undefined);
</script>

{#if as === "display"}
	<h1 class="mo-text" data-as={as} data-emphasis={emphasis} style:color={color} style:--mo-text-clamp={clampLines}>
		{node.value}
	</h1>
{:else if as === "heading"}
	<h2 class="mo-text" data-as={as} data-emphasis={emphasis} style:color={color} style:--mo-text-clamp={clampLines}>
		{node.value}
	</h2>
{:else if as === "subheading"}
	<h3 class="mo-text" data-as={as} data-emphasis={emphasis} style:color={color} style:--mo-text-clamp={clampLines}>
		{node.value}
	</h3>
{:else if as === "caption"}
	<small class="mo-text" data-as={as} data-emphasis={emphasis} style:color={color} style:--mo-text-clamp={clampLines}>
		{node.value}
	</small>
{:else}
	<p class="mo-text" data-as={as} data-emphasis={emphasis} style:color={color} style:--mo-text-clamp={clampLines}>
		{node.value}
	</p>
{/if}

<style>
	/*
	 * Base: body register. `--mo-ctx-type` is the tier-driven step the nearest
	 * Layout boundary emitted; with no boundary it falls back to the body step.
	 * Semantic levels modulate that step with a relative multiplier and a `clamp()`
	 * so a heading in a quiet (deep / demoted) context still out-sizes body, while
	 * a heading at top tier is allowed to reach the display register.
	 */
	.mo-text {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-normal);
		color: var(--mo-intent-on-surface);
		text-wrap: pretty;
	}

	/* Headline register: engraved serif display family (Bodoni Moda), tight leading. */
	.mo-text[data-as="display"],
	.mo-text[data-as="heading"] {
		font-family: var(--mo-font-headline);
		line-height: var(--mo-leading-tight);
		letter-spacing: -0.005em;
		text-wrap: balance;
	}
	/* Subheadings drop to the body sans: a high-contrast didone goes spindly at
	   small sizes, and the serif-display / sans-subhead split is the type rhythm. */
	.mo-text[data-as="subheading"] {
		font-family: var(--mo-font-body);
		line-height: var(--mo-leading-snug);
		letter-spacing: -0.005em;
		text-wrap: balance;
	}

	/*
	 * `as` modulation. The local tier (`--mo-ctx-type`) is the floor; the semantic
	 * ceiling is the corresponding type-scale step. `clamp()` keeps the level from
	 * collapsing into body in a demoted context yet bounds it in a generous one.
	 */
	.mo-text[data-as="display"] {
		/* The vw slope is tuned so display actually REACHES the --mo-type-8
		   ceiling on real desktop widths (~1620px and up); at 1.4vw it only got
		   there past 2700px, leaving every wide hero undersized against the
		   documented ramp (DESIGN §4). */
		font-size: clamp(var(--mo-ctx-type, var(--mo-type-4)), calc(var(--mo-ctx-type, var(--mo-type-4)) * 1.5 + 2.4vw), var(--mo-type-8));
		font-weight: 500;
	}
	.mo-text[data-as="heading"] {
		font-size: clamp(var(--mo-ctx-type, var(--mo-type-4)), calc(var(--mo-ctx-type, var(--mo-type-4)) * 1.15), var(--mo-type-7));
		font-weight: 500;
	}
	.mo-text[data-as="subheading"] {
		font-size: clamp(var(--mo-type-5), var(--mo-ctx-type, var(--mo-type-5)), var(--mo-type-6));
		font-weight: 600;
	}
	.mo-text[data-as="body"] {
		font-size: clamp(var(--mo-type-3), var(--mo-ctx-type, var(--mo-type-4)), var(--mo-type-5));
		max-inline-size: 68ch;
	}
	.mo-text[data-as="caption"] {
		display: block;
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-2);
		line-height: var(--mo-leading-snug);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
	}

	/*
	 * Emphasis — a non-color channel (weight) so functional color is never the only
	 * signal. `muted` also tones the color down; a non-muted intent color set
	 * inline still wins because only `muted` forces the override.
	 */
	.mo-text[data-emphasis="muted"] {
		/* biome-ignore lint/complexity/noImportantStyles: muted must beat the inline intent color (see comment above) — the override is the contract. */
		color: var(--mo-intent-on-surface-muted) !important;
		font-weight: 400;
	}
	.mo-text[data-emphasis="strong"] {
		font-weight: 600;
	}
	.mo-text[data-emphasis="critical"] {
		font-weight: 700;
	}

	/* An empty text node (an omitted optional kicker/eyebrow/lede default) collapses
	   to nothing instead of leaving an empty line — so a presenter can drop a kicker
	   by simply not passing it, without an empty <small> reserving space. */
	.mo-text:empty {
		display: none;
	}

	/* Line clamp (author intent: a line count). Unset -> no clamp. */
	.mo-text[style*="--mo-text-clamp"] {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: var(--mo-text-clamp);
		line-clamp: var(--mo-text-clamp);
		overflow: hidden;
	}
</style>

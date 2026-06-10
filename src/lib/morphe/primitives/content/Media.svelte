<script lang="ts">

	/*
	 * Media — an image (Content family leaf).
	 *
	 * Accessibility is REQUIRED: `alt` is mandatory in the grammar, and an empty
	 * string is the EXPLICIT decorative opt-out (an `<img alt="">` is correctly
	 * treated as presentational by assistive tech). There is no way to author a
	 * meaningful image with no alternative text.
	 *
	 * Aspect is author intent, not pixels — it compiles to an `aspect-ratio` with
	 * `object-fit: cover` so the frame is stable before the bitmap loads. Depth is
	 * tonal (a sunken placeholder surface), never a drop shadow, and the corner is
	 * the radius scale. Images load lazily and decode off the main thread.
	 *
	 * Agent edits ONLY this file.
	 */

	import type { Media } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";

	let { node }: PrimitiveProps<Media> = $props();

	const aspect = $derived(node.aspect ?? "auto");
	/* An empty alt is the explicit decorative opt-out; hide it from AT entirely. */
	const decorative = $derived(node.alt === "");
</script>

<img
	class="mo-media"
	data-aspect={aspect}
	src={node.src}
	alt={node.alt}
	aria-hidden={decorative ? "true" : undefined}
	loading="lazy"
	decoding="async"
	draggable="false"
/>

<style>
	.mo-media {
		display: block;
		inline-size: 100%;
		max-inline-size: 100%;
		block-size: auto;
		border-radius: var(--mo-radius-2);
		/* Tonal placeholder while loading — depth via surface, never a shadow. */
		background-color: var(--mo-intent-surface-sunken);
		object-fit: cover;
		object-position: center;
	}
	.mo-media[data-aspect="square"] {
		aspect-ratio: 1 / 1;
	}
	.mo-media[data-aspect="video"] {
		aspect-ratio: 16 / 9;
	}
	.mo-media[data-aspect="portrait"] {
		aspect-ratio: 3 / 4;
	}
	/* aspect:auto — intrinsic ratio, height tracks the bitmap. */
	.mo-media[data-aspect="auto"] {
		block-size: auto;
	}
</style>

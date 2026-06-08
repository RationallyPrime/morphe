<script lang="ts">
	/*
	 * Media — an image with REQUIRED alt text (empty string = explicit decorative).
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Media } from "../../grammar/types.js";

	let { node }: PrimitiveProps<Media> = $props();
	const aspect = $derived(node.aspect ?? "auto");
</script>

<img class="mo-media" data-aspect={aspect} src={node.src} alt={node.alt} />

<style>
	.mo-media {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: var(--mo-radius-2);
	}
	.mo-media[data-aspect="square"] {
		aspect-ratio: 1 / 1;
		object-fit: cover;
	}
	.mo-media[data-aspect="video"] {
		aspect-ratio: 16 / 9;
		object-fit: cover;
	}
	.mo-media[data-aspect="portrait"] {
		aspect-ratio: 3 / 4;
		object-fit: cover;
	}
</style>

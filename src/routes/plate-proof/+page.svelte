<script lang="ts">
	import { MorpheRoot } from "$lib/components";
	import { plateProofTree } from "./tree.js";
</script>

<svelte:head>
	<title>Plate Proof | Morphe</title>
	<meta
		name="description"
		content="Responsive Timaeus plate derivative proof rendered through the Morphe Media primitive."
	/>
</svelte:head>

<section class="plate-proof">
	<div class="plate-proof__inner">
		<MorpheRoot tree={plateProofTree} />
	</div>
</section>

<style>
	.plate-proof {
		padding: clamp(var(--mo-space-6), 7vw, var(--mo-space-9))
			clamp(var(--mo-space-4), 5vw, var(--mo-space-8));
	}
	.plate-proof__inner {
		max-inline-size: 78rem;
		margin-inline: auto;
	}
	.plate-proof :global(.mo-root) {
		background: transparent;
	}
</style>

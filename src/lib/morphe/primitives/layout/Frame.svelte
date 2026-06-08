<script lang="ts">
	/*
	 * Frame — context RESET (the analogue of a new stacking context). The ONLY
	 * primitive permitted to re-root depth, reset scale tier, re-grant budget, and
	 * change the surface (Monotone-depth law's escape hatch).
	 * STUB: structurally complete. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Frame } from "../../grammar/types.js";
	import { descendFrame, boundaryStyle } from "../../context/Context.svelte.js";
	import Node from "../../render/Node.svelte";

	let { node }: PrimitiveProps<Frame> = $props();

	// Frame is the one context RESET. Computed once at init (setContext
	// requirement); the tree is immutable per <Node> instance.
	// svelte-ignore state_referenced_locally
	const child = descendFrame({
		surface: node.surface,
		density: node.density,
		budget: node.budget,
	});
	const surface = $derived(node.surface ?? "base");
	const childStyle = $derived(boundaryStyle(child));
</script>

<section class="mo-frame" data-surface={surface} data-role={node.role} style={childStyle}>
	{#each node.children as c (c)}
		<Node node={c} ctx={child} />
	{/each}
</section>

<style>
	.mo-frame {
		container-type: inline-size;
		background: var(--mo-ctx-surface);
		color: var(--mo-intent-on-surface);
		padding: var(--mo-ctx-space);
		border-radius: var(--mo-radius-2);
	}
</style>

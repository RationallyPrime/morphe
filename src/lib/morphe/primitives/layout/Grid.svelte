<script lang="ts">
	/*
	 * Grid — auto-fitting track grid (Layout role).
	 * STUB: structurally complete. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Grid } from "../../grammar/types.js";
	import { descend, boundaryStyle } from "../../context/Context.svelte.js";
	import Node from "../../render/Node.svelte";

	let { node }: PrimitiveProps<Grid> = $props();

	// Structural context decision computed once at init (setContext requirement);
	// the tree is immutable per <Node> instance. See Stack.svelte for the rule.
	// svelte-ignore state_referenced_locally
	const child = descend(node.role, {
		childCount: node.children.length,
		claim: node.emphasis,
	});
	const minTrack = $derived(node.minTrack ?? "regular");
	const childStyle = $derived(boundaryStyle(child));
</script>

<div class="mo-grid" data-min-track={minTrack} data-role={node.role} style={childStyle}>
	{#each node.children as c (c)}
		<Node node={c} ctx={child} />
	{/each}
</div>

<style>
	.mo-grid {
		display: grid;
		gap: var(--mo-ctx-space);
		grid-template-columns: repeat(auto-fit, minmax(var(--mo-track, 16rem), 1fr));
	}
	.mo-grid[data-min-track="narrow"] {
		--mo-track: 10rem;
	}
	.mo-grid[data-min-track="regular"] {
		--mo-track: 16rem;
	}
	.mo-grid[data-min-track="wide"] {
		--mo-track: 24rem;
	}
</style>

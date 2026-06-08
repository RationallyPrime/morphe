<script lang="ts">
	/*
	 * Cluster — wrapping inline run (Layout role); the default for inline content.
	 * STUB: structurally complete. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Cluster } from "../../grammar/types.js";
	import { descend, boundaryStyle } from "../../context/Context.svelte.js";
	import Node from "../../render/Node.svelte";

	let { node }: PrimitiveProps<Cluster> = $props();

	// Structural context decision computed once at init (setContext requirement);
	// the tree is immutable per <Node> instance. See Stack.svelte for the rule.
	// svelte-ignore state_referenced_locally
	const child = descend(node.role, {
		childCount: node.children.length,
		claim: node.emphasis,
	});
	const justify = $derived(node.justify ?? "start");
	const align = $derived(node.align ?? "center");
	const childStyle = $derived(boundaryStyle(child));
</script>

<div
	class="mo-cluster"
	data-justify={justify}
	data-align={align}
	data-role={node.role}
	style={childStyle}
>
	{#each node.children as c (c)}
		<Node node={c} ctx={child} />
	{/each}
</div>

<style>
	.mo-cluster {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-ctx-space);
	}
	.mo-cluster[data-justify="center"] {
		justify-content: center;
	}
	.mo-cluster[data-justify="end"] {
		justify-content: flex-end;
	}
	.mo-cluster[data-justify="between"] {
		justify-content: space-between;
	}
	.mo-cluster[data-align="start"] {
		align-items: flex-start;
	}
	.mo-cluster[data-align="end"] {
		align-items: flex-end;
	}
	.mo-cluster[data-align="baseline"] {
		align-items: baseline;
	}
</style>

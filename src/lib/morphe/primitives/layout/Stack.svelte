<script lang="ts">
	/*
	 * Stack — block/inline/auto flow container (Layout role).
	 *
	 * STUB: structurally complete (descends context, emits boundary vars, renders
	 * children). A primitive agent may enrich the markup/styling but MUST keep:
	 *   - the `descend(node.role, …)` call that provides child context,
	 *   - the boundary CSS vars on the root element,
	 *   - the recursion into <Node> with the child ctx.
	 * Agent edits ONLY this file. Do not touch grammar/types.ts, registry, tokens.
	 *
	 * `direction: "auto"` flips axis with a container query (Lemma 2) — no JS.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Stack } from "../../grammar/types.js";
	import { descend, boundaryStyle } from "../../context/Context.svelte.js";
	import Node from "../../render/Node.svelte";

	let { node }: PrimitiveProps<Stack> = $props();

	// A server-driven tree is immutable per <Node> instance: a changed tree
	// mounts new keyed components. The structural context decision is computed
	// once at init (setContext must run during init anyway), so reading `node`
	// here is intentional. Template-consumed values are $derived for reactivity.
	// svelte-ignore state_referenced_locally
	const child = descend(node.role, {
		childCount: node.children.length,
		claim: node.emphasis,
	});
	const dir = $derived(node.direction ?? "auto");
	const childStyle = $derived(boundaryStyle(child));
</script>

<div class="mo-stack" data-direction={dir} data-role={node.role} style={childStyle}>
	{#each node.children as c (c)}
		<Node node={c} ctx={child} />
	{/each}
</div>

<style>
	.mo-stack {
		display: flex;
		flex-direction: column;
		gap: var(--mo-ctx-space);
	}
	.mo-stack[data-direction="inline"] {
		flex-direction: row;
	}
	/* direction:auto — flip to a row when the container is wide enough. */
	.mo-stack[data-direction="auto"] {
		flex-direction: column;
	}
	@container (min-width: 32rem) {
		.mo-stack[data-direction="auto"] {
			flex-direction: row;
		}
	}
</style>

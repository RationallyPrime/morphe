<script lang="ts">
	/*
	 * Cluster — a wrapping inline run (Layout role); the default carrier for inline
	 * content (badges, chips, a toolbar of controls, tag rows).
	 *
	 * It lays children out in a row that WRAPS, with the inter-item gap riding the
	 * density→space boundary var so a crowded cluster tightens automatically
	 * (STABILITY: density steps only when childCount crosses a threshold, decided in
	 * `descend`). `justify` and `align` are author intent mapped onto flexbox
	 * alignment; the maps live here, not scattered, so the enum is exhaustive and a
	 * new value would surface as a missing branch.
	 *
	 * Context descent + boundary vars + recursion are preserved exactly. No pixels,
	 * no raw scale, no functional color — pure positioning.
	 *
	 * Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Cluster } from "../../grammar/types.js";
	import { descend, boundaryStyle } from "../../context/Context.svelte.js";
	import Node from "../../render/Node.svelte";

	let { node, ctx }: PrimitiveProps<Cluster> = $props();

	// One-time structural descent at init (setContext requirement); the tree is
	// immutable per <Node> instance. Descends from the explicit `ctx` PROP (the
	// real carrier on SSR and first client render); seeds the context channel as a
	// fallback. See Stack.svelte for the rule.
	// svelte-ignore state_referenced_locally
	const child = descend(
		node.role,
		{
			childCount: node.children.length,
			claim: node.emphasis,
		},
		ctx,
	);

	const justify = $derived(node.justify ?? "start");
	const align = $derived(node.align ?? "center");
	const emphasis = $derived(node.emphasis ?? "normal");
	const childStyle = $derived(boundaryStyle(child));
</script>

<div
	class="mo-cluster"
	data-justify={justify}
	data-align={align}
	data-role={node.role}
	data-emphasis={emphasis}
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
		gap: var(--mo-ctx-space, var(--mo-space-5));
		/* Defaults; overridden by the data-attr maps below. */
		justify-content: flex-start;
		align-items: center;
	}

	/* justify intent → main-axis distribution. */
	.mo-cluster[data-justify="start"] {
		justify-content: flex-start;
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

	/* align intent → cross-axis alignment. */
	.mo-cluster[data-align="start"] {
		align-items: flex-start;
	}
	.mo-cluster[data-align="center"] {
		align-items: center;
	}
	.mo-cluster[data-align="end"] {
		align-items: flex-end;
	}
	.mo-cluster[data-align="baseline"] {
		align-items: baseline;
	}

	/*
	 * Renormalized emphasis as a data attribute — neutral separation only, never
	 * functional color (a layout primitive doesn't signal status).
	 */
	.mo-cluster[data-emphasis="strong"],
	.mo-cluster[data-emphasis="critical"] {
		gap: var(--mo-ctx-space, var(--mo-space-5));
	}
</style>

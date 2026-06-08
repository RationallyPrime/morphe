<script lang="ts">
	/*
	 * Grid — an auto-fitting track grid (Layout role).
	 *
	 * The author emits INTENT, not pixels: `minTrack ∈ narrow|regular|wide`. The
	 * primitive compiles that intent into a track floor and lets the browser pack
	 * as many equal columns as fit (`auto-fit` + `minmax(floor, 1fr)`), collapsing
	 * to a single column when the container is narrower than one track. Because the
	 * floor is the only geometry and it is expressed in `rem`, the grid is fluid
	 * and density-aware (gap rides the boundary var) with no media queries and no
	 * JS — the responsiveness is a property of the container, via the track floor
	 * and the nearest container-type ancestor.
	 *
	 * Context descent + boundary vars + recursion are preserved exactly. Gap is the
	 * density→space boundary var; the track floor is the only primitive-owned
	 * length, and it is a named intent step, never a raw scale an author touches.
	 *
	 * Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Grid } from "../../grammar/types.js";
	import { descend, boundaryStyle } from "../../context/Context.svelte.js";
	import Node from "../../render/Node.svelte";

	let { node }: PrimitiveProps<Grid> = $props();

	// One-time structural descent at init (setContext requirement); the tree is
	// immutable per <Node> instance. See Stack.svelte for the rule.
	// svelte-ignore state_referenced_locally
	const child = descend(node.role, {
		childCount: node.children.length,
		claim: node.emphasis,
	});

	const minTrack = $derived(node.minTrack ?? "regular");
	const emphasis = $derived(node.emphasis ?? "normal");
	const childStyle = $derived(boundaryStyle(child));
</script>

<div
	class="mo-grid"
	data-min-track={minTrack}
	data-role={node.role}
	data-emphasis={emphasis}
	style={childStyle}
>
	{#each node.children as c (c)}
		<Node node={c} ctx={child} />
	{/each}
</div>

<style>
	.mo-grid {
		display: grid;
		gap: var(--mo-ctx-space, var(--mo-space-5));
		/*
		 * auto-fit packs as many equal 1fr columns as fit at or above the floor,
		 * and collapses to one column below it — fluid by construction. min() with
		 * 100% keeps a single oversized track from overflowing a narrow container
		 * (the classic auto-fit overflow bug). --mo-track is the compiled intent.
		 */
		grid-template-columns: repeat(auto-fit, minmax(min(var(--mo-track, 16rem), 100%), 1fr));
		/* Items stretch to fill their track height so cards in a row align. */
		align-items: stretch;
	}

	/* minTrack intent → a track floor (rem, so it scales with root font size). */
	.mo-grid[data-min-track="narrow"] {
		--mo-track: 10rem;
	}
	.mo-grid[data-min-track="regular"] {
		--mo-track: 16rem;
	}
	.mo-grid[data-min-track="wide"] {
		--mo-track: 24rem;
	}

	/*
	 * Renormalized emphasis reaches the grid as a data attribute. A layout
	 * primitive only adjusts neutral separation, never functional color — an
	 * emphasized grid breathes a little more so it reads as a distinct band.
	 */
	.mo-grid[data-emphasis="strong"],
	.mo-grid[data-emphasis="critical"] {
		gap: var(--mo-ctx-space, var(--mo-space-5));
	}
</style>

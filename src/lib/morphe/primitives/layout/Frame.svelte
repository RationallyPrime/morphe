<script lang="ts">
	/*
	 * Frame — the context RESET (Layout role). The analogue of a new stacking
	 * context, and the ONLY primitive permitted to:
	 *   - re-root depth and reset scale tier upward (Monotone-depth law's escape
	 *     hatch — every non-Frame transform may only LOWER the tier);
	 *   - re-grant the emphasis budget B for its subtree;
	 *   - change the painted surface (base / raised / sunken).
	 *
	 * It is also the COMPOSITION BOUNDARY for browser-visible flex: it establishes
	 * `container-type: inline-size`, so a `direction:"auto"` Stack inside it flips
	 * against the Frame's own inline size, not the viewport. That is what makes the
	 * auto-flip compositional (a Frame in a narrow column stays narrow) rather than
	 * global, with no JS.
	 *
	 * Depth is expressed as TONAL SURFACE LAYERING, never drop shadows (the Archive
	 * rule). Because tone alone is a color-only signal, the Frame pairs surface
	 * separation with a low-opacity ghost OUTLINE (outline-variant) — a non-color
	 * cue available to users who can't perceive the tonal step, and the one place
	 * the design system permits a hairline border (accessibility only, not
	 * sectioning). The surface→on-color pairing keeps text contrast correct after a
	 * surface change.
	 *
	 * Context reset + boundary vars + recursion are preserved exactly. Padding and
	 * gap ride the density boundary var; radius is a named scale step; no pixels.
	 *
	 * Agent edits ONLY this file.
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
		/* Composition boundary: container queries below this read THIS frame's
		   inline size, so a direction:auto Stack flips against the frame. */
		container-type: inline-size;

		/* Surface comes from the reset context's boundary var; the on-surface color
		   travels with it so contrast stays correct after a surface change. */
		background: var(--mo-ctx-surface, var(--mo-intent-surface-base));
		color: var(--mo-intent-on-surface);

		/* Density-driven internal rhythm; no hardcoded geometry. */
		padding: var(--mo-ctx-space, var(--mo-space-5));
		border-radius: var(--mo-radius-2);

		/* min-width:0 so a frame inside a flex/grid track can shrink instead of
		   forcing overflow. Positioning hygiene, not a geometry decision. */
		min-inline-size: 0;
	}

	/*
	 * A base frame sits on the base surface with no surface step, so it draws no
	 * box — sectioning is by background tone alone (the Archive rule: no 1px borders
	 * for sectioning). Only a surface CHANGE (raised/sunken) gets the non-color cue.
	 */

	/*
	 * Surface variants. A sunken surface reads as a well, a raised one as a card —
	 * both via tone steps (the neutral elevation ramp behind the intent vars). Each
	 * pairs its tonal step with a low-opacity ghost OUTLINE so the boundary is
	 * perceivable WITHOUT relying on the color step (WCAG 1.4.1). `outline` (not
	 * `border`) stays off the box model, so it never shifts the density padding.
	 * This is the accessibility-only hairline the design system permits — never
	 * sectioning on its own.
	 */
	.mo-frame[data-surface="sunken"],
	.mo-frame[data-surface="raised"] {
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
	.mo-frame[data-surface="sunken"] {
		background: var(--mo-ctx-surface, var(--mo-intent-surface-sunken));
	}
	.mo-frame[data-surface="raised"] {
		background: var(--mo-ctx-surface, var(--mo-intent-surface-raised));
	}
</style>

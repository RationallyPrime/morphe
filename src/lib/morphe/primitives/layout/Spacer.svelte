<script lang="ts">
	/*
	 * Spacer — explicit, intentional space. A LEAF Layout primitive: no children,
	 * no context descent (it positions nothing, it only occupies space), so it does
	 * NOT call `descend` and does NOT emit boundary vars.
	 *
	 * The author emits a named size INTENT (xs..xl); the primitive compiles it onto
	 * the space scale. It is axis-agnostic by construction: inside a flex parent the
	 * size governs the MAIN axis via `flex-basis` (so it pushes vertically in a
	 * column Stack and horizontally in a row Cluster, with no knowledge of the
	 * parent's direction). The cross axis is left to collapse so a Spacer never
	 * widens or heightens its siblings.
	 *
	 * It is purely decorative whitespace, so it is `aria-hidden` and `presentation`
	 * — it must never announce to assistive tech or absorb focus.
	 *
	 * No raw scale is touched by the author; `size` is a bounded intent step. The
	 * primitive itself maps that step onto the neutral space scale (the one place a
	 * leaf may reference it, exactly as the original stub did).
	 *
	 * Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Spacer } from "../../grammar/types.js";

	let { node }: PrimitiveProps<Spacer> = $props();
	const size = $derived(node.size ?? "md");
</script>

<div class="mo-spacer" data-size={size} role="presentation" aria-hidden="true"></div>

<style>
	.mo-spacer {
		/* --mo-spacer-size is set per size step below; flex-basis makes it govern the
		   MAIN axis in EITHER flex direction (vertical in a column Stack, horizontal
		   in a row Cluster) with no knowledge of the parent's direction. grow/shrink
		   pinned to 0 → a rigid spacer, not an elastic filler. This is the canonical
		   axis-agnostic spacer technique; the cross axis is left to collapse so the
		   Spacer never enlarges its siblings on the other axis. Spacers live inside
		   the flex-based layout primitives, so this is the load-bearing path. */
		flex: 0 0 var(--mo-spacer-size, var(--mo-space-5));
	}

	/* size intent → space-scale step. */
	.mo-spacer[data-size="xs"] {
		--mo-spacer-size: var(--mo-space-2);
	}
	.mo-spacer[data-size="sm"] {
		--mo-spacer-size: var(--mo-space-3);
	}
	.mo-spacer[data-size="md"] {
		--mo-spacer-size: var(--mo-space-5);
	}
	.mo-spacer[data-size="lg"] {
		--mo-spacer-size: var(--mo-space-7);
	}
	.mo-spacer[data-size="xl"] {
		--mo-spacer-size: var(--mo-space-9);
	}
</style>

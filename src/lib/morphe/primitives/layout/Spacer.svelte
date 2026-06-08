<script lang="ts">
	/*
	 * Spacer — explicit space. Leaf Layout primitive (no children, no descent).
	 * STUB: structurally complete. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Spacer } from "../../grammar/types.js";

	let { node }: PrimitiveProps<Spacer> = $props();
	const size = $derived(node.size ?? "md");
</script>

<div class="mo-spacer" data-size={size} aria-hidden="true"></div>

<style>
	.mo-spacer[data-size="xs"] {
		height: var(--mo-space-2);
	}
	.mo-spacer[data-size="sm"] {
		height: var(--mo-space-3);
	}
	.mo-spacer[data-size="md"] {
		height: var(--mo-space-5);
	}
	.mo-spacer[data-size="lg"] {
		height: var(--mo-space-7);
	}
	.mo-spacer[data-size="xl"] {
		height: var(--mo-space-9);
	}
</style>

<script lang="ts">
	/*
	 * Icon — a Material Symbol. a11y is REQUIRED: decorative icons are hidden from
	 * AT; meaningful icons carry a label (the grammar makes "meaningful but
	 * unlabelled" unrepresentable).
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Icon } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Icon> = $props();
	const color = $derived(node.intent ? slot(node.intent, "on") : "currentColor");
	const decorative = $derived(node.a11y.role === "decorative");
	const label = $derived(node.a11y.role === "img" ? node.a11y.label : undefined);
</script>

{#if decorative}
	<span class="mo-icon material-symbols-outlined" aria-hidden="true" style:color>{node.name}</span>
{:else}
	<span class="mo-icon material-symbols-outlined" role="img" aria-label={label} style:color
		>{node.name}</span
	>
{/if}

<style>
	.mo-icon {
		display: inline-block;
		line-height: 1;
		vertical-align: middle;
	}
</style>

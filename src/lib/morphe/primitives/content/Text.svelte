<script lang="ts">
	/*
	 * Text — semantic text. Reads scale_tier from ctx via the boundary --mo-ctx-type.
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Text } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Text> = $props();
	const as = $derived(node.as ?? "body");
	const color = $derived(node.intent ? slot(node.intent, "on") : "var(--mo-intent-on-surface)");
	const emphasis = $derived(node.emphasis ?? "normal");
</script>

{#if as === "display" || as === "heading"}
	<h2 class="mo-text" data-as={as} data-emphasis={emphasis} style:color>
		{node.value}
	</h2>
{:else if as === "subheading"}
	<h3 class="mo-text" data-as={as} data-emphasis={emphasis} style:color>
		{node.value}
	</h3>
{:else}
	<p class="mo-text" data-as={as} data-emphasis={emphasis} style:color>
		{node.value}
	</p>
{/if}

<style>
	.mo-text {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-normal);
	}
	.mo-text[data-as="display"],
	.mo-text[data-as="heading"],
	.mo-text[data-as="subheading"] {
		font-family: var(--mo-font-headline);
		line-height: var(--mo-leading-tight);
	}
	.mo-text[data-as="caption"] {
		font-size: var(--mo-type-2);
		font-family: var(--mo-font-label);
	}
	.mo-text[data-emphasis="muted"] {
		color: var(--mo-intent-on-surface-muted) !important;
	}
	.mo-text[data-emphasis="strong"] {
		font-weight: 600;
	}
	.mo-text[data-emphasis="critical"] {
		font-weight: 700;
	}
</style>

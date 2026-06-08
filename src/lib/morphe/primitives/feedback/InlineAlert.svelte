<script lang="ts">
	/*
	 * InlineAlert — a banner-style message. Tone is paired with a title (text), so
	 * color is never the only signal. `live` controls aria-live politeness.
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { InlineAlert } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<InlineAlert> = $props();
	const on = $derived(slot(node.tone, "on"));
	const surface = $derived(slot(node.tone, "surface"));
	const border = $derived(slot(node.tone, "border"));
	const live = $derived(node.live ?? "polite");
	const role = $derived(live === "assertive" ? "alert" : "status");
</script>

<div
	class="mo-alert"
	{role}
	aria-live={live}
	style:background={surface}
	style:color={on}
	style:border-inline-start-color={border}
>
	<p class="mo-alert__title">{node.title}</p>
	{#if node.detail}
		<p class="mo-alert__detail">{node.detail}</p>
	{/if}
</div>

<style>
	.mo-alert {
		padding: var(--mo-space-4) var(--mo-space-5);
		border-radius: var(--mo-radius-2);
		border-inline-start: 3px solid;
	}
	.mo-alert__title {
		margin: 0;
		font-family: var(--mo-font-body);
		font-weight: 600;
		font-size: var(--mo-type-4);
	}
	.mo-alert__detail {
		margin: var(--mo-space-2) 0 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		opacity: 0.9;
	}
</style>

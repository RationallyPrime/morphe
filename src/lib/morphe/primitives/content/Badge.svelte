<script lang="ts">
	/*
	 * Badge — a compact labelled chip. Icon reinforces meaning so the badge never
	 * relies on color alone.
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Badge } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Badge> = $props();
	const intent = $derived(node.intent ?? "neutral");
	const surface = $derived(slot(intent, "surface"));
	const on = $derived(slot(intent, "on"));
</script>

<span class="mo-badge" style:background={surface} style:color={on}>
	{#if node.icon}
		<span class="mo-badge__icon material-symbols-outlined" aria-hidden="true">{node.icon}</span>
	{/if}
	{node.label}
</span>

<style>
	.mo-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-1) var(--mo-space-3);
		border-radius: var(--mo-radius-full);
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.mo-badge__icon {
		font-size: 1em;
	}
</style>

<script lang="ts">
	/*
	 * Status — a tone signal. Functional color is NEVER the only signal: a text
	 * (and optional icon) signal is REQUIRED by the grammar (StatusSignal).
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Status } from "../../grammar/types.js";
	import { slot, toneIntent } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Status> = $props();
	const intent = $derived(toneIntent(node.tone));
	const on = $derived(slot(intent, "on"));
	const surface = $derived(slot(intent, "surface"));
</script>

<span class="mo-status" style:background={surface} style:color={on}>
	{#if node.signal.icon}
		<span class="material-symbols-outlined" aria-hidden="true">{node.signal.icon}</span>
	{/if}
	<span class="mo-status__text">{node.signal.text}</span>
</span>

<style>
	.mo-status {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-1) var(--mo-space-3);
		border-radius: var(--mo-radius-2);
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-1);
		letter-spacing: 0.04em;
	}
	.mo-status .material-symbols-outlined {
		font-size: 1.1em;
	}
</style>

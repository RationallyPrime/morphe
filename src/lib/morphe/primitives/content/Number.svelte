<script lang="ts">
	/*
	 * Number — formatted numeric value (tabular figures). Locale resolves at render.
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { NumberNode } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<NumberNode> = $props();
	const color = $derived(node.intent ? slot(node.intent, "on") : "var(--mo-intent-on-surface)");
	const emphasis = $derived(node.emphasis ?? "normal");
	const formatted = $derived(format(node));

	function format(n: NumberNode): string {
		switch (n.format ?? "plain") {
			case "integer":
				return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n.value);
			case "currency":
				return new Intl.NumberFormat(undefined, {
					style: "currency",
					currency: n.currency ?? "ISK",
				}).format(n.value);
			case "percent":
				return new Intl.NumberFormat(undefined, { style: "percent" }).format(n.value);
			case "compact":
				return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n.value);
			default:
				return String(n.value);
		}
	}
</script>

<span class="mo-number" data-emphasis={emphasis} style:color>{formatted}</span>

<style>
	.mo-number {
		font-family: var(--mo-font-mono);
		font-feature-settings: "tnum";
		font-size: var(--mo-ctx-type, var(--mo-type-4));
	}
	.mo-number[data-emphasis="muted"] {
		color: var(--mo-intent-on-surface-muted) !important;
	}
	.mo-number[data-emphasis="strong"],
	.mo-number[data-emphasis="critical"] {
		font-weight: 600;
	}
</style>

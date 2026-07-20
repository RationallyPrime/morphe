<script lang="ts">

	/*
	 * Icon — a Material Symbol (Content family leaf).
	 *
	 * Accessibility is REQUIRED and the grammar makes "meaningful but unlabelled"
	 * unrepresentable: a decorative icon is hidden from assistive tech
	 * (`aria-hidden`), a meaningful icon is an `img` with a mandatory label. We
	 * carry that distinction faithfully — never both, never neither.
	 *
	 * Size follows the type context (`--mo-ctx-type`, which encodes scale_tier) so
	 * an icon scales with the text it sits beside; color comes from the intent's
	 * freestanding-INK channel (contrast-guaranteed on the page ground — a bare glyph
	 * is ink, not text-on-fill, so `on` would be the unreadable choice; KRA-796),
	 * defaulting to `currentColor` so a bare icon inherits its surrounding text color.
	 *
	 * Agent edits ONLY this file.
	 */

	import type { Icon } from "../../grammar/types.js";
	import type { PrimitiveProps } from "../../render/props.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Icon> = $props();

	const color = $derived(node.intent ? SLOTS.content.ink(node.intent) : "currentColor");
	const decorative = $derived(node.a11y.role === "decorative");
	const label = $derived(node.a11y.role === "img" ? node.a11y.label : undefined);
</script>

{#if decorative}
	<span class="mo-icon material-symbols-outlined" aria-hidden="true" style:color={color}>{node.name}</span>
{:else}
	<span class="mo-icon material-symbols-outlined" role="img" aria-label={label} style:color={color}
		>{node.name}</span
	>
{/if}

<style>
	.mo-icon {
		display: inline-block;
		/* Scale with the surrounding type context; fall back to the body step. */
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: 1;
		vertical-align: middle;
		/* Keep the optical weight stable across sizes. */
		font-variation-settings: "opsz" 24;
		user-select: none;
	}
</style>

<script lang="ts">
	/*
	 * Progress — determinate (0..1) or indeterminate. REQUIRED label so it is
	 * announced, not only shown.
	 * STUB: minimal valid markup. Agent edits ONLY this file.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Progress } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node }: PrimitiveProps<Progress> = $props();
	const intent = $derived(node.intent ?? "primary-action");
	const fill = $derived(slot(intent, "surface"));
	const determinate = $derived(typeof node.value === "number");
	const pct = $derived(
		determinate ? Math.round(Math.min(1, Math.max(0, node.value ?? 0)) * 100) : undefined,
	);
	const fillWidth = $derived(`${pct ?? 30}%`);
</script>

<div
	class="mo-progress"
	role="progressbar"
	aria-label={node.label}
	aria-valuemin={determinate ? 0 : undefined}
	aria-valuemax={determinate ? 100 : undefined}
	aria-valuenow={pct}
	data-indeterminate={!determinate}
>
	<div class="mo-progress__track">
		<div class="mo-progress__fill" style:inline-size={fillWidth} style:background={fill}></div>
	</div>
</div>

<style>
	.mo-progress__track {
		inline-size: 100%;
		block-size: 0.4rem;
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-neutral-surface);
		overflow: hidden;
	}
	.mo-progress__fill {
		block-size: 100%;
		border-radius: var(--mo-radius-full);
	}
	.mo-progress[data-indeterminate="true"] .mo-progress__fill {
		animation: mo-progress-slide 1.2s ease-in-out infinite;
	}
	@keyframes mo-progress-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(330%);
		}
	}
</style>

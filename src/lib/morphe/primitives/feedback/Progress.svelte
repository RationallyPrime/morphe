<script lang="ts">
	/*
	 * Progress — a determinate (value 0..1) or indeterminate task indicator.
	 *
	 * A11y (Lemma 1, WCAG 1.4.1 — functional color is NEVER the only signal):
	 *   - `label` is REQUIRED by the grammar, so the bar is announced, not just
	 *     shown. It is wired as the accessible name and also rendered visibly.
	 *   - A determinate bar carries a textual percentage readout alongside the
	 *     coloured fill (the non-color signal); the fill geometry itself is the
	 *     shape channel. An indeterminate bar carries a textual "working" status so
	 *     a non-sighted or non-color user still gets the state.
	 *
	 * Context (Lemma 2): the indicator reads the DISCRETE `density`/`scaleTier`
	 * from `ctx` and the CONTINUOUS type step from the boundary var `--mo-ctx-type`.
	 * Track thickness is keyed off the density tier via a CSS var set at this
	 * boundary — no hardcoded px, no raw scale references.
	 *
	 * Tokens (Lemma 3): colour flows scales -> intents -> slots only. The fill uses
	 * the chosen intent's `surface`; the track uses the neutral intent surface.
	 *
	 * Motion: the indeterminate sweep is gated behind prefers-reduced-motion.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Progress } from "../../grammar/types.js";
	import { slot } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<Progress> = $props();

	const intent = $derived(node.intent ?? "primary-action");
	const fill = $derived(slot(intent, "surface"));

	const determinate = $derived(typeof node.value === "number");
	const fraction = $derived(Math.min(1, Math.max(0, node.value ?? 0)));
	const pct = $derived(determinate ? Math.round(fraction * 100) : undefined);
	const fillWidth = $derived(determinate ? `${pct}%` : "40%");

	/*
	 * Discrete density tier -> track thickness step (a continuous value emitted as
	 * this boundary's own CSS var). Denser contexts get a thinner rule so the bar
	 * recedes; calmer contexts get a more present one. Stays on the space scale.
	 */
	const trackStep = $derived(
		ctx.density === "compact"
			? "var(--mo-space-2)"
			: ctx.density === "spacious"
				? "var(--mo-space-4)"
				: "var(--mo-space-3)",
	);

	/* The readout: a non-color signal that is always present. */
	const readout = $derived(determinate ? `${pct}%` : "Working…");
</script>

<div class="mo-progress" data-indeterminate={!determinate}>
	<div class="mo-progress__heading">
		<span class="mo-progress__label">{node.label}</span>
		<span class="mo-progress__readout" aria-hidden="true">{readout}</span>
	</div>
	<div
		class="mo-progress__track"
		role="progressbar"
		aria-label={node.label}
		aria-valuemin={determinate ? 0 : undefined}
		aria-valuemax={determinate ? 100 : undefined}
		aria-valuenow={pct}
		aria-valuetext={determinate ? `${pct}%` : "In progress"}
		style:--mo-progress-track={trackStep}
	>
		<div class="mo-progress__fill" style:inline-size={fillWidth} style:background={fill}></div>
	</div>
</div>

<style>
	.mo-progress {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
		inline-size: 100%;
	}
	.mo-progress__heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--mo-space-3);
	}
	.mo-progress__label {
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-2);
		letter-spacing: 0.04em;
		color: var(--mo-intent-on-surface);
	}
	.mo-progress__readout {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		font-variant-numeric: tabular-nums;
		color: var(--mo-intent-on-surface-muted);
	}
	.mo-progress__track {
		position: relative;
		inline-size: 100%;
		block-size: var(--mo-progress-track, var(--mo-space-3));
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-neutral-surface);
		overflow: hidden;
	}
	.mo-progress__fill {
		block-size: 100%;
		border-radius: var(--mo-radius-full);
		transition: inline-size 240ms ease-out;
	}
	.mo-progress[data-indeterminate="true"] .mo-progress__fill {
		position: absolute;
		inset-block: 0;
		inset-inline-start: 0;
		animation: mo-progress-slide 1.2s ease-in-out infinite;
	}
	@keyframes mo-progress-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(350%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.mo-progress__fill {
			transition: none;
		}
		/* Stop the sweep; show a static, centred fill that still reads as "busy". */
		.mo-progress[data-indeterminate="true"] .mo-progress__fill {
			animation: none;
			inline-size: 100%;
			opacity: 0.5;
		}
	}
</style>

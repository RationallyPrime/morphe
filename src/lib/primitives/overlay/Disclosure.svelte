<script lang="ts">

	/*
	 * Disclosure — a collapsible region. The genuine browser capability lives in
	 * native details / summary: open/close state, the keyboard toggle
	 * (Enter/Space on the summary), and the `aria-expanded`-equivalent semantics
	 * with ZERO JS. A single-open accordion is the native exclusive-accordion
	 * `name=` on the details elements — again no JS, no controlled-state
	 * plumbing, no outside-click listeners. This is the keystone reason Disclosure
	 * is a primitive and not a compound: faking collapse with a JS height animation
	 * over an overflow:hidden div is the legacy mistake (three runtime libs fought
	 * it); the platform does it natively now.
	 *
	 * a11y is REQUIRED by the grammar: `summary` is the always-visible trigger
	 * label, so a disclosure with no trigger label is unrepresentable. The open
	 * state is signalled by a SHAPE — the chevron rotates — never by color alone
	 * (WCAG 1.4.1); the marker is `aria-hidden` because details / summary
	 * already expose the expanded/collapsed state to assistive tech.
	 *
	 * Continuous sizing rides the boundary CSS vars (--mo-ctx-type, --mo-ctx-space)
	 * the nearest Layout ancestor set; stateful chrome (the focus ring color +
	 * geometry) rides this component's own --mo-disc-* vars resolved through
	 * SLOTS -> intents -> scales (no raw scale or hex named here). The chevron
	 * rotation AND the open/close size transition honour reduced motion via a media
	 * query in the style block, not a JS hook. Children recurse into Node with the
	 * current ctx.
	 */

	import type { Disclosure } from "../../grammar/types.js";
	import Node from "../../render/Node.svelte";
	import type { PrimitiveProps } from "../../render/props.js";
	import { SLOTS } from "../../tokens/slots.js";

	let { node, ctx }: PrimitiveProps<Disclosure> = $props();

	// Focus affordance: the ring COLOR is the per-intent channel, the geometry is
	// neutral (CONTRACT §7). Both flow through SLOTS so a dialect can re-point them
	// without touching this primitive — no hardcoded pixels, no hardcoded intent.
	const ringColor = $derived(SLOTS.focus.ring());
	const ringWidth = $derived(SLOTS.focus.width());
	const ringOffset = $derived(SLOTS.focus.offset());

	// The panel surface is the tonal overlay tier (no drop shadow; depth via
	// surface layering). On-color rides the overlay slot for parity with the rest
	// of the overlay family.
	const onColor = $derived(SLOTS.overlay.on());
</script>

<details
	class="mo-disclosure"
	open={node.open}
	name={node.group}
	style:--mo-disc-ring={ringColor}
	style:--mo-disc-ring-width={ringWidth}
	style:--mo-disc-ring-offset={ringOffset}
	style:--mo-disc-on={onColor}
>
	<summary class="mo-disclosure__summary">
		<span class="mo-disclosure__marker material-symbols-outlined" aria-hidden="true"
			>chevron_right</span
		>
		<span class="mo-disclosure__label">{node.summary}</span>
	</summary>
	<div class="mo-disclosure__body">
		{#each node.children as child, i (i)}
			<Node node={child} {ctx} />
		{/each}
	</div>
</details>

<style>
	.mo-disclosure {
		/* Sectioning by tonal shift, never a 1px structural border: only a low
		   contrast ghost rule separates stacked disclosures for accessibility. */
		border-block-end: var(--mo-ctx-stroke, var(--mo-border-width)) solid var(--mo-intent-outline);
		color: var(--mo-disc-on, var(--mo-intent-on-surface));
	}
	.mo-disclosure__summary {
		display: flex;
		align-items: center;
		gap: var(--mo-space-3);
		padding: var(--mo-ctx-space, var(--mo-space-4)) 0;
		cursor: pointer;
		/* Strip the native triangle marker (we own the chevron shape cue). */
		list-style: none;
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-snug);
		font-weight: 600;
		color: var(--mo-disc-on, var(--mo-intent-on-surface));
		/* The summary is the focus target; the ring sits tightly inset so it does
		   not collide with the adjacent ghost rule. */
		border-radius: var(--mo-radius-2);
	}
	.mo-disclosure__summary::-webkit-details-marker {
		display: none;
	}
	.mo-disclosure__summary::marker {
		content: "";
	}
	.mo-disclosure__summary:focus-visible {
		outline: var(--mo-disc-ring-width, var(--mo-ring-width)) solid
			var(--mo-disc-ring, var(--mo-intent-primary-action-ring));
		outline-offset: var(--mo-disc-ring-offset, var(--mo-ring-offset));
	}
	.mo-disclosure__label {
		flex: 1;
		min-inline-size: 0;
	}
	/* Shape cue (not color alone): the chevron points right when collapsed and
	   rotates a quarter turn to point down when the region is open. */
	.mo-disclosure__marker {
		flex: none;
		font-size: 1.2em;
		line-height: 1;
		color: var(--mo-intent-on-surface-muted);
		transition: transform 0.18s ease;
	}
	.mo-disclosure[open] .mo-disclosure__marker {
		transform: rotate(90deg);
	}
	.mo-disclosure__body {
		padding-block-end: var(--mo-space-5);
		font-family: var(--mo-font-body);
		font-size: var(--mo-ctx-type, var(--mo-type-4));
		line-height: var(--mo-leading-normal);
		color: var(--mo-disc-on, var(--mo-intent-on-surface));
	}

	/* Native open/close transition: `::details-content` is the collapsible box.
	   `interpolate-size: allow-keywords` lets block-size animate from 0 to the
	   intrinsic `auto`, and `transition-behavior: allow-discrete` carries the
	   discrete `content-visibility` flip across the transition — zero JS in the
	   open loop. Where unsupported the element simply snaps open/closed. */
	@supports (interpolate-size: allow-keywords) {
		.mo-disclosure {
			interpolate-size: allow-keywords;
		}
		.mo-disclosure::details-content {
			block-size: 0;
			overflow: clip;
			transition:
				block-size 0.22s ease,
				content-visibility 0.22s allow-discrete;
		}
		.mo-disclosure[open]::details-content {
			block-size: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mo-disclosure__marker {
			transition: none;
		}
		.mo-disclosure::details-content {
			transition: none;
		}
	}
</style>

<script lang="ts">
	/*
	 * The INTENT CHIP ROW (ADR-0006 §2, KRA-355) — the primary affordance:
	 * recognition over recall, phone-first. Native control surface, styled with
	 * `--mo-*` tokens only; the Morphe tree carries the RESULT of a morph, the
	 * page owns the controls (the native-control-surface idiom).
	 *
	 * Progressive enhancement is structural: every chip IS an anchor to its
	 * intent's canonical content. Without JS the row is plain navigation and the
	 * page is fully usable. With JS, a chip whose intent morphs intercepts the
	 * click and executes through the engine — the SAME path the palette uses.
	 *
	 * The polite live region lives here (the chips are always on the stage), so
	 * every morph — chip- or palette-initiated — is announced to AT through the
	 * one engine `announcement` line.
	 */

	import { intentEngine } from "./intent-engine.svelte.js";
	import { intentRegistry, registerSiteIntents, type SiteIntent } from "./intents.js";

	// Idempotent — safe under HMR and repeat mounts.
	registerSiteIntents();

	const intents: readonly SiteIntent[] = intentRegistry.list();

	function onChipClick(event: MouseEvent, intent: SiteIntent): void {
		const outcome = intentEngine.execute(intent);
		// Navigation outcomes keep their default anchor behaviour (real links,
		// real history); only an in-place morph consumes the click.
		if (outcome.kind === "morphed") {
			event.preventDefault();
		}
	}
</script>

<nav class="chips" aria-label="What would you like to know?">
	{#each intents as intent (intent.id)}
		<a class="chip" href={intent.href} onclick={(e) => onChipClick(e, intent)}>
			{intent.label}
		</a>
	{/each}
</nav>

<p class="sr-live" aria-live="polite">{intentEngine.announcement}</p>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-3);
		align-items: center;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: var(--mo-space-3) var(--mo-space-5);
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-neutral-on);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 500;
		text-decoration: none;
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}
	.chip:hover {
		background: var(--mo-intent-neutral-hover);
	}
	.chip:active {
		background: var(--mo-intent-neutral-active);
	}
	.chip:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}

	/* The live region is for AT only; visually it does not exist. */
	.sr-live {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.chip {
			transition: none;
		}
	}
</style>

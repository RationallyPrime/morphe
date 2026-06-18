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

	import { BASE_INTENT_COPY, type IntentCopy } from "./copy.js";
	import { intentEngine } from "./intent-engine.svelte.js";
	import { intentRegistry, registerSiteIntents, type SiteIntent } from "./intents.js";

	let { copy = BASE_INTENT_COPY }: { copy?: IntentCopy } = $props();

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

	/** A stage-delta chip is OPEN when the live stage shows its branch. */
	function isOpen(intent: SiteIntent): boolean {
		return (
			intent.action.kind === "stage-delta" &&
			intentEngine.choices?.[intent.action.id] === intent.action.choice
		);
	}
</script>

<nav class="chips" aria-label={copy.prompt}>
	{#each intents as intent (intent.id)}
		{@const expanded = isOpen(intent)}
		<a
			class="chip"
			class:chip--open={expanded}
			href={intent.href}
			aria-expanded={intent.action.kind === "stage-delta" ? expanded : undefined}
			onclick={(e) => onChipClick(e, intent)}
		>
			{copy.labels?.[intent.id] ?? intent.label}{#if expanded}<span class="chip__close" aria-hidden="true">×</span>{/if}
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

	/* An OPEN chip: the catalog-accent register marks the live entry, and the
	   close glyph says the same click puts it away (aria-expanded carries the
	   state for AT; the glyph is decoration). */
	.chip--open {
		background: var(--mo-intent-accession-surface);
		color: var(--mo-intent-accession-on);
		outline-color: var(--mo-intent-accession-border);
	}
	.chip--open:hover {
		background: var(--mo-intent-accession-hover);
	}
	.chip--open:active {
		background: var(--mo-intent-accession-active);
	}
	.chip__close {
		margin-inline-start: var(--mo-space-3);
		font-size: var(--mo-type-4);
		line-height: 1;
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

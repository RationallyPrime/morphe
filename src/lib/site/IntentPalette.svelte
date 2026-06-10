<script lang="ts">
	/*
	 * The KEYSTROKE PALETTE (ADR-0006 §2, KRA-355) — the accelerator, demoted
	 * by design: chips are the primary affordance; Cmd/Ctrl+K rides the SAME
	 * engine path as a power-user shortcut and a performed demo.
	 *
	 * Platform top layer per the Overlay lemma: a native <dialog> via
	 * showModal() — focus moves in on open, returns to the invoker on close,
	 * Esc closes natively. The combobox pattern: the input owns the focus,
	 * arrow keys move aria-activedescendant over the option list, Enter
	 * executes. No JS, no palette — the dialog is simply absent (chips remain
	 * the canonical navigation).
	 */

	import { goto } from "$app/navigation";
	import { intentEngine } from "./intent-engine.svelte.js";
	import {
		intentRegistry,
		matchIntents,
		registerSiteIntents,
		type SiteIntent,
	} from "./intents.js";

	// Idempotent — safe under HMR and repeat mounts.
	registerSiteIntents();

	const intents: readonly SiteIntent[] = intentRegistry.list();

	let dialog: HTMLDialogElement | undefined = $state();
	let query = $state("");
	let activeIndex = $state(0);

	const results = $derived(matchIntents(query, intents));
	const active = $derived(results[Math.min(activeIndex, Math.max(results.length - 1, 0))]);

	function onWindowKeydown(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			if (dialog?.open) {
				dialog.close();
			} else {
				query = "";
				activeIndex = 0;
				dialog?.showModal();
			}
		}
	}

	function onInputKeydown(event: KeyboardEvent): void {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (results.length > 0) activeIndex = (activeIndex + 1) % results.length;
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			if (results.length > 0) activeIndex = (activeIndex - 1 + results.length) % results.length;
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (active) run(active);
		}
	}

	function run(intent: SiteIntent): void {
		const outcome = intentEngine.execute(intent);
		dialog?.close();
		if (outcome.kind === "navigate") {
			void goto(outcome.href);
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<dialog
	bind:this={dialog}
	class="palette"
	aria-label="State your interest"
	onclose={() => {
		query = "";
		activeIndex = 0;
	}}
>
	<div class="palette__field">
		<input
			class="palette__input"
			type="text"
			role="combobox"
			aria-expanded="true"
			aria-controls="intent-options"
			aria-activedescendant={active ? `intent-option-${active.id}` : undefined}
			aria-label="State your interest"
			placeholder="What would you like to know?"
			autocomplete="off"
			spellcheck="false"
			bind:value={query}
			oninput={() => {
				activeIndex = 0;
			}}
			onkeydown={onInputKeydown}
		/>
		<kbd class="palette__hint">esc</kbd>
	</div>
	<ul class="palette__options" id="intent-options" role="listbox" aria-label="Matching paths">
		{#each results as intent, i (intent.id)}
			<li
				class="palette__option"
				id={`intent-option-${intent.id}`}
				role="option"
				aria-selected={i === activeIndex}
				data-active={i === activeIndex}
			>
				<button type="button" tabindex="-1" onclick={() => run(intent)}>
					{intent.label}
				</button>
			</li>
		{:else}
			<li class="palette__empty" role="presentation">Nothing matches — try a chip below.</li>
		{/each}
	</ul>
</dialog>

<style>
	/* The overlay panel — top tonal tier, scrim from the intent layer. */
	.palette {
		inline-size: min(34rem, calc(100vw - 2 * var(--mo-space-6)));
		margin: clamp(var(--mo-space-7), 14vh, 9rem) auto auto;
		padding: var(--mo-space-3);
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-overlay);
		color: var(--mo-intent-on-surface);
	}
	.palette::backdrop {
		background: var(--mo-scrim);
	}

	.palette__field {
		display: flex;
		align-items: center;
		gap: var(--mo-space-3);
	}
	.palette__input {
		flex: 1;
		padding: var(--mo-space-4) var(--mo-space-4);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-sunken);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
	}
	.palette__input::placeholder {
		color: var(--mo-intent-on-surface-muted);
	}
	.palette__input:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.palette__hint {
		padding: var(--mo-space-1) var(--mo-space-3);
		border-radius: var(--mo-radius-1);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		color: var(--mo-intent-on-surface-muted);
	}

	.palette__options {
		margin: var(--mo-space-3) 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-1);
	}
	.palette__option button {
		display: block;
		inline-size: 100%;
		padding: var(--mo-space-4);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: transparent;
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		text-align: start;
		cursor: pointer;
	}
	.palette__option[data-active="true"] button,
	.palette__option button:hover {
		background: var(--mo-intent-neutral-surface);
		color: var(--mo-intent-neutral-on);
	}
	.palette__empty {
		padding: var(--mo-space-4);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-on-surface-muted);
	}

	/* The entrance breathes unless the visitor asked it not to. */
	.palette[open] {
		animation: palette-in 140ms ease-out;
	}
	@keyframes palette-in {
		from {
			opacity: 0;
			transform: translateY(-0.4rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.palette[open] {
			animation: none;
		}
	}
</style>

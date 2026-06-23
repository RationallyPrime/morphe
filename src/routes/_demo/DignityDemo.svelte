<script lang="ts">
	/*
	 * Morphe neutral playground host. The authored interface lives in ./tree.ts;
	 * this component supplies the frame-level live pieces: dialect, choice map,
	 * store, and action map.
	 */

	import type { ActionMap, ChoiceMap, Dialect } from "$lib";
	import { activeDialect, commitTier1, createInMemoryMorpheStore, DIALECT_IDS, DIALECTS } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { dignityTree, registerDemoCompounds } from "./tree.js";

	registerDemoCompounds();

	const dialects: readonly Dialect[] = DIALECT_IDS.map((id) => DIALECTS[id] as Dialect);
	const demoStore = createInMemoryMorpheStore({
		"demo.goal": "Review an exception queue",
		"demo.note": "Keep the explanation short and evidence-led.",
		"demo.mode": "triage",
		"demo.detail": 3,
		"demo.reviewed": false,
	});

	let choiceIndex = $state(0);
	let actionCount = $state(0);
	let lastAction = $state("ready");

	const choices = $derived({ "demo.mode": choiceIndex } satisfies ChoiceMap);
	const actions: ActionMap = {
		"demo.rotate": () => {
			choiceIndex = (choiceIndex + 1) % 3;
			actionCount += 1;
			lastAction = `mode-${choiceIndex + 1}`;
			commitTier1(demoStore, "demo.mode-choice", "selection", choiceIndex);
		},
		"demo.review": () => {
			actionCount += 1;
			lastAction = "reviewed";
			commitTier1(demoStore, "demo.reviewed", "selection", true);
		},
	};
</script>

<div class="page">
	<header class="control">
		<div class="control__brand">
			<span class="control__glyph material-symbols-outlined" aria-hidden="true">hub</span>
			<div class="control__id">
				<p class="control__title">Morphe Playground</p>
				<p class="control__sub">One authored tree, all shipped dialects, live host wires.</p>
			</div>
		</div>

		<div class="toggle" role="radiogroup" aria-label="Active dialect">
			{#each dialects as d (d.id)}
				<button
					type="button"
					class="toggle__btn"
					role="radio"
					aria-checked={activeDialect.id === d.id}
					data-active={activeDialect.id === d.id}
					onclick={() => activeDialect.setById(d.id)}
				>
					<span class="toggle__swatch" data-dialect={d.id} aria-hidden="true"></span>
					{d.label}
				</button>
			{/each}
		</div>
	</header>

	<p class="proof" aria-live="polite">
		Active dialect:&nbsp;<strong>{activeDialect.current.label}</strong>
		<span class="proof__sep">·</span>
		vary branch:&nbsp;<strong>{choiceIndex + 1}</strong>
		<span class="proof__sep">·</span>
		last action:&nbsp;<strong>{lastAction}</strong>
		<span class="proof__sep">·</span>
		actions:&nbsp;<strong>{actionCount}</strong>
	</p>

	<main class="surface">
		{#key activeDialect.id}
			<MorpheRoot tree={dignityTree} store={demoStore} {actions} choices={choices} />
		{/key}
	</main>
</div>

<style>
	/*
	 * Page chrome only. Rendered content gets its styling from MorpheRoot.
	 */
	.page {
		max-width: 1080px;
		margin-inline: auto;
		padding: clamp(1.25rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem) 4rem;
		min-height: 100vh;
	}

	.control {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-5);
		align-items: center;
		justify-content: space-between;
		padding-block-end: var(--mo-space-5);
	}

	.control__brand {
		display: flex;
		align-items: center;
		gap: var(--mo-space-4);
		min-inline-size: 0;
	}
	.control__glyph {
		font-size: var(--mo-type-7);
		color: var(--mo-intent-primary-action-surface);
		line-height: 1;
	}
	.control__id {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-1);
	}
	.control__title {
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface);
	}
	.control__sub {
		margin: 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-on-surface-muted);
	}

	/* The dialect toggle — a segmented control. */
	.toggle {
		display: inline-flex;
		gap: var(--mo-space-1);
		padding: var(--mo-space-1);
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-raised);
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
	.toggle__btn {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-3);
		padding: var(--mo-space-3) var(--mo-space-5);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: transparent;
		color: var(--mo-intent-on-surface-muted);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}
	.toggle__btn:hover {
		color: var(--mo-intent-on-surface);
	}
	.toggle__btn[data-active="true"] {
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
	}
	.toggle__btn:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.toggle__swatch {
		inline-size: 0.7rem;
		block-size: 0.7rem;
		border-radius: var(--mo-radius-full);
		flex: none;
	}
	.toggle__swatch[data-dialect="icelandic-archive"] {
		background: var(--mo-amber-500);
	}
	.toggle__swatch[data-dialect="clinical"] {
		background: var(--mo-green-500);
	}
	.toggle__swatch[data-dialect="reykjavik-registry"] {
		background: var(--mo-blue-500);
	}
	.toggle__swatch[data-dialect="timaeus"] {
		background: var(--mo-cobalt-500);
	}
	/* The plate-derived pair reads as its GROUNDS, not its accent (both accents
	   are cobalt; the ground is what distinguishes wall from night). */
	.toggle__swatch[data-dialect="gallery"] {
		background: var(--mo-bone-4);
	}
	.toggle__swatch[data-dialect="night"] {
		background: var(--mo-cobalt-700);
	}
	.toggle__swatch[data-dialect="ledger"] {
		background: var(--mo-teal-500);
	}
	.toggle__swatch[data-dialect="estate"] {
		background: var(--mo-copper-500);
	}
	.toggle__swatch[data-dialect="foundry"] {
		background: var(--mo-steel-500);
	}

	.proof {
		margin: 0 0 var(--mo-space-5);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
	}
	.proof strong {
		color: var(--mo-intent-accession-on);
		font-weight: 500;
	}
	.proof__sep {
		margin-inline: var(--mo-space-2);
		opacity: 0.5;
	}

	/* The demo surface: a sunken well the rendered page sits in. */
	.surface {
		border-radius: var(--mo-radius-3);
		overflow: clip;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
</style>

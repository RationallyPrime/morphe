<script lang="ts">
	import type { ActionMap, ChoiceMap } from "$lib";
	import { createInMemoryMorpheStore, getDialect, registry, restrictCompounds } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { inspectPreviewHost } from "../../../_demo/preview-host.js";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const dialect = $derived(getDialect(data.dialectId));
	const resolver = $derived(restrictCompounds(registry, { allow: dialect.compounds }));
	const host = $derived(inspectPreviewHost(data.tree, { resolver }));
	const store = createInMemoryMorpheStore();
	let actionLog = $state<readonly string[]>([]);
	let choiceOverrides = $state<ChoiceMap>({});
	const choices = $derived<ChoiceMap>(
		Object.fromEntries(
			host.variations.map((variation) => [
				variation.id,
				choiceOverrides[variation.id] ?? variation.defaultChoice,
			]),
		),
	);
	const actions = $derived<ActionMap>(Object.fromEntries(
		host.actionIds.map((id) => [
			id,
			() => {
				actionLog = [id, ...actionLog].slice(0, 8);
			},
		]),
	));

	function setChoice(id: string, range: readonly [number, number], event: Event): void {
		const raw = Number((event.currentTarget as HTMLInputElement | HTMLSelectElement).value);
		if (!Number.isFinite(raw)) return;
		const choice = Math.min(Math.max(Math.trunc(raw), range[0]), range[1]);
		choiceOverrides = {
			...choiceOverrides,
			[id]: choice,
		};
	}
</script>

<main class:preview-host--mobile={data.viewport === "mobile"} class="preview-host">
	<header class="preview-host__controls">
		<div>
			<p>CMS preview · {data.viewport}</p>
			<h1>Host-bound preview</h1>
		</div>
		{#each host.variations as variation (variation.id)}
			<label>
				<span>
					Choice {variation.id} · {variation.kind} · {variation.range[0]}–{variation.range[1]}
				</span>
				{#if variation.kind === "vary"}
					<select
						value={choices[variation.id]}
						onchange={(event) => setChoice(variation.id, variation.range, event)}
					>
						{#each variation.options as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				{:else}
					<input
						type="number"
						min={variation.range[0]}
						max={variation.range[1]}
						step="1"
						value={choices[variation.id]}
						oninput={(event) => setChoice(variation.id, variation.range, event)}
					/>
				{/if}
			</label>
		{/each}
		<p class="preview-host__receipt" aria-live="polite">
			{actionLog.length === 0
				? "No preview actions recorded."
				: `Preview action recorded: ${actionLog[0]}`}
		</p>
	</header>
	<section class="preview-host__canvas" aria-label="Compiled Morphe artifact">
		<MorpheRoot tree={data.tree} {dialect} {registry} {store} {actions} {choices} />
	</section>
</main>

<style>
	.preview-host {
		box-sizing: border-box;
		min-block-size: 100vh;
		inline-size: 100%;
		margin-inline: auto;
		padding: var(--mo-space-4);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
	}
	.preview-host--mobile {
		max-inline-size: 390px;
	}
	.preview-host__controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--mo-space-3);
		margin-block-end: var(--mo-space-4);
		padding: var(--mo-space-3);
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-raised);
	}
	.preview-host__controls p,
	.preview-host__controls h1 {
		margin: 0;
	}
	.preview-host__controls p {
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.preview-host__controls h1 {
		font-size: var(--mo-type-4);
	}
	.preview-host__controls label {
		display: grid;
		gap: var(--mo-space-1);
		font-size: var(--mo-type-2);
		font-weight: 700;
	}
	.preview-host__controls select,
	.preview-host__controls input {
		min-block-size: 44px;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-1);
		padding-inline: var(--mo-space-2);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font: inherit;
	}
	.preview-host__receipt {
		flex-basis: 100%;
	}
	.preview-host__canvas {
		min-inline-size: 0;
	}
</style>

<script lang="ts">
	import type { ActionMap, ChoiceMap, JsonRecord } from "$lib";
	import {
		activeDialect,
		createInMemoryMorpheStore,
		DEFAULT_DIALECT_ID,
		getDialect,
	} from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { DIALECT_OPTIONS, EXHIBITS } from "../_playground/exhibits.js";
	import { FALLBACK_LOCAL_ADAPTIVE_DRAFT, fallbackDiagnostics } from "../_playground/fallback.js";
	import { generateLocalAdaptiveDraft } from "../_playground/local-ai.js";
	import { presentPinnedDialectProof, presentPlayground } from "../_playground/presenters.js";
	import type { ExhibitId, GrammarVariant, ProviderSource } from "../_playground/types.js";
	import { GRAMMAR_VARIANTS } from "../_playground/types.js";
	import type { LocalAdaptiveDraft } from "../_playground/validation.js";

	const store = createInMemoryMorpheStore({
		"playground.goal": "Review an exception queue",
		"playground.reviewed": false,
	});

	let activeExhibit = $state<ExhibitId>("grammar");
	let grammarVariant = $state<GrammarVariant>("layout");
	let selectedDialectId = $state(DEFAULT_DIALECT_ID);
	let selectedVaryChoice = $state(0);
	let actionLog = $state<readonly string[]>([]);
	let localGoal = $state("Review an exception queue");
	let localDraft = $state<LocalAdaptiveDraft>(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
	let localSource = $state<ProviderSource>("chrome-unavailable");
	let localDiagnostics = $state<readonly string[]>(["chrome-unavailable:LanguageModel"]);
	let localBusy = $state(false);

	const choices = $derived<ChoiceMap>({ "demo.mode": selectedVaryChoice });
	const actions = $derived<ActionMap>({
		"demo.rotate": () => {
			selectedVaryChoice = (selectedVaryChoice + 1) % 3;
			recordAction("demo.rotate");
		},
		"demo.review": () => recordAction("demo.review"),
		"local-ai.next": () => recordAction("local-ai.next"),
	});
	const storeSnapshot = $derived<JsonRecord>(store.snapshot());
	const presentation = $derived(
		presentPlayground({
			activeExhibit,
			grammarVariant,
			activeDialectId: activeDialect.id,
			selectedVaryChoice,
			actionLog,
			storeSnapshot,
			localDraft,
			localSource,
			localDiagnostics,
		}),
	);

	function recordAction(id: string): void {
		actionLog = [id, ...actionLog].slice(0, 8);
	}

	function selectExhibit(id: ExhibitId): void {
		activeExhibit = id;
	}

	function setGrammarVariant(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if ((GRAMMAR_VARIANTS as readonly string[]).includes(value)) {
			grammarVariant = value as GrammarVariant;
		}
	}

	function setDialect(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		selectedDialectId = value;
		activeDialect.setById(value);
	}

	function setVaryChoice(event: Event): void {
		selectedVaryChoice = Number((event.currentTarget as HTMLInputElement).value);
	}

	async function runLocalAi(): Promise<void> {
		localBusy = true;
		const result = await generateLocalAdaptiveDraft({
			goal: localGoal,
			dialectId: activeDialect.id,
		});
		localDraft = result.draft;
		localSource = result.source;
		localDiagnostics = result.diagnostics;
		localBusy = false;
	}

	function resetLocalAi(): void {
		localDraft = FALLBACK_LOCAL_ADAPTIVE_DRAFT;
		localSource = "fallback";
		localDiagnostics = fallbackDiagnostics("manual-reset");
	}
</script>

<svelte:head>
	<title>Morphe Playground</title>
	<meta
		name="description"
		content="A neutral Morphe workbench for typed Node rendering, dialect switching, CMS preview routes, actions, bindings, variation choices, and local adaptive fallback rendering."
	/>
</svelte:head>

<main class="workbench">
	<header class="workbench__mast">
		<p class="workbench__eyebrow">Morphe Workbench</p>
		<h1>Substrate under live pressure</h1>
		<p>
			One neutral playground for authored UI as data, dialects, context algebra, state
			sockets, variation, CMS publication, and adaptive providers.
		</p>
		<div class="workbench__mast-links" aria-label="Workbench proof links">
			<a href="/preview/capability-page.demo/rev-001">Preview capability-page.demo/rev-001</a>
			<a href="/p/demo">Published pointer /p/demo</a>
			<span>Chrome local AI unavailable</span>
		</div>
	</header>

	<div class="workbench__grid">
		<nav class="workbench__nav" aria-label="Playground exhibits">
			{#each EXHIBITS as exhibit (exhibit.id)}
				<button
					type="button"
					class:active={activeExhibit === exhibit.id}
					aria-current={activeExhibit === exhibit.id ? "page" : undefined}
					onclick={() => selectExhibit(exhibit.id)}
				>
					<span>{exhibit.label}</span>
					<small>{exhibit.summary}</small>
				</button>
			{/each}
		</nav>

		<section class="workbench__controls" aria-label="Exhibit controls">
			<h2>Controls</h2>
			{#if activeExhibit === "grammar"}
				<label class="field" for="grammar-variant">
					<span>Primitive family</span>
					<select id="grammar-variant" value={grammarVariant} onchange={setGrammarVariant}>
						{#each GRAMMAR_VARIANTS as variant (variant)}
							<option value={variant}>{variant}</option>
						{/each}
					</select>
				</label>
			{:else if activeExhibit === "dialects"}
				<label class="field" for="dialect-select">
					<span>Global dialect</span>
					<select id="dialect-select" value={selectedDialectId} onchange={setDialect}>
						{#each DIALECT_OPTIONS as dialectId (dialectId)}
							<option value={dialectId}>{dialectId}</option>
						{/each}
					</select>
				</label>
			{:else if activeExhibit === "state"}
				<p class="control-copy">Use the rendered Morphe inputs and buttons in the preview.</p>
			{:else if activeExhibit === "vary"}
				<label class="field" for="vary-choice">
					<span>Choice demo.mode</span>
					<input
						id="vary-choice"
						type="range"
						min="0"
						max="2"
						step="1"
						value={selectedVaryChoice}
						oninput={setVaryChoice}
					/>
				</label>
			{:else if activeExhibit === "cms"}
				<div class="link-stack">
					<a href="/preview/capability-page.demo/rev-001">Preview route</a>
					<a href="/p/demo">Published route</a>
				</div>
			{:else if activeExhibit === "local-ai"}
				<label class="field" for="local-goal">
					<span>Prompt goal</span>
					<textarea id="local-goal" rows="4" bind:value={localGoal}></textarea>
				</label>
				<div class="button-row">
					<button type="button" onclick={runLocalAi} disabled={localBusy}>
						{localBusy ? "Checking..." : "Try Chrome local AI"}
					</button>
					<button type="button" onclick={resetLocalAi}>Reset fallback</button>
				</div>
				<p class="control-copy">Chrome local AI unavailable unless the browser exposes LanguageModel.</p>
			{/if}
		</section>

		<section class="workbench__preview" aria-label="Morphe preview">
			<MorpheRoot tree={presentation.tree} {store} {actions} {choices} />
			{#if activeExhibit === "dialects"}
				<div class="pinned">
					<MorpheRoot tree={presentPinnedDialectProof()} dialect={getDialect("night")} />
				</div>
			{/if}
		</section>

		<aside class="workbench__proof" aria-label="Proof rail">
			<h2>Proof rail</h2>
			<dl>
				{#each presentation.proof as item (item.label)}
					<div>
						<dt>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				{/each}
			</dl>
		</aside>
	</div>
</main>

<style>
	.workbench {
		min-block-size: 100vh;
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
	}
	.workbench__mast {
		padding: clamp(var(--mo-space-6), 6vw, var(--mo-space-9))
			clamp(var(--mo-space-4), 5vw, var(--mo-space-8)) var(--mo-space-5);
		max-inline-size: 82rem;
		margin-inline: auto;
	}
	.workbench__eyebrow {
		margin: 0 0 var(--mo-space-2);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-accession-on);
	}
	.workbench__mast h1 {
		margin: 0;
		max-inline-size: 14ch;
		font-family: var(--mo-font-display);
		font-size: clamp(var(--mo-type-7), 6vw, var(--mo-type-9));
		line-height: var(--mo-leading-tight);
	}
	.workbench__mast p:last-child {
		max-inline-size: 64ch;
		margin: var(--mo-space-3) 0 0;
		font-size: var(--mo-type-4);
		line-height: var(--mo-leading-normal);
		color: var(--mo-intent-on-surface-muted);
	}
	.workbench__mast-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-2);
		margin-block-start: var(--mo-space-4);
	}
	.workbench__mast-links a,
	.workbench__mast-links span {
		box-sizing: border-box;
		max-inline-size: 100%;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-2) var(--mo-space-3);
		background: var(--mo-intent-surface-raised);
		color: var(--mo-intent-on-surface);
		font-size: var(--mo-type-2);
		overflow-wrap: anywhere;
		text-decoration: none;
	}
	.workbench__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--mo-space-4);
		padding: 0 clamp(var(--mo-space-4), 5vw, var(--mo-space-8))
			clamp(var(--mo-space-6), 6vw, var(--mo-space-9));
		max-inline-size: 96rem;
		margin-inline: auto;
	}
	.workbench__nav,
	.workbench__controls,
	.workbench__proof {
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-raised);
	}
	.workbench__nav {
		display: grid;
		align-content: start;
		overflow: clip;
	}
	.workbench__nav button {
		display: grid;
		gap: var(--mo-space-1);
		inline-size: 100%;
		border: 0;
		border-block-end: 1px solid var(--mo-intent-outline);
		padding: var(--mo-space-3);
		background: transparent;
		color: inherit;
		text-align: start;
		font: inherit;
		cursor: pointer;
	}
	.workbench__nav button:last-child {
		border-block-end: 0;
	}
	.workbench__nav button:hover,
	.workbench__nav button.active {
		background: var(--mo-intent-surface-sunken);
	}
	.workbench__nav span {
		font-weight: 750;
	}
	.workbench__nav small,
	.control-copy,
	.workbench__proof dd {
		color: var(--mo-intent-on-surface-muted);
	}
	.workbench__controls,
	.workbench__proof {
		padding: var(--mo-space-4);
	}
	.workbench__controls h2,
	.workbench__proof h2 {
		margin: 0 0 var(--mo-space-3);
		font-size: var(--mo-type-4);
	}
	.field {
		display: grid;
		gap: var(--mo-space-2);
		font-size: var(--mo-type-3);
		font-weight: 700;
	}
	.field select,
	.field input,
	.field textarea,
	.button-row button,
	.link-stack a {
		box-sizing: border-box;
		inline-size: 100%;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font: inherit;
	}
	.field textarea {
		resize: vertical;
	}
	.button-row,
	.link-stack {
		display: grid;
		gap: var(--mo-space-2);
	}
	.button-row button {
		cursor: pointer;
		font-weight: 750;
	}
	.button-row button:disabled {
		cursor: wait;
		opacity: 0.64;
	}
	.link-stack a {
		text-decoration: none;
	}
	.workbench__preview {
		min-inline-size: 0;
	}
	.workbench__preview :global(.mo-root) {
		min-block-size: 100%;
	}
	.pinned {
		margin-block-start: var(--mo-space-4);
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		overflow: clip;
	}
	.workbench__proof dl {
		display: grid;
		gap: var(--mo-space-3);
		margin: 0;
	}
	.workbench__proof div {
		display: grid;
		gap: var(--mo-space-1);
		padding-block-end: var(--mo-space-3);
		border-block-end: 1px solid var(--mo-intent-outline);
	}
	.workbench__proof div:last-child {
		padding-block-end: 0;
		border-block-end: 0;
	}
	.workbench__proof dt {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-accession-on);
	}
	.workbench__proof dd {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: var(--mo-type-2);
	}
	@media (min-width: 72rem) {
		.workbench__grid {
			grid-template-columns: minmax(15rem, 0.8fr) minmax(16rem, 0.9fr) minmax(0, 2.4fr)
				minmax(14rem, 0.8fr);
			align-items: start;
		}
		.workbench__nav,
		.workbench__controls,
		.workbench__proof {
			position: sticky;
			inset-block-start: var(--mo-space-4);
		}
	}
</style>

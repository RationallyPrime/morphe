<script lang="ts">
	/*
	 * /compose — "What can Sókrates do for you?"
	 *
	 * MARKETING SURFACE destined for the website; it currently lives in morphe so
	 * it can be authored against the grammar directly. A visitor states a pain
	 * point and names the systems they run; we compose concrete cross-system
	 * automations, each one cited to real endpoints and real compiled model names.
	 *
	 * This is READ-ONLY. The surface shows the MAP of what Sókrates can compose; it
	 * does not touch the visitor's systems. The appliance is what acts, under
	 * governance — never here.
	 *
	 * Structure mirrors the dignity demo: a native control surface (the question +
	 * the input field + system selection) sits OUTSIDE the rendered Morphe tree as
	 * the τ_frame control. The control's $state drives a pure, reactive pipeline —
	 * parse -> match -> present -> render — and MorpheRoot renders the resulting
	 * Node tree under the default dialect. Matching and presenting are pure and
	 * SSR-safe; nothing here reads window/document at module scope.
	 */

	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import { icelandicArchive } from "$morphe";
	import {
		CAPABILITIES,
		CATEGORY_LABELS,
		composeAnswer,
		emptyState,
		featuredCapabilities,
		matchCapabilities,
		parseQuery,
		registerComposeCompounds,
		SYSTEMS,
	} from "$lib/compose";
	import type { Capability } from "$lib/compose";

	// Register the five compose compounds through the factory gate. Idempotent —
	// safe under HMR and repeated imports. Done at module-eval so the registry is
	// ready before the tree renders.
	registerComposeCompounds();

	// The default number of cards the answer shows before the visitor asks for
	// the rest. Matches composeAnswer's own DEFAULT_LIMIT so the "Show all" button
	// appears exactly when the answer was actually capped.
	const COLLAPSED_LIMIT = 9;

	// Control-surface state. `pain` + `selected` are what the visitor edits; the
	// RANKING is computed on SUBMIT (the Voyage reranker runs server-side), not live
	// as you type. `showAll` is a pure chrome affordance that caps the answer at
	// COLLAPSED_LIMIT cards until the visitor opts in.
	let pain = $state("");
	let selected = $state<string[]>(SYSTEMS.map((s) => s.id));
	let showAll = $state(false);

	// The last submitted ranking: capability ids over the WHOLE corpus in relevance
	// order. The server ranks everything once; we filter by the current selection
	// below, so toggling a system is instant and needs no re-rank. null = nothing
	// submitted yet (the surface shows the featured breadth).
	let rankedIds = $state<string[] | null>(null);
	let ranking = $state(false); // a rerank request is in flight
	let rankedBy = $state<"voyage" | "local" | null>(null);
	// The pain that produced `rankedIds` — lets us flag when the field has drifted.
	let submittedPain = $state("");

	function toggleSystem(id: string): void {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	const query = $derived(parseQuery({ pain, systems: selected }));

	// Deterministic full-corpus ranking — the local floor and the fallback when the
	// reranker is unavailable. matchCapabilities returns only tag-matched eligible
	// caps, so we rank by it then append the rest to get a stable total order over
	// every capability (the same shape the reranker returns).
	function localRankIds(painText: string): string[] {
		const q = parseQuery({ pain: painText, systems: SYSTEMS.map((s) => s.id) });
		const matched = matchCapabilities(q).map((c) => c.id);
		const seen = new Set(matched);
		const rest = CAPABILITIES.filter((c) => !seen.has(c.id)).map((c) => c.id);
		return [...matched, ...rest];
	}

	// Submit: rank the corpus against the stated pain. Voyage when available, the
	// deterministic matcher as a silent fallback — the surface never shows an error.
	async function compose(): Promise<void> {
		showAll = false;
		const painText = pain.trim();
		submittedPain = painText;
		if (painText.length === 0) {
			// Empty pain -> back to the featured breadth (no ranking).
			rankedIds = null;
			rankedBy = null;
			return;
		}
		ranking = true;
		try {
			const res = await fetch("/compose/rerank", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pain: painText }),
			});
			const data = (await res.json()) as {
				source?: string;
				ranked?: { id: string; score: number }[];
			};
			if (data.source === "voyage" && Array.isArray(data.ranked) && data.ranked.length > 0) {
				rankedIds = data.ranked.map((r) => r.id);
				rankedBy = "voyage";
			} else {
				rankedIds = localRankIds(painText);
				rankedBy = "local";
			}
		} catch {
			rankedIds = localRankIds(painText);
			rankedBy = "local";
		} finally {
			ranking = false;
		}
	}

	// The button is the primary path; Cmd/Ctrl+Enter from the field also submits.
	function onPainKeydown(e: KeyboardEvent): void {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			void compose();
		}
	}

	// The ranked caps to show: the submitted ranking resolved to caps and filtered
	// to the current selection (so a toggle re-filters instantly). null before submit.
	const ranked = $derived.by<Capability[] | null>(() => {
		if (rankedIds === null) return null;
		const byId = new Map(CAPABILITIES.map((c) => [c.id, c]));
		const sel = new Set(selected);
		const out: Capability[] = [];
		for (const id of rankedIds) {
			const cap = byId.get(id);
			if (cap && cap.systems.every((s) => sel.has(s))) out.push(cap);
		}
		return out;
	});

	// Cards on screen: the reranked answer after submit, else the featured breadth so
	// the surface is never blank. Both obey the same collapse + "Show all" affordance.
	const limit = $derived(showAll ? Number.POSITIVE_INFINITY : COLLAPSED_LIMIT);
	const results = $derived.by<readonly Capability[]>(() =>
		ranked !== null && ranked.length > 0 ? ranked : featuredCapabilities(query.systems),
	);
	const tree = $derived.by(() =>
		ranked !== null && ranked.length > 0
			? composeAnswer(ranked, query, limit)
			: emptyState(query, results, limit),
	);
	const hiddenCount = $derived(showAll ? 0 : Math.max(0, results.length - COLLAPSED_LIMIT));

	// The field has drifted from the submitted ranking — invite a re-compose.
	const stale = $derived(rankedIds !== null && pain.trim() !== submittedPain);

	// Re-collapse "Show all" when the selection changes (a different subset is a new
	// view). Pain-submit collapse is handled in compose(). Effects skip SSR, so the
	// server renders the collapsed default — SSR-safe.
	$effect(() => {
		void selected.join(",");
		showAll = false;
	});
</script>

<svelte:head>
	<title>What can Sókrates do for you?</title>
	<meta
		name="description"
		content="State a pain point and name your systems; Sókrates composes concrete cross-system automations, each one cited to real endpoints and compiled model names. Read-only: it shows the map, it does not touch your systems."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
	/>
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=block"
	/>
</svelte:head>

<div class="page">
	<!--
	  The control surface is OUTSIDE the rendered tree — it is the τ_frame control,
	  not part of the composed answer. Editing the field or toggling a system swaps
	  the query handed to the pure pipeline; MorpheRoot below re-renders the answer.
	-->
	<header class="control">
		<div class="control__brand">
			<img class="control__mark" src="/sokrates-mark.svg" alt="" aria-hidden="true" width="28" height="28" />
			<p class="control__kicker">Sókrates · Composer</p>
		</div>

		<h1 class="control__title">What can Sókrates do for you?</h1>
		<p class="control__lede">
			Name the friction and the systems you run. Sókrates composes concrete
			cross-system automations, each one cited to real endpoints and the models it
			compiled from your specs. This shows the map of what is possible. It is
			read-only; it does not touch your systems.
		</p>

		<form
			class="control__form"
			onsubmit={(e) => {
				e.preventDefault();
				void compose();
			}}
		>
			<div class="field">
				<label class="field__label" for="compose-pain">Describe the friction</label>
				<textarea
					id="compose-pain"
					class="field__input"
					rows="3"
					placeholder="e.g. shift planning is slow and error prone, and overtime keeps blowing the budget"
					bind:value={pain}
					onkeydown={onPainKeydown}
				></textarea>
			</div>

			<fieldset class="systems">
				<legend class="systems__legend">Which systems do you run?</legend>
				<div class="systems__options">
					{#each SYSTEMS as system (system.id)}
						<label class="chip" data-active={selected.includes(system.id)}>
							<input
								type="checkbox"
								class="chip__input"
								checked={selected.includes(system.id)}
								onchange={() => toggleSystem(system.id)}
							/>
							<span class="chip__dot" aria-hidden="true"></span>
							<span class="chip__label">{system.label}</span>
							<span class="chip__cat">{CATEGORY_LABELS[system.category]}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="actions">
				<button type="submit" class="actions__submit" disabled={ranking}>
					{ranking ? "Ranking…" : "Compose"}
				</button>
				{#if stale}
					<span class="actions__hint">Press Compose to update the results.</span>
				{/if}
			</div>
		</form>

		<p class="control__note">
			Composed live as you type. Nothing is sent and nothing is changed. The
			appliance is what acts, under governance.
		</p>
	</header>

	<main class="surface">
		<MorpheRoot tree={tree} dialect={icelandicArchive} />
	</main>

	<!--
	  "Show all" is page CHROME, not part of the composed answer; it lives OUTSIDE
	  the Morphe tree, mirroring the system checkboxes above. It appears only when
	  the collapsed view actually hid cards (hiddenCount > 0); clicking it lifts the
	  cap so the full ranked set renders. A new search re-collapses (the $effect),
	  so the button reappears for the next query when there is more to reveal.
	-->
	{#if hiddenCount > 0}
		<div class="more">
			<button type="button" class="more__button" onclick={() => (showAll = true)}>
				<span class="more__glyph material-symbols-outlined" aria-hidden="true">expand_more</span>
				Show all {results.length}
			</button>
		</div>
	{/if}
</div>

<style>
	/*
	 * Page chrome only. The composed answer below gets ALL its styling from the
	 * core's tokens via MorpheRoot; this shell reads from the same --mo-* vars so
	 * the frame around the answer stays consistent with the active dialect.
	 */
	.page {
		max-width: 1080px;
		margin-inline: auto;
		padding: clamp(1.25rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem) 4rem;
		min-height: 100vh;
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
		padding-block-end: var(--mo-space-6);
	}

	.control__brand {
		display: flex;
		align-items: center;
		gap: var(--mo-space-3);
	}
	.control__mark {
		inline-size: 1.75rem;
		block-size: 1.75rem;
		display: block;
		flex: none;
	}
	.control__kicker {
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--mo-intent-accession-on);
	}

	.control__title {
		margin: 0;
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-8);
		font-weight: 500;
		line-height: 1.05;
		color: var(--mo-intent-on-surface);
		max-inline-size: 18ch;
	}
	.control__lede {
		margin: 0;
		max-inline-size: 60ch;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		line-height: 1.55;
		color: var(--mo-intent-on-surface-muted);
	}

	.control__form {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
		margin-block-start: var(--mo-space-3);
		max-inline-size: 60ch;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.field__label {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
	}
	.field__input {
		width: 100%;
		padding: var(--mo-space-4);
		border: 0;
		border-radius: var(--mo-radius-2);
		background: var(--mo-intent-surface-raised);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		line-height: 1.5;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		resize: vertical;
	}
	.field__input::placeholder {
		color: var(--mo-intent-on-surface-muted);
		opacity: 1;
	}
	.field__input:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 1px;
	}

	.systems {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-2);
	}
	.systems__legend {
		padding: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
	}
	.systems__options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-3);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-3);
		padding: var(--mo-space-3) var(--mo-space-5);
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-raised);
		color: var(--mo-intent-on-surface-muted);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 500;
		cursor: pointer;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		transition:
			color 160ms ease,
			outline-color 160ms ease;
	}
	.chip[data-active="true"] {
		color: var(--mo-intent-on-surface);
		outline-color: var(--mo-intent-accession-on);
	}
	.chip:focus-within {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 1px;
	}
	/* The native checkbox stays in the a11y tree but the chip carries the visuals. */
	.chip__input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.chip__dot {
		inline-size: 0.6rem;
		block-size: 0.6rem;
		border-radius: var(--mo-radius-full);
		background: var(--mo-intent-outline);
		flex: none;
		transition: background-color 160ms ease;
	}
	.chip[data-active="true"] .chip__dot {
		background: var(--mo-intent-accession-on);
	}
	/* The product name carries the chip; the category is a quiet system-agnostic tag. */
	.chip__cat {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
	}

	/* The primary action of the control surface: submit composes the answer. The
	   beacon (primary-action) is used sparingly — this single button earns it. */
	.actions {
		display: flex;
		align-items: center;
		gap: var(--mo-space-4);
		flex-wrap: wrap;
		margin-block-start: var(--mo-space-2);
	}
	.actions__submit {
		appearance: none;
		border: 0;
		cursor: pointer;
		padding: var(--mo-space-3) var(--mo-space-6);
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-primary-action-surface);
		color: var(--mo-intent-primary-action-on);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 600;
		transition:
			background-color 160ms ease,
			opacity 160ms ease;
	}
	.actions__submit:hover {
		background: var(--mo-intent-primary-action-hover);
	}
	.actions__submit:active {
		background: var(--mo-intent-primary-action-active);
	}
	.actions__submit:disabled {
		background: var(--mo-intent-primary-action-disabled);
		cursor: default;
	}
	.actions__submit:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.actions__hint {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
	}

	.control__note {
		margin: 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
	}

	/* The answer surface: a sunken well the composed tree sits in. */
	.surface {
		border-radius: var(--mo-radius-3);
		overflow: clip;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}

	/*
	 * "Show all" chrome: a quiet, centered affordance under the collapsed answer.
	 * Reads from the same --mo-* tokens as the chips so it stays consistent with the
	 * active dialect; the amber beacon is reserved for the answer, so this control
	 * stays neutral until focus/hover.
	 */
	.more {
		display: flex;
		justify-content: center;
		margin-block-start: var(--mo-space-4);
	}
	.more__button {
		display: inline-flex;
		align-items: center;
		gap: var(--mo-space-2);
		padding: var(--mo-space-3) var(--mo-space-5);
		border: 0;
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-raised);
		color: var(--mo-intent-on-surface-muted);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-3);
		letter-spacing: 0.02em;
		cursor: pointer;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
		transition:
			color 160ms ease,
			outline-color 160ms ease;
	}
	.more__button:hover {
		color: var(--mo-intent-on-surface);
		outline-color: var(--mo-intent-accession-on);
	}
	.more__button:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 1px;
		color: var(--mo-intent-on-surface);
	}
	.more__glyph {
		font-size: var(--mo-type-4);
		line-height: 1;
	}
</style>

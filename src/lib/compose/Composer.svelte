<script lang="ts">
/*
 * Composer — "What can Sókrates do for you?" as an EMBEDDABLE section.
 *
 * The interactive centerpiece of the marketing site. A visitor states a pain
 * point and names the systems they run; we rank concrete cross-system automations,
 * each cited to real endpoints and real compiled model names.
 *
 * READ-ONLY by construction: the surface shows the MAP of what Sókrates can do; it
 * does not touch the visitor's systems. The appliance is what acts, under governance.
 *
 * RANKING (ADR-0002, WS9): on submit we POST { pain, systems } to /api/rerank, which
 * runs the two-stage pipeline server-side (embed query -> system-aware cosine retrieve
 * -> rerank the shortlist) and returns { id, score } in relevance order. The client
 * applies the RELEVANCE POLICY (D4/D5) on those scores — off-domain refusal / thin
 * invite / strong, capped at the top few — where the on-voice copy lives. Voyage
 * unavailable falls back to the deterministic tag matcher (already relevance-gated).
 *
 * Structure follows the Morphe idiom: the control surface (the question + field +
 * system selection + submit) is NATIVE and sits OUTSIDE the rendered Morphe tree; the
 * pure pipeline (parse -> rank -> present) drives a Node tree that MorpheRoot renders
 * under the active dialect. Nothing reads window/document at module scope (SSR-safe).
 */

import type { Capability } from "$lib/compose";
import {
	CAPABILITIES,
	CATEGORY_LABELS,
	composeAnswer,
	emptyState,
	featuredCapabilities,
	matchCapabilities,
	offDomainState,
	parseQuery,
	registerComposeCompounds,
	SYSTEMS,
	thinMatchState,
} from "$lib/compose";
import MorpheRoot from "$morphe/render/MorpheRoot.svelte";

// Register the compose compounds through the factory gate. Idempotent — safe under
// HMR and repeated imports. Done at module-eval so the registry is ready to render.
registerComposeCompounds();

// How many cards a strong/thin answer shows. The pitch is JUDGMENT, not breadth: the
// answer IS the result, the most-relevant few led by one dominant card — there is no
// "show all" and no corpus count (D5).
const RESULT_LIMIT = 4;

// Relevance thresholds on the reranker's score (D4). Tuned from the live smoke
// (ADR-0002 / redesign-plan WS9): real ops matches land 0.50–0.62, off-domain
// ("cinnamon hot dogs") tops out ~0.24. A floor of 0.35 cleanly rejects off-domain;
// 0.45 splits a confident "strong" answer from a "thin / near-but-not-on" one. These
// are tunable constants, not a model property — refine against real queries.
const SCORE_FLOOR = 0.35;
const SCORE_STRONG = 0.45;

/** A capability id with its reranker score, or null for the deterministic fallback. */
interface Scored {
	id: string;
	score: number | null;
}

// Control-surface state. `pain` + `selected` are what the visitor edits; the RANKING
// is computed on SUBMIT (the pipeline runs server-side), not live as you type.
let pain = $state("");
let selected = $state<string[]>(SYSTEMS.map((s) => s.id));

// The last submitted ranking, or null before anything is submitted (the surface then
// shows the featured breadth). `source` distinguishes the scored Voyage path (which the
// relevance policy gates) from the deterministic fallback (already tag-gated, no scores).
let result = $state<{ source: "voyage" | "local"; scored: Scored[] } | null>(null);
let ranking = $state(false); // a rank request is in flight
let submittedPain = $state(""); // the pain that produced `result` (drives the stale hint)

const byId = new Map<string, Capability>(CAPABILITIES.map((c) => [c.id, c]));

// Debounced re-rank when the system selection changes after a submit: retrieval is
// SYSTEM-AWARE now (ADR-0002), so a different selection is a different query — the old
// "rank once, filter client-side" instant toggle is intentionally gone.
let toggleTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRerank(): void {
	if (result === null || submittedPain.length === 0) return;
	clearTimeout(toggleTimer);
	toggleTimer = setTimeout(() => void compose(), 300);
}

function toggleSystem(id: string): void {
	selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	scheduleRerank();
}

const query = $derived(parseQuery({ pain, systems: selected }));
const featured = $derived(featuredCapabilities(query.systems));

// Deterministic fallback: the tag matcher is already relevance-gated (it returns []
// for an unrecognized pain — no padding to the full corpus), so its matches are the
// honest fallback when Voyage is unavailable.
function localMatches(painText: string): Scored[] {
	const q = parseQuery({ pain: painText, systems: selected });
	return matchCapabilities(q).map((c) => ({ id: c.id, score: null }));
}

// Submit: rank the corpus against the stated pain via the pipeline. Voyage when
// available, the deterministic matcher as a silent fallback — the surface never errors.
async function compose(): Promise<void> {
	const painText = pain.trim();
	submittedPain = painText;
	if (painText.length === 0) {
		result = null;
		return;
	}
	ranking = true;
	try {
		const res = await fetch("/api/rerank", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pain: painText, systems: selected }),
		});
		const data = (await res.json()) as {
			source?: string;
			ranked?: { id: string; score: number }[];
		};
		result =
			data.source === "voyage" && Array.isArray(data.ranked)
				? { source: "voyage", scored: data.ranked }
				: { source: "local", scored: localMatches(painText) };
	} catch {
		result = { source: "local", scored: localMatches(painText) };
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

// Resolve scored ids to capabilities, preserving rank order and re-filtering by the
// CURRENT selection (defensive against the brief stale window between a toggle and its
// debounced re-rank). Drops any id not in the corpus or no longer system-eligible.
function resolveCaps(scored: Scored[]): { cap: Capability; score: number | null }[] {
	const sel = new Set(selected);
	const out: { cap: Capability; score: number | null }[] = [];
	for (const s of scored) {
		const cap = byId.get(s.id);
		if (cap && cap.systems.every((id) => sel.has(id))) out.push({ cap, score: s.score });
	}
	return out;
}

// The answer tree: the relevance policy (D4/D5) over the submitted ranking.
const tree = $derived.by(() => {
	if (result === null) return emptyState(query, featured);

	const resolved = resolveCaps(result.scored);
	// No eligible capability for this selection (e.g. nothing selected) — or a transient
	// stale-filter window after a toggle: show the breadth, never the off-domain refusal.
	if (resolved.length === 0) return emptyState(query, featured);

	// Deterministic fallback: the matcher is the gate; no score threshold to apply.
	if (result.source === "local") {
		return composeAnswer(
			resolved.slice(0, RESULT_LIMIT).map((r) => r.cap),
			query,
			RESULT_LIMIT,
		);
	}

	// Voyage path: gate on the reranker score (D4).
	const aboveFloor = resolved.filter((r) => (r.score ?? 0) >= SCORE_FLOOR);
	if (aboveFloor.length === 0) return offDomainState(); // off-domain: honest refusal, no cards
	const shown = aboveFloor.slice(0, RESULT_LIMIT).map((r) => r.cap);
	const top = aboveFloor[0]?.score ?? 0;
	return top >= SCORE_STRONG
		? composeAnswer(shown, query, RESULT_LIMIT) // strong match
		: thinMatchState(shown, query); // thin / near-but-not-on
});

// The field has drifted from the submitted ranking — invite a re-compose.
const stale = $derived(result !== null && pain.trim() !== submittedPain);
</script>

<div class="composer">
	<!--
	  The control surface is OUTSIDE the rendered tree — it is the τ_frame control,
	  not part of the composed answer. Editing the field or toggling a system swaps the
	  query handed to the pipeline; MorpheRoot below re-renders the answer.
	-->
	<header class="control">
		<h2 class="control__title">What can Sókrates do for you?</h2>
		<p class="control__lede">
			Name the friction and the systems you run. Sókrates surfaces concrete
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
				<p class="systems__unlisted">
					Run a system we don't list?
					<a class="systems__unlisted-link" href="/#contact">Tell us, we'll map it.</a>
				</p>
			</fieldset>

			<div class="actions">
				<button type="submit" class="actions__submit" disabled={ranking}>
					{ranking ? "Ranking…" : "Show me what's possible"}
				</button>
				{#if stale}
					<span class="actions__hint">Run it again to update the results.</span>
				{/if}
			</div>
		</form>

		<p class="control__note">
			Ranked on submit. It reads nothing from your systems and changes nothing.
			The appliance is what acts, under governance.
		</p>
	</header>

	<main class="surface">
		<MorpheRoot {tree} />
	</main>
</div>

<style>
	/*
	 * Page chrome only. The composed answer below gets ALL its styling from the
	 * core's tokens via MorpheRoot; this shell reads from the same --mo-* vars so the
	 * frame around the answer stays consistent with the active dialect. The component
	 * fills its container — the page section owns width + outer padding.
	 */
	.composer {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-5);
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
	}

	.control__title {
		margin: 0;
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-7);
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.02em;
		color: var(--mo-intent-on-surface);
		max-inline-size: 18ch;
		text-wrap: balance;
	}
	.control__lede {
		margin: 0;
		max-inline-size: 62ch;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-4);
		line-height: 1.55;
		color: var(--mo-intent-on-surface-muted);
	}

	.control__form {
		display: flex;
		flex-direction: column;
		gap: var(--mo-space-4);
		margin-block-start: var(--mo-space-2);
		max-inline-size: 62ch;
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
	/*
	 * The unlisted-system path (D4): the HIGHEST-intent lead — real cross-system pain
	 * blocked only by corpus coverage. A quiet line, not a beacon. Today it routes to
	 * the contact section; it upgrades to capture-the-system + Postmark with WS8.
	 */
	.systems__unlisted {
		margin: var(--mo-space-2) 0 0;
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		color: var(--mo-intent-on-surface-muted);
	}
	.systems__unlisted-link {
		color: var(--mo-intent-on-surface);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.systems__unlisted-link:hover {
		color: var(--mo-intent-accession-on);
	}
	.systems__unlisted-link:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
		border-radius: var(--mo-radius-1);
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
	.chip__cat {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--mo-intent-on-surface-muted);
	}

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

	.surface {
		border-radius: var(--mo-radius-3);
		overflow: clip;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
</style>

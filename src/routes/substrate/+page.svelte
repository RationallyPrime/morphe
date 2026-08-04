<script lang="ts">
	import type {
		ActionMap,
		ChoiceMap,
		ContextDigest,
		JsonRecord,
		MidLoopEvidenceRecord,
		MidLoopRuntime,
		MidLoopRuntimeResult,
		MidLoopRuntimeState,
		Tier2Escalation,
	} from "$lib";
	import {
		activeDialect,
		applyUserOverride,
		bindDeterministicObjectivePolicy,
		createDeterministicObjectiveDelegate,
		createInMemoryMorpheStore,
		createMidLoopRuntimeState,
		digestOf,
		getDialect,
		liveVariationIndex,
		reemitMidLoop,
		registry,
		restrictCompounds,
		runMidLoop,
	} from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { DEFAULT_EXHIBIT, DIALECT_OPTIONS, EXHIBITS } from "../_playground/exhibits.js";
	import { FALLBACK_LOCAL_ADAPTIVE_DRAFT, fallbackDiagnostics } from "../_playground/fallback.js";
	import type { KernelProofCaseId } from "../_playground/kernel-proof.js";
	import {
		DEFAULT_KERNEL_PROOF_CASE_ID,
		isKernelProofCaseId,
		KERNEL_PROOF_CASES,
	} from "../_playground/kernel-proof.js";
	import { LIVE_PROOF_IDS, LIVE_PROOF_STORE_PATH } from "../_playground/live-proof-contract.js";
	import { generateLocalAdaptiveDraft } from "../_playground/local-ai.js";
	import {
	presentPinnedDialectProof,
	presentPlayground,
	presentVaryDelta,
} from "../_playground/presenters.js";
	import type { ExhibitId, GrammarVariant, ProviderSource } from "../_playground/types.js";
	import { GRAMMAR_VARIANTS } from "../_playground/types.js";
	import type { LocalAdaptiveDraft } from "../_playground/validation.js";
	import { LIVE_PROOF_POLICY } from "./live-proof.js";

	const store = createInMemoryMorpheStore({
		"gold.note": "Verify the complete evidence chain",
		"gold.posture": "observe",
		"gold.reviewed": false,
		"gold.confidence": 72,
		"playground.goal": "Review an exception queue",
		"playground.reviewed": false,
		[LIVE_PROOF_STORE_PATH]: "evidence",
	}, { now: () => 0 });

	let activeExhibit = $state<ExhibitId>(DEFAULT_EXHIBIT);
	let grammarVariant = $state<GrammarVariant>("layout");
	let kernelProofCaseId = $state<KernelProofCaseId>(DEFAULT_KERNEL_PROOF_CASE_ID);
	let goldModeChoice = $state(0);
	let goldDetailChoice = $state(0);
	let goldDensityChoice = $state(1);
	let actionLog = $state<readonly string[]>([]);
	let localGoal = $state("Review an exception queue");
	let localDraft = $state<LocalAdaptiveDraft>(FALLBACK_LOCAL_ADAPTIVE_DRAFT);
	let localSource = $state<ProviderSource>("chrome-unavailable");
	let localDiagnostics = $state<readonly string[]>(["chrome-unavailable:LanguageModel"]);
	let localBusy = $state(false);
	const liveProofTree = presentVaryDelta();
	let liveProofState = $state<MidLoopRuntimeState>(
		createMidLoopRuntimeState({ epoch: 1, tree: liveProofTree, choices: {} }),
	);
	let liveProofLedger = $state<readonly MidLoopEvidenceRecord[]>([]);
	let liveProofDigest = $state<ContextDigest | undefined>(undefined);
	let liveProofReplay = $state<"not-run" | "stable" | "mismatch">("not-run");
	let tier2Receipts = $state<readonly Tier2Escalation[]>([]);

	const liveProofDialect = $derived(getDialect(activeDialect.id));
	const liveProofResolver = $derived(
		restrictCompounds(registry, { allow: liveProofDialect.compounds }),
	);
	const liveProofIndex = $derived(
		liveVariationIndex(liveProofTree, { resolver: liveProofResolver }),
	);
	const liveProofPolicy = $derived(
		bindDeterministicObjectivePolicy(LIVE_PROOF_POLICY, liveProofIndex),
	);
	const liveProofRuntime = $derived<MidLoopRuntime>({
		policy: liveProofPolicy,
		delegate: createDeterministicObjectiveDelegate({
			policy: liveProofPolicy,
			epoch: liveProofState.envelope.epoch,
		}),
	});

	const exhibitChoices = $derived<ChoiceMap>({
		"gold.mode": goldModeChoice,
		"gold.detail": goldDetailChoice,
		"gold.density": goldDensityChoice,
	});
	const choices = $derived<ChoiceMap>(
		activeExhibit === "vary" ? liveProofState.envelope.choices : exhibitChoices,
	);
	const actions = $derived<ActionMap>({
		"gold.advance": () => {
			goldModeChoice = (goldModeChoice + 1) % 3;
			recordAction("gold.advance");
		},
		"gold.attest": () => recordAction("gold.attest"),
		"mint.record": () => recordAction("mint.record"),
		"demo.rotate": () => recordAction("demo.rotate"),
		"demo.review": () => recordAction("demo.review"),
		"local-ai.next": () => recordAction("local-ai.next"),
	});
	const storeSnapshot = $derived<JsonRecord>(store.snapshot());
	const presentation = $derived(
		presentPlayground({
			activeExhibit,
			grammarVariant,
			activeDialectId: activeDialect.id,
			actionLog,
			storeSnapshot,
			localDraft,
			localSource,
			localDiagnostics,
			kernelProofCaseId,
		}),
	);
	const renderedTree = $derived(activeExhibit === "vary" ? liveProofTree : presentation.tree);

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
		activeDialect.setById(value);
	}

	function setKernelProofCase(event: Event): void {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (isKernelProofCaseId(value)) kernelProofCaseId = value;
	}

	function setGoldModeChoice(event: Event): void {
		goldModeChoice = Number((event.currentTarget as HTMLInputElement).value);
	}

	function setGoldDetailChoice(event: Event): void {
		goldDetailChoice = Number((event.currentTarget as HTMLInputElement).value);
	}

	function setGoldDensityChoice(event: Event): void {
		goldDensityChoice = Number((event.currentTarget as HTMLInputElement).value);
	}

	async function runLocalAi(): Promise<void> {
		localBusy = true;
		try {
			const result = await generateLocalAdaptiveDraft({
				goal: localGoal,
				dialectId: activeDialect.id,
			});
			localDraft = result.draft;
			localSource = result.source;
			localDiagnostics = result.diagnostics;
		} catch {
			localDraft = FALLBACK_LOCAL_ADAPTIVE_DRAFT;
			localSource = "fallback";
			localDiagnostics = fallbackDiagnostics("provider-threw");
		} finally {
			localBusy = false;
		}
	}

	function resetLocalAi(): void {
		localDraft = FALLBACK_LOCAL_ADAPTIVE_DRAFT;
		localSource = "fallback";
		localDiagnostics = fallbackDiagnostics("manual-reset");
	}

	function captureLiveProofDigest(): ContextDigest {
		const digest = digestOf(store);
		liveProofDigest = digest;
		return digest;
	}

	function appendLiveProof(result: MidLoopRuntimeResult): void {
		liveProofState = result.state;
		liveProofLedger = [...liveProofLedger, ...result.records].slice(-24);
	}

	function runDeterministicPolicy(): void {
		appendLiveProof(runMidLoop(liveProofRuntime, liveProofState, captureLiveProofDigest()));
	}

	function rejectOutOfPolicySocket(): void {
		appendLiveProof(
			applyUserOverride(liveProofRuntime, liveProofState, captureLiveProofDigest(), {
				id: LIVE_PROOF_IDS.hostOnly,
				choice: 1,
				epoch: liveProofState.envelope.epoch,
			}),
		);
	}

	function replayStaleEpoch(): void {
		appendLiveProof(
			applyUserOverride(liveProofRuntime, liveProofState, captureLiveProofDigest(), {
				id: LIVE_PROOF_IDS.mode,
				choice: 1,
				epoch: liveProofState.envelope.epoch - 1,
			}),
		);
	}

	function applyLiveProofUserOverride(): void {
		const current = liveProofState.envelope.choices[LIVE_PROOF_IDS.mode] ?? 1;
		const choice = current === 0 ? 2 : 0;
		appendLiveProof(
			applyUserOverride(liveProofRuntime, liveProofState, captureLiveProofDigest(), {
				id: LIVE_PROOF_IDS.mode,
				choice,
				epoch: liveProofState.envelope.epoch,
			}),
		);
	}

	function reemitLiveProof(): void {
		appendLiveProof(
			reemitMidLoop(
				liveProofRuntime,
				liveProofState,
				{
					epoch: liveProofState.envelope.epoch + 1,
					tree: liveProofTree,
					choices: {},
				},
				captureLiveProofDigest(),
			),
		);
	}

	function compareLiveProofReplay(): void {
		const digest = captureLiveProofDigest();
		const first = runMidLoop(liveProofRuntime, liveProofState, digest);
		const second = runMidLoop(liveProofRuntime, liveProofState, digest);
		liveProofReplay = JSON.stringify(first) === JSON.stringify(second) ? "stable" : "mismatch";
		appendLiveProof(first);
	}

	function onEscalate(receipt: Tier2Escalation): void {
		tier2Receipts = [...tier2Receipts, receipt].slice(-8);
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
		<p class="workbench__intro">
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
				{#if activeExhibit === "gold"}
					<label class="field" for="dialect-select">
						<span>Global dialect</span>
						<select id="dialect-select" value={activeDialect.id} onchange={setDialect}>
							{#each DIALECT_OPTIONS as dialectId (dialectId)}
								<option value={dialectId}>{dialectId}</option>
							{/each}
						</select>
					</label>
					<label class="field" for="gold-mode-choice">
						<span>Vary gold.mode · {goldModeChoice}</span>
						<input
							id="gold-mode-choice"
							type="range"
							min="0"
							max="2"
							step="1"
							value={goldModeChoice}
							oninput={setGoldModeChoice}
						/>
					</label>
					<label class="field" for="gold-detail-choice">
						<span>Within gold.detail · {goldDetailChoice === 0 ? "open" : "closed"}</span>
						<input
							id="gold-detail-choice"
							type="range"
							min="0"
							max="1"
							step="1"
							value={goldDetailChoice}
							oninput={setGoldDetailChoice}
						/>
					</label>
					<label class="field" for="gold-density-choice">
						<span>Within gold.density · {goldDensityChoice}</span>
						<input
							id="gold-density-choice"
							type="range"
							min="0"
							max="2"
							step="1"
							value={goldDensityChoice}
							oninput={setGoldDensityChoice}
						/>
					</label>
				{:else if activeExhibit === "compounds"}
					<label class="field" for="dialect-select">
						<span>Global dialect</span>
						<select id="dialect-select" value={activeDialect.id} onchange={setDialect}>
							{#each DIALECT_OPTIONS as dialectId (dialectId)}
								<option value={dialectId}>{dialectId}</option>
							{/each}
						</select>
					</label>
					<p class="control-copy">
						Sixteen complete fixtures; ActionSummary remains the separately certified gold benchmark.
					</p>
				{:else if activeExhibit === "grammar"}
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
					<select id="dialect-select" value={activeDialect.id} onchange={setDialect}>
						{#each DIALECT_OPTIONS as dialectId (dialectId)}
							<option value={dialectId}>{dialectId}</option>
						{/each}
					</select>
				</label>
			{:else if activeExhibit === "state"}
				<p class="control-copy">
					Goal: {String(storeSnapshot["playground.goal"])} · Reviewed:
					{String(storeSnapshot["playground.reviewed"])}
				</p>
			{:else if activeExhibit === "vary"}
				<div class="midloop">
					<p class="control-copy">
						One declared policy observes <code>{LIVE_PROOF_STORE_PATH}</code> and tier-1
						<code>selection</code> only. Every native proposal enters the same canonical Delta
						admission path.
					</p>
					<div class="midloop__actions" aria-label="Deterministic mid-loop controls">
						<button type="button" onclick={runDeterministicPolicy}>Run policy</button>
						<button type="button" onclick={rejectOutOfPolicySocket}>
							Reject structurally live host-only socket
						</button>
						<button type="button" onclick={replayStaleEpoch}>Replay stale epoch</button>
						<button type="button" onclick={applyLiveProofUserOverride}>
							Apply user override
						</button>
						<button type="button" onclick={reemitLiveProof}>
							Re-emit strictly newer epoch
						</button>
						<button type="button" onclick={compareLiveProofReplay}>
							Compare identical replay inputs
						</button>
					</div>
					<dl class="midloop__state" aria-label="Native deterministic host state">
						<div>
							<dt>epoch</dt>
							<dd>{liveProofState.envelope.epoch}</dd>
						</div>
						<div>
							<dt>policy</dt>
							<dd>{liveProofPolicy.id}</dd>
						</div>
						<div>
							<dt>live sockets</dt>
							<dd>{liveProofIndex.descriptors.map((descriptor) => descriptor.id).join(", ")}</dd>
						</div>
						<div>
							<dt>user locks</dt>
							<dd>
								{liveProofState.lockedIds.length === 0
									? "none"
									: liveProofState.lockedIds.join(", ")}
							</dd>
						</div>
						<div>
							<dt>digest</dt>
							<dd>
								{liveProofDigest === undefined
									? "not captured"
									: `${Object.keys(liveProofDigest.state).length} state paths · ${liveProofDigest.recentEvents.length} tier-1 events`}
							</dd>
						</div>
						<div>
							<dt>replay comparison</dt>
							<dd>{liveProofReplay}</dd>
						</div>
					</dl>
					<section class="midloop__ledger" aria-labelledby="midloop-ledger-title">
						<h3 id="midloop-ledger-title">Bounded evidence ledger</h3>
						<p aria-live="polite">
							{liveProofLedger.length === 0
								? "No host proposals have been admitted or rejected yet."
								: `${liveProofLedger.length} immutable records retained (newest twenty-four).`}
						</p>
						<ol>
							{#each liveProofLedger as record, index (`${record.group}:${record.sequence}:${index}`)}
								<li data-status={record.status}>
									<strong>{record.status}</strong>
									<span>objective {record.objective ?? "—"}</span>
									<span>id {record.proposal?.id ?? "—"}</span>
									<span>choice {record.proposal?.choice ?? "—"}</span>
									<span>epoch {record.envelopeEpoch}</span>
									<span>reason {record.reason ?? record.result ?? "—"}</span>
								</li>
							{/each}
						</ol>
					</section>
				</div>
			{:else if activeExhibit === "cms"}
				<div class="link-stack">
					<a href="/preview/capability-page.demo/rev-001">Preview route</a>
					<a href="/p/demo">Published route</a>
				</div>
			{:else if activeExhibit === "kernels"}
				<label class="field" for="dialect-select">
					<span>Global dialect</span>
					<select id="dialect-select" value={activeDialect.id} onchange={setDialect}>
						{#each DIALECT_OPTIONS as dialectId (dialectId)}
							<option value={dialectId}>{dialectId}</option>
						{/each}
					</select>
				</label>
				<label class="field" for="kernel-proof-case">
					<span>Sealed source-v1 case</span>
					<select id="kernel-proof-case" value={kernelProofCaseId} onchange={setKernelProofCase}>
						{#each KERNEL_PROOF_CASES as fixture (fixture.id)}
							<option value={fixture.id}>{fixture.label}</option>
						{/each}
					</select>
				</label>
				<p class="control-copy">
					Each fixed tree is replayed from a real Krepis route fixture. Morphe owns rendering and
					validation; the kernel retains its domain semantics and signing authority.
				</p>
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
			<MorpheRoot
				tree={renderedTree}
				dialect={activeExhibit === "vary" ? liveProofDialect : undefined}
				{registry}
				{store}
				{actions}
				{choices}
				{onEscalate}
			/>
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
				<div>
					<dt>tier-2 boundary</dt>
					<dd>
						{tier2Receipts.length === 0
							? "wired at MorpheRoot · no in-tree tier-2 producer is fabricated"
							: `${tier2Receipts.length} genuine escalation receipt(s) captured`}
					</dd>
				</div>
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
	.workbench__intro {
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
	.workbench :is(button, select, input, textarea, a):focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
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
	.midloop {
		display: grid;
		min-inline-size: 0;
		gap: var(--mo-space-3);
	}
	.midloop__actions {
		display: grid;
		gap: var(--mo-space-2);
	}
	.midloop__actions button {
		box-sizing: border-box;
		inline-size: 100%;
		min-inline-size: 0;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font: inherit;
		font-weight: 750;
		text-align: start;
		cursor: pointer;
		overflow-wrap: anywhere;
	}
	.midloop__actions button:first-child {
		border-color: var(--mo-intent-primary-action-surface);
		background: var(--mo-intent-primary-action-surface);
		color: var(--mo-intent-primary-action-on);
	}
	.midloop__state {
		display: grid;
		gap: var(--mo-space-2);
		margin: 0;
	}
	.midloop__state div {
		display: grid;
		gap: var(--mo-space-1);
		min-inline-size: 0;
		padding-block-end: var(--mo-space-2);
		border-block-end: 1px solid var(--mo-intent-outline);
	}
	.midloop__state dt {
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-accession-on);
	}
	.midloop__state dd {
		margin: 0;
		color: var(--mo-intent-on-surface-muted);
		font-size: var(--mo-type-2);
		overflow-wrap: anywhere;
	}
	.midloop__ledger {
		min-inline-size: 0;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3);
		background: var(--mo-intent-surface-sunken);
	}
	.midloop__ledger h3,
	.midloop__ledger p {
		margin: 0;
	}
	.midloop__ledger h3 {
		font-size: var(--mo-type-3);
	}
	.midloop__ledger p {
		margin-block-start: var(--mo-space-1);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.midloop__ledger ol {
		display: grid;
		max-block-size: 24rem;
		gap: var(--mo-space-2);
		margin: var(--mo-space-3) 0 0;
		padding: 0;
		overflow: auto;
		list-style: none;
	}
	.midloop__ledger li {
		display: grid;
		min-inline-size: 0;
		gap: var(--mo-space-1);
		border-inline-start: 3px solid var(--mo-intent-provenance-surface);
		padding: var(--mo-space-2);
		background: var(--mo-intent-surface-raised);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-1);
		overflow-wrap: anywhere;
	}
	.midloop__ledger li[data-status="rejected"] {
		border-inline-start-color: var(--mo-intent-caution-surface);
	}
	.midloop__ledger li[data-status="accepted"] {
		border-inline-start-color: var(--mo-intent-success-surface);
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

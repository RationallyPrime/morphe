<script lang="ts">
	import type { Node } from "$lib";
	import { activeDialect, getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import DignityDemo from "../_demo/DignityDemo.svelte";

	const intro: Node = {
		kind: "frame",
		role: "page",
		surface: "base",
		budget: 3,
		children: [
			{
				kind: "grid",
				role: "section",
				minTrack: "regular",
				children: [
					{
						kind: "stack",
						role: "section",
						children: [
							{ kind: "badge", label: "morphe playground", intent: "provenance", icon: "science" },
							{
								kind: "text",
								value: "The substrate under live pressure",
								as: "display",
								emphasis: "strong",
							},
							{
								kind: "text",
								value:
									"A neutral playground for the design system and CMS substrate: shipped dialects, typed Node trees, actions, bindings, variation choices, compiled previews, and adaptive fallback rendering.",
								as: "body",
								emphasis: "muted",
							},
							{
								kind: "cluster",
								role: "inline",
								children: [
									{ kind: "link", href: "/preview/capability-page.demo/rev-001", label: "Preview route" },
									{ kind: "link", href: "/p/demo", label: "Published route" },
								],
							},
						],
					},
					{
						kind: "media",
						src: "/images/demo/content-gate.svg",
						alt: "A neutral content gate diagram with a validated tree flowing into themed render surfaces.",
						aspect: "square",
						width: 960,
						height: 960,
						eager: true,
					},
				],
			},
		],
	};

	const pinnedIntro: Node = {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "Pinned dialect boundary", as: "heading" },
			{
				kind: "text",
				value:
					"The shell follows the global dialect. This nested root stays on the night dialect, proving subtree boundaries can carry their own intent map without mutating the authored tree.",
				as: "body",
				emphasis: "muted",
			},
		],
	};

	const pinnedAsset: Node = {
		kind: "frame",
		role: "panel",
		surface: "sunken",
		children: [
			{
				kind: "media",
				src: "/images/demo/interface-lab.svg",
				alt: "A neutral interface lab asset pinned inside a nested night dialect root.",
				aspect: "video",
				width: 1280,
				height: 720,
			},
			{
				kind: "text",
				value: "Subtree dialect: night",
				as: "caption",
				intent: "folio",
			},
		],
	};

	type AdaptiveStatus = "idle" | "loading" | "ready" | "error";

	interface AdaptiveDecisionResponse {
		readonly source: "live" | "fallback";
		readonly model?: string;
		readonly tree: Node;
		readonly diagnostics: readonly string[];
	}

	const initialAdaptiveTree: Node = {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{ kind: "badge", label: "fallback-ready", intent: "provenance" },
					{
						kind: "text",
						value: "Adaptive render surface",
						as: "heading",
						emphasis: "strong",
					},
					{
						kind: "text",
						value:
							"Submit a task state. Morphe renders either the live sidecar's schema-valid Node or the deterministic fallback.",
						as: "body",
						emphasis: "muted",
					},
					{
						kind: "status",
						tone: "info",
						signal: { text: "No sidecar required for the first render" },
					},
				],
			},
		],
	};

	let taskGoal = $state("Review an exception queue");
	let eventName = $state("morphe.playground.requested");
	let digestSummary = $state("Operator wants a compact, evidence-led panel.");
	let adaptiveTree = $state<Node>(initialAdaptiveTree);
	let adaptiveStatus = $state<AdaptiveStatus>("idle");
	let adaptiveSource = $state<"live" | "fallback">("fallback");
	let adaptiveModel = $state<string | undefined>(undefined);
	let adaptiveDiagnostics = $state<readonly string[]>(["not-requested"]);

	function adaptiveRequest(): Record<string, unknown> {
		return {
			task_state: {
				goal: taskGoal,
				lead: {
					company: "Demo Systems",
					vertical: "operations",
					size_signal: "multi-team workflow",
				},
			},
			event: {
				tier: "mid",
				name: eventName,
				payload: { intent: "playground", requested_at: "client" },
			},
			digest: {
				summary: digestSummary,
				signals: { risk: "medium", evidence: "operator-supplied" },
				events: [{ tier: "fast", name: "dialect.current", payload: { id: activeDialect.current.id } }],
			},
			dialect_id: activeDialect.current.id,
			surface_id: "morphe-playground",
		};
	}

	async function runAdaptive(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		adaptiveStatus = "loading";
		try {
			const response = await fetch("/api/adaptive/decision", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(adaptiveRequest()),
			});
			if (!response.ok) throw new Error(`decision-${response.status}`);
			const payload = (await response.json()) as AdaptiveDecisionResponse;
			adaptiveTree = payload.tree;
			adaptiveSource = payload.source;
			adaptiveModel = payload.model;
			adaptiveDiagnostics = payload.diagnostics;
			adaptiveStatus = "ready";
		} catch {
			adaptiveTree = initialAdaptiveTree;
			adaptiveSource = "fallback";
			adaptiveModel = undefined;
			adaptiveDiagnostics = ["browser-request-failed"];
			adaptiveStatus = "error";
		}
	}
</script>

<svelte:head>
	<title>Morphe Playground</title>
	<meta
		name="description"
		content="A neutral Morphe playground for typed Node rendering, dialect switching, CMS preview routes, and adaptive fallback rendering."
	/>
</svelte:head>

<section class="section">
	<div class="wrap">
		<MorpheRoot tree={intro} />
	</div>
</section>

<div class="wide">
	<DignityDemo />
</div>

<section class="section adaptive-lab" id="adaptive-lab">
	<div class="wrap adaptive-lab__grid">
		<form class="adaptive-lab__controls" onsubmit={runAdaptive}>
			<div>
				<p class="adaptive-lab__eyebrow">Adaptive loop</p>
				<h2 class="adaptive-lab__title">Agent-rendered Node</h2>
			</div>
			<label class="adaptive-field" for="adaptive-goal">
				<span>Task state</span>
				<textarea id="adaptive-goal" rows="3" bind:value={taskGoal}></textarea>
			</label>
			<label class="adaptive-field" for="adaptive-event">
				<span>Event</span>
				<input id="adaptive-event" type="text" bind:value={eventName} />
			</label>
			<label class="adaptive-field" for="adaptive-digest">
				<span>Context digest</span>
				<textarea id="adaptive-digest" rows="4" bind:value={digestSummary}></textarea>
			</label>
			<button class="adaptive-submit" type="submit" disabled={adaptiveStatus === "loading"}>
				{adaptiveStatus === "loading" ? "Rendering..." : "Render"}
			</button>
		</form>

		<div class="adaptive-lab__result" aria-live="polite">
			<MorpheRoot tree={adaptiveTree} />
			<p class="adaptive-lab__meta">
				<span>{adaptiveSource}</span>
				{#if adaptiveModel}<span>{adaptiveModel}</span>{/if}
				{#each adaptiveDiagnostics as item (item)}<span>{item}</span>{/each}
			</p>
		</div>
	</div>
</section>

<section class="section">
	<div class="wrap">
		<MorpheRoot tree={pinnedIntro} />
		<div class="pinned">
			<MorpheRoot tree={pinnedAsset} dialect={getDialect("night")} />
		</div>
	</div>
</section>

<style>
	.section {
		padding: clamp(var(--mo-space-6), 7vw, var(--mo-space-9))
			clamp(var(--mo-space-4), 5vw, var(--mo-space-8));
	}
	.wrap {
		max-inline-size: 78rem;
		margin-inline: auto;
	}
	.wide {
		padding-inline: clamp(var(--mo-space-4), 4vw, var(--mo-space-7));
	}
	.section :global(.mo-root) {
		background: transparent;
	}
	.pinned {
		max-inline-size: 48rem;
		margin-block-start: var(--mo-space-7);
		margin-inline: auto;
		border-radius: var(--mo-radius-3);
		overflow: clip;
		outline: 1px solid var(--mo-intent-outline);
		outline-offset: -1px;
	}
	.adaptive-lab {
		background: var(--mo-intent-surface-sunken);
	}
	.adaptive-lab :global(.mo-root) {
		background: transparent;
	}
	.adaptive-lab__grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: clamp(var(--mo-space-6), 5vw, var(--mo-space-8));
		align-items: start;
	}
	.adaptive-lab__controls {
		display: grid;
		gap: var(--mo-space-4);
		padding: var(--mo-space-5);
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-3);
		background: var(--mo-intent-surface-raised);
		box-shadow: var(--mo-shadow-1);
	}
	.adaptive-lab__eyebrow {
		margin: 0 0 var(--mo-space-1);
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		letter-spacing: 0.02em;
		color: var(--mo-intent-accession-on);
	}
	.adaptive-lab__title {
		margin: 0;
		font-family: var(--mo-font-display);
		font-size: var(--mo-type-6);
		line-height: var(--mo-leading-tight);
		color: var(--mo-intent-on-surface);
	}
	.adaptive-field {
		display: grid;
		gap: var(--mo-space-2);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 650;
		color: var(--mo-intent-on-surface);
	}
	.adaptive-field input,
	.adaptive-field textarea {
		inline-size: 100%;
		box-sizing: border-box;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font: inherit;
		font-weight: 450;
		line-height: var(--mo-leading-normal);
	}
	.adaptive-field textarea {
		resize: vertical;
	}
	.adaptive-field input:focus-visible,
	.adaptive-field textarea:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}
	.adaptive-submit {
		justify-self: start;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-2);
		padding: var(--mo-space-3) var(--mo-space-5);
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
		font-size: var(--mo-type-3);
		font-weight: 700;
		cursor: pointer;
	}
	.adaptive-submit:hover {
		border-color: var(--mo-intent-accession-on);
	}
	.adaptive-submit:disabled {
		cursor: wait;
		opacity: 0.64;
	}
	.adaptive-lab__result {
		min-inline-size: 0;
	}
	.adaptive-lab__meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--mo-space-2);
		margin: var(--mo-space-4) 0 0;
		font-family: var(--mo-font-mono);
		font-size: var(--mo-type-2);
		color: var(--mo-intent-on-surface-muted);
	}
	.adaptive-lab__meta span {
		padding: 0.15rem 0.45rem;
		border: 1px solid var(--mo-intent-outline);
		border-radius: var(--mo-radius-1);
	}
	@media (min-width: 58rem) {
		.adaptive-lab__grid {
			grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1fr);
		}
	}
</style>

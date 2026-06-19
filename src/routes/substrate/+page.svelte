<script lang="ts">
	import type { Node } from "$lib";
	import { activeDialect, getDialect } from "$lib";
	/*
	 * /substrate — the engine, demoted from /. The whole marketing site is rendered
	 * through Morphe; this page exposes the substrate itself: one hand-authored Node
	 * tree, re-themed live by the dialect toggle, with no agent in the loop (the
	 * Corollary-1 dignity test). A short native intro frames why it is here, then the
	 * demo carries the proof.
	 */
	import { MorpheRoot } from "$lib/components";
	import { registerSiteCompounds } from "$site";
	import CtaLink from "$site/CtaLink.svelte";
	import DignityDemo from "../_demo/DignityDemo.svelte";

	// Registers SiteHero (and the rest) through the factory gate, so the intro tree's
	// `name: "SiteHero"` resolves.
	registerSiteCompounds();

	const intro: Node = {
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			eyebrow: { kind: "text", value: "Built on Morphe", as: "caption", intent: "accession" },
			title: { kind: "text", value: "The whole site is data.", as: "display", emphasis: "strong" },
			lede: {
				kind: "text",
				value:
					"Every surface you have seen is a typed Node tree rendered through one grammar, one context algebra and one token system. Flip the dialect below and watch the same tree re-theme without a single node changing. That fixed point is the substrate Sókrates renders through.",
				as: "body",
				emphasis: "muted",
			},
		},
	};

	/*
	 * THE VITRINE (ADR-0005 rough-in, KRA-349). The plates are self-luminous
	 * artwork: under the gallery dialect they sit in dark wells and glow against
	 * the calm paper ground. The well is not a special CSS treatment — it is the
	 * `night` dialect pinned at a subtree boundary, the exact mechanism the rest
	 * of this page demonstrates with a toggle. Whatever ground the toggle picks,
	 * the plate keeps its own darkness.
	 */
	const vitrineIntro: Node = {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "The vitrine", as: "heading", emphasis: "strong" },
			{
				kind: "text",
				value:
					"The narrative plates keep their own ground under every dialect: the dark well around this one is the night dialect pinned at a subtree boundary — a second fixed-point proof, this time in the other direction.",
				as: "body",
				emphasis: "muted",
			},
		],
	};

	const plateSlug = "b7-philosopher-king-reasons";
	const plateSrcset = (format: "avif" | "webp"): string =>
		[640, 960, 1440].map((w) => `/images/plates/${plateSlug}-${w}.${format} ${w}w`).join(", ");

	const vitrinePlate: Node = {
		kind: "frame",
		role: "panel",
		surface: "sunken",
		children: [
			{
				kind: "media",
				src: `/images/plates/${plateSlug}-960.png`,
				alt: "Timaeus plate B7 — the Philosopher-King reasons: a luminous cobalt wireframe figure weighing a governed decision on a blue-black ground.",
				aspect: "portrait",
				width: 960,
				height: 1280,
				sizes: "(min-width: 48rem) 26rem, 86vw",
				sources: [
					{ type: "image/avif", srcset: plateSrcset("avif") },
					{ type: "image/webp", srcset: plateSrcset("webp") },
				],
			},
			{
				kind: "text",
				value: "Plate B7 · The Philosopher-King reasons",
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
						value: "Adaptive lab surface",
						as: "heading",
						emphasis: "strong",
					},
					{
						kind: "text",
						value:
							"Submit a task state and Morphe will either render the live model's schema-valid Node or the deterministic fallback.",
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

	let taskGoal = $state("Inspect ERP exception workflow");
	let eventName = $state("substrate.lab.requested");
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
					company: "Northwind Controls",
					vertical: "industrial quality",
					size_signal: "multi-site operations",
				},
			},
			event: {
				tier: "mid",
				name: eventName,
				payload: { intent: "proof", requested_at: "client" },
			},
			digest: {
				summary: digestSummary,
				signals: { risk: "medium", evidence: "operator-supplied" },
				events: [{ tier: "fast", name: "dialect.current", payload: { id: activeDialect.current.id } }],
			},
			dialect_id: activeDialect.current.id,
			surface_id: "substrate-lab",
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
	<title>The substrate — Sókrates · Morphe</title>
	<meta
		name="description"
		content="The Morphe substrate the Sókrates site is rendered through: one hand-authored Node tree, re-themed live by a dialect toggle, no agent in the loop."
	/>
</svelte:head>

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={intro} />
		<div class="s-cta-row">
			<CtaLink href="/" label="Back to the composer" variant="secondary" />
		</div>
	</div>
</section>

<div class="s-wrap--wide substrate-demo">
	<DignityDemo />
</div>

<section class="s-section adaptive-lab" id="adaptive-lab">
	<div class="s-wrap adaptive-lab__grid">
		<form class="adaptive-lab__controls" onsubmit={runAdaptive}>
			<div>
				<p class="adaptive-lab__eyebrow">Live adaptive loop</p>
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

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={vitrineIntro} />
		<div class="vitrine">
			<MorpheRoot tree={vitrinePlate} dialect={getDialect("night")} />
		</div>
	</div>
</section>

<style>
	/* The demo owns its own inner padding; just cap and center it like a work surface. */
	.substrate-demo {
		padding-inline: clamp(1rem, 4vw, 2.5rem);
	}

	/*
	 * The vitrine chrome: cap and center the night-pinned subtree like a hung
	 * work. The dark well itself is painted by the pinned dialect's surface
	 * stack (never by this wrapper); the margin is the only thing owned here.
	 */
	.vitrine {
		max-inline-size: 30rem;
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

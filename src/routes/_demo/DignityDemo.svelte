<script lang="ts">
	/*
	 * The DIGNITY TEST (Corollary 1).
	 *
	 * One hand-authored Node tree (no agent), rendered through the Morphe core, and
	 * a dialect toggle that re-themes the WHOLE page WITHOUT changing the tree —
	 * the on-screen proof of the Lemma-3 fixed point.
	 *
	 * This component touches the library through MorpheRoot + the public barrel
	 * only. The authored data (tree, compound, second dialect) lives in ./tree.ts.
	 * The three brand fonts (Newsreader / Hanken Grotesk / IBM Plex Mono) and the
	 * Material Symbols icon font are wired into the `--font-*` host vars the core
	 * already references — the only CDN dependency, exactly as the Archive spec
	 * allows. It is mounted by both `/` and `/dignity`.
	 */

	import MorpheRoot from "$morphe/render/MorpheRoot.svelte";
	import { activeDialect, DIALECTS, DIALECT_IDS } from "$morphe";
	import type { Dialect } from "$morphe";
	import { dignityTree, registerDemoCompounds } from "./tree.js";

	// Register the CatalogueEntry compound through the factory gate. Idempotent —
	// safe under HMR. Done at module-eval so the registry is ready before render.
	registerDemoCompounds();

	// The dialect list is the GLOBAL registry — all shipped dialects, in order — not
	// a list owned by this demo. The toggle DRIVES the global active-dialect store;
	// reading `activeDialect.id` reflects it back. Because MorpheRoot below omits the
	// `dialect` prop, flipping the toggle re-themes the whole app, not just the demo.
	const dialects: readonly Dialect[] = DIALECT_IDS.map((id) => DIALECTS[id] as Dialect);
</script>

<svelte:head>
	<title>Morphe — The Dignity Test</title>
	<meta
		name="description"
		content="A hand-authored Node tree rendered through Morphe, re-themed live by a dialect toggle — the Corollary 1 dignity test."
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
	  The toggle is OUTSIDE the rendered tree — it is the τ_frame control surface,
	  not part of the authored content. Flipping it swaps the dialect handed to
	  MorpheRoot; the `tree` prop is byte-for-byte identical across both states.
	-->
	<header class="control">
		<div class="control__brand">
			<span class="control__glyph material-symbols-outlined" aria-hidden="true">brightness_alert</span>
			<div class="control__id">
				<p class="control__title">Morphe · Dignity Test</p>
				<p class="control__sub">Corollary&nbsp;1 — one tree, two dialects, no agent.</p>
			</div>
		</div>

		<div
			class="toggle"
			role="radiogroup"
			aria-label="Active dialect"
		>
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
		the authored tree below is unchanged — only the intent layer was remapped.
	</p>

	<main class="surface">
		{#key activeDialect.id}
			<MorpheRoot tree={dignityTree} />
		{/key}
	</main>
</div>

<style>
	/*
	 * Page chrome only. The rendered content gets ALL its styling from the core's
	 * tokens via MorpheRoot; this shell deliberately reads from the same `--mo-*`
	 * vars so the frame around the demo stays consistent with whichever dialect is
	 * active (the swatches and the surface tone shift with the toggle too).
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
	/*
	 * The swatch previews each dialect's accent without ever naming a hex: it
	 * resolves the same intent var the dialect remaps, so the dot literally is the
	 * dialect's accent. (Inactive dialect's swatch reads its declared accent via a
	 * scale var so both dots differ before you toggle.)
	 */
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

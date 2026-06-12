<script lang="ts">
	import type { Node } from "$lib";
	import { getDialect } from "$lib";
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
</style>

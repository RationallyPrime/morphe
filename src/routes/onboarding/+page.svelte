<script lang="ts">
	import type { Node } from "$lib";
	/*
	 * /onboarding — the guided intake flow, behind the stateless magic-link gate
	 * (ADR-0001; +page.server.ts decides open/granted/locked per request). A
	 * Morphe intro tree frames it; the flow and the gate screen are native
	 * control surfaces ($site/Onboarding, $site/OnboardingGate).
	 * Reachable from the marketing CTAs and the nav.
	 */
	import { MorpheRoot } from "$lib/components";
	import { registerSiteCompounds } from "$site";
	import Onboarding from "$site/Onboarding.svelte";
	import OnboardingGate from "$site/OnboardingGate.svelte";
	import type { PageProps } from "./$types";

	const { data }: PageProps = $props();

	registerSiteCompounds();

	const gateLede =
		"Onboarding starts with your work email: we send a link, the link opens the intake, and the conversation stays anchored to a real inbox.";

	// $derived: data updates in place when navigating locked → token-granted.
	const intro: Node = $derived({
		kind: "compound",
		name: "SiteHero",
		emphasis: "strong",
		args: {
			eyebrow: { kind: "text", value: "Onboarding", as: "caption", intent: "accession" },
			title: { kind: "text", value: "Tell us what runs your operation.", as: "display", emphasis: "strong" },
			lede: {
				kind: "text",
				value:
					data.gate === "locked"
						? gateLede
						: "A few minutes now sharpens the first conversation. The more you tell us about your systems and where the cross-system work hurts, the more concrete Sókrates can be. Your draft saves as you go, so you can stop and come back.",
				as: "body",
				emphasis: "muted",
			},
		},
	});
</script>

<svelte:head>
	<title>Onboarding — Sókrates</title>
	<meta
		name="description"
		content="Tell us what runs your operation: your systems, the workflows that hurt, and what good would look like. A guided intake that saves as you go."
	/>
</svelte:head>

<section class="s-section">
	<div class="s-wrap">
		<MorpheRoot tree={intro} />
	</div>
</section>

<section class="s-section recessed">
	<div class="s-wrap--wide">
		{#if data.gate === "locked"}
			<OnboardingGate tokenError={data.tokenError} />
		{:else}
			<Onboarding token={data.token} prefillEmail={data.email} />
		{/if}
	</div>
</section>

<style>
	.recessed {
		background: var(--mo-intent-surface-sunken);
	}
	.recessed :global(.mo-root) {
		background: transparent;
	}
</style>

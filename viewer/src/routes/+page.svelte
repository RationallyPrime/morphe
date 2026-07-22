<script lang="ts">
	import { applyDialect, DIALECT_LIST, dialectStyle, getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { homeCrumbs } from "../crumbs.js";
	import ViewerChrome from "../ViewerChrome.svelte";

	let { data } = $props();

	const dialect = $derived(getDialect(data.dialectId));
	const applied = $derived(applyDialect(dialect));
	let explainGlosses = $state(false);

	// Home is the navigation root: a single inert current-location rung.
	const crumbs = homeCrumbs();
</script>

<svelte:head>
	<title>{data.title} — Morphe viewer</title>
</svelte:head>

<div class="viewer-shell" style={dialectStyle(applied)}>
	<ViewerChrome
		dialects={DIALECT_LIST}
		current={data.dialectId}
		{crumbs}
		showAsOf
		asOf={data.asOf}
		bind:explainGlosses
	/>
	<main class="viewer-home" aria-label="Operational overview">
		<MorpheRoot tree={data.tree} {dialect} {explainGlosses} />
	</main>
</div>

<style>
	.viewer-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--mo-intent-surface-base);
	}

	.viewer-home {
		flex: 1;
	}
</style>

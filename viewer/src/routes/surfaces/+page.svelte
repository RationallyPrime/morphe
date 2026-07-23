<script lang="ts">
	import { applyDialect, DIALECT_LIST, dialectStyle, getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { catalogCrumbs } from "../../crumbs.js";
	import DocumentGround from "../../DocumentGround.svelte";
	import ViewerChrome from "../../ViewerChrome.svelte";

	let { data } = $props();

	const dialect = $derived(getDialect(data.dialectId));
	const applied = $derived(applyDialect(dialect));
	let explainGlosses = $state(false);

	// Home (root) › Surfaces catalog (current), reachable from and linking back to home.
	const crumbs = catalogCrumbs();
</script>

<svelte:head>
	<title>{data.title} — Morphe viewer</title>
</svelte:head>

<DocumentGround {applied} />
<div class="viewer-shell" style={dialectStyle(applied)}>
	<ViewerChrome
		dialects={DIALECT_LIST}
		current={data.dialectId}
		{crumbs}
		bind:explainGlosses
	/>
	<main class="viewer-index">
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

	.viewer-index {
		flex: 1;
	}
</style>

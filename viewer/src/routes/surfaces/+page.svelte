<script lang="ts">
	import { applyDialect, DIALECT_IDS, dialectStyle, getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import { catalogCrumbs } from "../../crumbs.js";
	import ViewerChrome from "../../ViewerChrome.svelte";

	let { data } = $props();

	const dialect = $derived(getDialect(data.dialectId));
	const applied = $derived(applyDialect(dialect));

	// Home (root) › Surfaces catalog (current), reachable from and linking back to home.
	const crumbs = catalogCrumbs();
</script>

<svelte:head>
	<title>{data.title} — Morphe viewer</title>
</svelte:head>

<div class="viewer-shell" style={dialectStyle(applied)}>
	<ViewerChrome dialects={DIALECT_IDS} current={data.dialectId} {crumbs} />
	<main class="viewer-index">
		<MorpheRoot tree={data.tree} {dialect} />
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

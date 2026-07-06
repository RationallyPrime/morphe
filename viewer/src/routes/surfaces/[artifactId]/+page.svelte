<script lang="ts">
	import { getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";

	let { data } = $props();

	const dialect = $derived(getDialect(data.dialectId));
</script>

<svelte:head>
	<title>{data.artifactId} — Morphe viewer</title>
</svelte:head>

<main class="viewer-surface">
	<MorpheRoot tree={data.tree} {dialect} />
</main>

<style>
	.viewer-surface {
		min-height: 100vh;
	}
</style>

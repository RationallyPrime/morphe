<script lang="ts">
	import { applyDialect, DIALECT_IDS, dialectStyle, getDialect } from "$lib";
	import { MorpheRoot } from "$lib/components";
	import ViewerChrome from "../../../../ViewerChrome.svelte";

	let { data } = $props();

	const dialect = $derived(getDialect(data.dialectId));
	const applied = $derived(applyDialect(dialect));
</script>

<svelte:head>
	<title>{data.surfaceTitle} — {data.sourceTitle} — Morphe viewer</title>
</svelte:head>

<div class="viewer-shell" style={dialectStyle(applied)}>
	<ViewerChrome
		dialects={DIALECT_IDS}
		current={data.dialectId}
		title={`${data.sourceTitle} · ${data.surfaceTitle}`}
		back="/"
	/>
	<main
		class="viewer-surface"
		data-delivery-dialect={data.deliveryReceipt?.dialectId}
		data-compilation-tree-sha256={data.deliveryReceipt?.treeSha256}
		data-delivered-tree-sha256={data.deliveryReceipt?.deliveredTreeSha256}
		data-dialect-policy-sha256={data.deliveryReceipt?.dialectPolicySha256}
		data-source-testimony-sha256={data.deliveryReceipt?.sourceTestimonySha256}
	>
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

	.viewer-surface {
		flex: 1;
	}
</style>

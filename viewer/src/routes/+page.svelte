<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Surfaces — Morphe viewer</title>
</svelte:head>

<main class="index">
	<h1>Surfaces</h1>

	{#if data.sources.length === 0}
		<p class="empty">
			No sources are configured. Set <code>MORPHE_SOURCES</code> (or the legacy
			<code>MORPHE_ARTIFACT_BASE_URL</code>) to give this viewer something to show.
		</p>
	{/if}

	{#each data.sources as source (source.id)}
		<section>
			<h2>{source.title}</h2>
			{#if source.surfaces.length === 0}
				<p class="empty">
					{source.kind === "store"
						? "No declared surfaces — store artifacts are addressed directly by id."
						: "No declared surfaces."}
				</p>
			{:else}
				<ul>
					{#each source.surfaces as surface (surface.href)}
						<li><a href={surface.href}>{surface.title}</a></li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}

	<footer>grammar {data.grammarVersion}</footer>
</main>

<style>
	.index {
		margin: 0 auto;
		max-width: 40rem;
		padding: 2rem 1rem 4rem;
	}

	.empty {
		opacity: 0.7;
	}

	ul {
		list-style: none;
		padding: 0;
	}

	li {
		padding: 0.25rem 0;
	}

	footer {
		margin-top: 3rem;
		font-size: 0.8rem;
		opacity: 0.6;
	}
</style>

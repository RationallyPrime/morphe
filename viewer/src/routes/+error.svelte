<script lang="ts">
	import { page } from "$app/state";

	/*
	 * Diagnostic page — the fail-closed side of the viewer.
	 *
	 * Grammar mismatch names BOTH versions (artifact's and the viewer's) so the
	 * operator can see drift at a glance (MO-D5); everything else reports the
	 * upstream condition. Native elements styled with the same --mo-* tokens —
	 * no Morphe tree here, this page renders precisely when we refuse to render.
	 */

	const err = $derived(page.error);
	const isGrammarMismatch = $derived(err?.code === "grammar-mismatch");
</script>

<svelte:head>
	<title>Viewer diagnostic — Morphe</title>
</svelte:head>

<main class="diagnostic">
	{#if isGrammarMismatch}
		<h1>Unsupported grammar version</h1>
		<p>{err?.message}</p>
		<dl>
			<dt>Artifact</dt>
			<dd><code>{err?.artifactId}</code></dd>
			<dt>Artifact grammar version</dt>
			<dd><code>{err?.artifactVersion}</code></dd>
			<dt>Viewer supports</dt>
			<dd><code>{err?.supportedVersion}</code></dd>
		</dl>
		<p class="hint">
			Rendering is fail-closed: nothing is drawn from an artifact this viewer cannot interpret
			faithfully. Recompile the surface with a matching compiler, or deploy a viewer that supports
			the artifact's grammar.
		</p>
	{:else}
		<h1>{page.status}</h1>
		<p>{err?.message ?? "Something went wrong."}</p>
	{/if}
</main>

<style>
	.diagnostic {
		min-height: 100vh;
		padding: 4rem clamp(1.5rem, 6vw, 6rem);
		font-family: var(--mo-font-body, system-ui, sans-serif);
	}

	h1 {
		font-family: var(--mo-font-display, serif);
		font-size: 1.75rem;
		margin: 0 0 1rem;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.5rem 1.5rem;
		margin: 1.5rem 0;
	}

	dt {
		color: var(--mo-intent-on-surface-muted, inherit);
	}

	dd {
		margin: 0;
	}

	code {
		font-family: var(--mo-font-mono, monospace);
	}

	.hint {
		max-width: 60ch;
		color: var(--mo-intent-on-surface-muted, inherit);
	}
</style>

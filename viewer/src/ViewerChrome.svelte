<script lang="ts">
	import { goto } from "$app/navigation";

	/*
	 * Host-level viewer chrome (the native-control-surface idiom): a slim bar of
	 * NATIVE elements outside the Morphe tree, styled with the same --mo-* tokens
	 * the active dialect paints on the shell wrapper. The dialect switcher drives
	 * the `?dialect=` query — the server re-gates the tree under the override, so
	 * this control can restyle a pane but never bypass a compound policy.
	 */

	interface Props {
		dialects: readonly string[];
		current: string;
		title?: string;
		back?: string;
	}

	let { dialects, current, title, back }: Props = $props();

	function onDialectChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		const params = new URLSearchParams(window.location.search);
		params.set("dialect", event.currentTarget.value);
		void goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}
</script>

<header class="chrome">
	<nav class="chrome__context">
		{#if back !== undefined}
			<a class="chrome__back" href={back}>← Surfaces</a>
		{/if}
		{#if title !== undefined}
			<span class="chrome__title">{title}</span>
		{/if}
	</nav>
	<label class="chrome__dialect">
		<span>Dialect</span>
		<select value={current} onchange={onDialectChange}>
			{#each dialects as dialect (dialect)}
				<option value={dialect}>{dialect}</option>
			{/each}
		</select>
	</label>
</header>

<style>
	.chrome {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 1.25rem;
		background: var(--mo-intent-surface-raised);
		color: var(--mo-intent-on-surface);
		border-bottom: 1px solid var(--mo-intent-outline);
		font-size: 0.8rem;
	}

	.chrome__context {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		min-width: 0;
	}

	.chrome__back {
		color: var(--mo-intent-primary-action-surface);
		text-decoration: none;
		white-space: nowrap;
	}

	.chrome__back:hover {
		text-decoration: underline;
	}

	.chrome__title {
		color: var(--mo-intent-on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chrome__dialect {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--mo-intent-on-surface-muted);
		white-space: nowrap;
	}

	.chrome__dialect select {
		background: var(--mo-intent-surface-sunken);
		color: var(--mo-intent-on-surface);
		border: 1px solid var(--mo-intent-outline);
		border-radius: 0.25rem;
		padding: 0.2rem 0.4rem;
		font: inherit;
	}
</style>

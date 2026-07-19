<script lang="ts">
	import { goto } from "$app/navigation";

	/*
	 * Host-level viewer chrome (the native-control-surface idiom): a slim bar of
	 * NATIVE elements outside the Morphe tree, styled with the same --mo-* tokens
	 * the active dialect paints on the shell wrapper. The dialect switcher drives
	 * the `?dialect=` query — the server re-gates the tree under the override, so
	 * this control can restyle a pane but never bypass a compound policy.
	 */

	/*
	 * A crumb is one rung of the breadcrumb trail. A rung with an `href` is a
	 * native link (the collection it belongs to); the trailing rung — the pane
	 * itself — carries no href and renders as inert current-location text. The
	 * route owns the trail so this control stays a dumb renderer.
	 */
	interface Crumb {
		label: string;
		href?: string;
	}

	interface Props {
		dialects: readonly string[];
		current: string;
		crumbs?: readonly Crumb[];
		/*
		 * Temporal presentation control (KRA-767). Present only on source-v1 panes —
		 * a legacy tree carries baked timestamp text nothing here could re-floor. When
		 * `temporalPolicy` is null/undefined the control is omitted entirely.
		 */
		temporalPolicies?: readonly string[];
		temporalPolicy?: string | null;
		/*
		 * The ONE `as_of` date control (KRA-789). Present only in the home chrome
		 * (`showAsOf`): selecting a date fans `?as_of=` to every home panel's kernel
		 * fetch. Empty is today's behavior — no `as_of` forwarded. Built the same way
		 * as the KRA-767 temporal control: a native control writing a query param.
		 */
		showAsOf?: boolean;
		asOf?: string | null;
	}

	let {
		dialects,
		current,
		crumbs,
		temporalPolicies,
		temporalPolicy,
		showAsOf,
		asOf,
	}: Props = $props();

	function setParam(key: string, value: string): void {
		const params = new URLSearchParams(window.location.search);
		params.set(key, value);
		void goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	function deleteParam(key: string): void {
		const params = new URLSearchParams(window.location.search);
		params.delete(key);
		const query = params.toString();
		void goto(query === "" ? "?" : `?${query}`, { keepFocus: true, noScroll: true });
	}

	function onDialectChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		setParam("dialect", event.currentTarget.value);
	}

	function onTemporalChange(event: Event & { currentTarget: HTMLSelectElement }): void {
		setParam("temporal", event.currentTarget.value);
	}

	function onAsOfChange(event: Event & { currentTarget: HTMLInputElement }): void {
		const value = event.currentTarget.value;
		// Clearing the date restores today's behavior (no `as_of` forwarded), byte-identical.
		if (value === "") deleteParam("as_of");
		else setParam("as_of", value);
	}

	const showTemporal = $derived(
		temporalPolicy !== null &&
			temporalPolicy !== undefined &&
			temporalPolicies !== undefined &&
			temporalPolicies.length > 0,
	);
</script>

<header class="chrome">
	<nav class="chrome__context" aria-label="Breadcrumb">
		{#if crumbs !== undefined}
			{#each crumbs as crumb, index (index)}
				{#if index > 0}
					<span class="chrome__sep" aria-hidden="true">›</span>
				{/if}
				{#if crumb.href !== undefined}
					<a class="chrome__crumb" href={crumb.href}>{crumb.label}</a>
				{:else}
					<span class="chrome__title" aria-current="page">{crumb.label}</span>
				{/if}
			{/each}
		{/if}
	</nav>
	<div class="chrome__controls">
		{#if showAsOf}
			<label class="chrome__control">
				<span>As of</span>
				<input type="date" value={asOf ?? ""} onchange={onAsOfChange} />
			</label>
		{/if}
		{#if showTemporal}
			<label class="chrome__control">
				<span>Time</span>
				<select value={temporalPolicy} onchange={onTemporalChange}>
					{#each temporalPolicies ?? [] as policy (policy)}
						<option value={policy}>{policy}</option>
					{/each}
				</select>
			</label>
		{/if}
		<label class="chrome__control">
			<span>Dialect</span>
			<select value={current} onchange={onDialectChange}>
				{#each dialects as dialect (dialect)}
					<option value={dialect}>{dialect}</option>
				{/each}
			</select>
		</label>
	</div>
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

	.chrome__crumb {
		color: var(--mo-intent-primary-action-surface);
		text-decoration: none;
		white-space: nowrap;
	}

	.chrome__crumb:hover {
		text-decoration: underline;
	}

	.chrome__sep {
		color: var(--mo-intent-on-surface-muted);
	}

	.chrome__title {
		color: var(--mo-intent-on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chrome__controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.chrome__control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--mo-intent-on-surface-muted);
		white-space: nowrap;
	}

	.chrome__control select,
	.chrome__control input[type="date"] {
		background: var(--mo-intent-surface-sunken);
		color: var(--mo-intent-on-surface);
		border: 1px solid var(--mo-intent-outline);
		border-radius: 0.25rem;
		padding: 0.2rem 0.4rem;
		font: inherit;
	}
</style>

<script lang="ts">
	import { goto } from "$app/navigation";
	import type { Dialect } from "$lib";
	import { Gloss } from "$lib/components";

	/*
	 * Host-level viewer chrome (the native-control-surface idiom): a slim bar of
	 * NATIVE elements outside the Morphe tree, styled with the same --mo-* tokens
	 * the active dialect paints on the shell wrapper. Operator controls stay in the
	 * normal scan path; substrate inspection is an explicit, collapsed mode. Its
	 * dialect switcher drives the `?dialect=` query — the server re-gates the tree
	 * under the override, so this control can restyle a pane but never bypass a
	 * compound policy.
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
		dialects: readonly Dialect[];
		current: string;
		/** Two-way pane inspection state shared with the pane's MorpheRoot. */
		explainGlosses?: boolean;
		crumbs?: readonly Crumb[];
		/*
		 * Temporal presentation control (KRA-767). Present only on source-v1 panes —
		 * a legacy tree carries baked timestamp text nothing here could re-floor. When
		 * `temporalPolicy` is null/undefined the control is omitted entirely.
		 */
		temporalPolicies?: readonly string[];
		temporalPolicy?: string | null;
		/*
		 * The ONE `as_of` date control (KRA-789, extended to source panes by KRA-779).
		 * Shown wherever the host route opts in (`showAsOf`): home fans `?as_of=` to
		 * every panel's kernel fetch; a source-v1 pane forwards it on its own fetch.
		 * Empty is today's behavior — no `as_of` forwarded. Built the same way
		 * as the KRA-767 temporal control: a native control writing a query param.
		 */
		showAsOf?: boolean;
		asOf?: string | null;
	}

	let {
		dialects,
		current,
		explainGlosses = $bindable(false),
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
	const showOperatorControls = $derived(Boolean(showAsOf) || showTemporal);
	const selectedDialect = $derived(
		dialects.find((dialect) => dialect.id === current) ?? dialects[0],
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
					<span
						class="chrome__title"
						aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span
					>
				{/if}
			{/each}
		{/if}
	</nav>
	<div class="chrome__controls">
		{#if showOperatorControls}
			<fieldset class="chrome__operator">
				<legend class="chrome__legend">Operator controls</legend>
				<div class="chrome__operator-controls">
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
				</div>
			</fieldset>
		{/if}
		<details class="chrome__inspection">
			<summary>Substrate inspection</summary>
			<div class="chrome__inspection-panel">
				<label class="chrome__control chrome__explain">
					<input type="checkbox" bind:checked={explainGlosses} />
					<span>Explain this pane</span>
				</label>
				<label class="chrome__control">
					<span>Dialect</span>
					<select value={current} onchange={onDialectChange}>
						{#each dialects as dialect (dialect.id)}
							<option value={dialect.id}>{dialect.label}</option>
						{/each}
					</select>
				</label>
				{#if selectedDialect}
					<div class="chrome__dialect-gloss">
						<Gloss
							label={selectedDialect.label}
							gloss={selectedDialect.gloss}
							revealAll={explainGlosses}
						>
							{#snippet children()}{selectedDialect.label}{/snippet}
						</Gloss>
					</div>
				{/if}
			</div>
		</details>
	</div>
</header>

<style>
	.chrome {
		display: flex;
		flex-wrap: wrap;
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
		flex: 1 1 20rem;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.chrome__crumb {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 2.75rem;
		min-inline-size: 2.75rem;
		max-width: 100%;
		color: var(--mo-intent-primary-action-ink);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chrome__crumb:hover {
		color: var(--mo-intent-primary-action-ink-hover);
		text-decoration: underline;
	}

	.chrome__sep {
		color: var(--mo-intent-on-surface-muted);
	}

	.chrome__title {
		display: inline-flex;
		flex: 1 1 8rem;
		align-items: center;
		min-block-size: 2.75rem;
		min-width: 0;
		color: var(--mo-intent-on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chrome__controls {
		display: flex;
		flex: 0 1 auto;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}

	.chrome__operator {
		min-inline-size: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.chrome__legend {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.chrome__operator-controls {
		display: flex;
		flex-wrap: wrap;
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
	.chrome__control input[type="date"],
	.chrome__control input[type="checkbox"] {
		min-block-size: 2.75rem;
		max-inline-size: 100%;
		background: var(--mo-intent-surface-sunken);
		color: var(--mo-intent-on-surface);
		border: 1px solid var(--mo-intent-outline);
		border-radius: 0.25rem;
		padding: 0.5rem 0.625rem;
		font: inherit;
	}

	.chrome__control input[type="checkbox"] {
		inline-size: 2.75rem;
		block-size: 2.75rem;
		margin: 0;
		accent-color: var(--mo-intent-primary-action-surface);
	}

	.chrome__inspection {
		min-width: 0;
	}

	.chrome__inspection summary {
		min-block-size: 2.75rem;
		box-sizing: border-box;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--mo-intent-outline);
		border-radius: 0.25rem;
		color: var(--mo-intent-on-surface);
		cursor: pointer;
		white-space: nowrap;
	}

	.chrome__inspection summary:hover {
		background: var(--mo-intent-surface-sunken);
	}

	.chrome__inspection[open] {
		flex-basis: 100%;
	}

	.chrome__inspection-panel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem 1rem;
		margin-block-start: 0.5rem;
		padding: 0.75rem;
		border: 1px solid var(--mo-intent-outline);
		border-radius: 0.25rem;
		background: var(--mo-intent-surface-sunken);
	}

	.chrome__dialect-gloss {
		flex: 1 1 100%;
		text-align: end;
		color: var(--mo-intent-on-surface-muted);
	}

	.chrome__crumb:focus-visible,
	.chrome__inspection summary:focus-visible,
	.chrome__control select:focus-visible,
	.chrome__control input[type="date"]:focus-visible,
	.chrome__control input[type="checkbox"]:focus-visible {
		outline: 2px solid var(--mo-intent-primary-action-ring);
		outline-offset: 2px;
	}

	@media (max-width: 390px) {
		.chrome {
			align-items: stretch;
			gap: 0.25rem;
			padding-inline: 0.75rem;
		}

		.chrome__context,
		.chrome__controls,
		.chrome__operator,
		.chrome__inspection {
			flex-basis: 100%;
			width: 100%;
		}

		.chrome__context {
			column-gap: 0.5rem;
			row-gap: 0;
		}

		.chrome__controls,
		.chrome__operator-controls {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 0.5rem;
		}

		.chrome__control {
			justify-content: space-between;
			min-width: 0;
		}

		.chrome__control select,
		.chrome__control input[type="date"],
		.chrome__control input[type="checkbox"] {
			min-width: 0;
		}

		.chrome__inspection-panel {
			justify-content: stretch;
		}

		.chrome__explain,
		.chrome__dialect-gloss {
			text-align: start;
		}
	}
</style>

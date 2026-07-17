<script lang="ts">

	/*
	 * Grid — an auto-fitting track grid (Layout role).
	 *
	 * The author emits INTENT, not pixels: `minTrack ∈ narrow|regular|wide`. The
	 * primitive compiles that intent into a track floor and lets the browser pack
	 * as many equal columns as fit (`auto-fit` + `minmax(floor, 1fr)`), collapsing
	 * to a single column when the container is narrower than one track. Because the
	 * floor is the only geometry and it is expressed in `rem`, the grid is fluid
	 * and density-aware (gap rides the boundary var) with no media queries and no
	 * JS — the responsiveness is a property of the container, via the track floor
	 * and the nearest container-type ancestor.
	 *
	 * Context descent + boundary vars + recursion are preserved exactly. Gap is the
	 * density→space boundary var; the track floor is the only primitive-owned
	 * length, and it is a named intent step, never a raw scale an author touches.
	 *
	 * Agent edits ONLY this file.
	 */

	import { emphasisToStrokeStep, transform } from "../../context/algebra.js";
	import {
		boundaryStyle,
		provideReactiveMorpheContext,
	} from "../../context/Context.svelte.js";
	import type { Grid } from "../../grammar/types.js";
	import { useChoices } from "../../render/choices.svelte.js";
	import { resolveChildEmphasisGrants } from "../../render/emphasis.js";
	import Node from "../../render/Node.svelte";
	import type { PrimitiveProps } from "../../render/props.js";

	let { node, ctx }: PrimitiveProps<Grid> = $props();

	const providedChoices = useChoices();
	const choices = $derived(providedChoices?.current);
	const child = $derived(transform(ctx, node.role, { childCount: node.children.length }));
	provideReactiveMorpheContext(() => child);

	// Budget-Conservation, WIRED: renormalize the children's claims against B and
	// grant each its rendered emphasis below (see Stack for the full rationale).
	const grants = $derived(resolveChildEmphasisGrants(child.emphasisBudget, node.children, choices));

	const minTrack = $derived(node.minTrack ?? "regular");
	// Rendered at the emphasis the parent granted this Grid, never a self-claim.
	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");
	const childStyle = $derived(boundaryStyle(child));

	// Tabular mode: an explicit `columns` template turns this Grid into a ledger
	// list. Each column intent compiles to one track ("flexible" absorbs slack,
	// "content" sizes to its widest cell); the direct-child rows adopt these
	// tracks via subgrid (see the style block) so columns align across every row.
	// Absent ⇒ `--mo-grid-template` stays unset and the auto-fit card template wins.
	const columnTemplate = $derived(
		node.columns && node.columns.length > 0
			? node.columns.map((c) => (c === "flexible" ? "minmax(0, 1fr)" : "max-content")).join(" ")
			: undefined,
	);
</script>

<div
	class="mo-grid"
	data-min-track={minTrack}
	data-role={node.role}
	data-emphasis={emphasis}
	data-columns={columnTemplate ? "" : undefined}
	data-ruled={node.ruled && columnTemplate ? "" : undefined}
	style={childStyle}
	style:--mo-ctx-stroke={emphasisToStrokeStep(emphasis)}
	style:--mo-grid-template={columnTemplate}
>
	{#each node.children as c, i (i)}
		<Node node={c} ctx={{ ...child, renderedEmphasis: grants[i] }} />
	{/each}
</div>

<style>
	.mo-grid {
		display: grid;
		gap: var(--mo-ctx-space, var(--mo-space-5));
		/*
		 * auto-fit packs as many equal 1fr columns as fit at or above the floor,
		 * and collapses to one column below it — fluid by construction. min() with
		 * 100% keeps a single oversized track from overflowing a narrow container
		 * (the classic auto-fit overflow bug). --mo-track is the compiled intent.
		 */
		grid-template-columns: repeat(auto-fit, minmax(min(var(--mo-track, 16rem), 100%), 1fr));
		/* Items stretch to fill their track height so cards in a row align. */
		align-items: stretch;
	}

	/*
	 * Tabular mode — an explicit `columns` template. The Grid lays its rows on one
	 * shared set of tracks (`--mo-grid-template`); each direct-child row Grid spans
	 * the whole set and adopts it as a SUBGRID, so every row's cells land on the
	 * same column edges. This is the ledger/table affordance with no <table> and no
	 * per-row track guessing — columns align by construction, and unlike the
	 * auto-fit default a 2-cell and a 3-cell sibling can never disagree on geometry.
	 */
	.mo-grid[data-columns] {
		grid-template-columns: var(--mo-grid-template);
		/* Rows size to content and read top-to-bottom; no card-height stretch. */
		align-items: start;
	}
	.mo-grid[data-columns] > :global(.mo-grid) {
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		/* Inherit the list's column gutters so the subgrid tracks line up exactly. */
		column-gap: inherit;
	}
	/* A row's diagnostic alert rides as a direct-child SIBLING of its row grid
	   (a wrapper would defeat the subgrid adoption above and collapse the row
	   into the first track); it spans the full table width. */
	.mo-grid[data-columns] > :global(.mo-alert) {
		grid-column: 1 / -1;
	}

	/*
	 * Ledger rules — a hairline under every row but the last, spanning all columns
	 * (the row is a full-width subgrid, so the border crosses the whole table). The
	 * stroke is the dialect's `--mo-intent-outline` at the default border width: a
	 * crisp register line in the clinical console, a ghost one on the gallery wall.
	 * A small block-end pad lifts the rule off the baseline; the list gap does the
	 * rest. Tabular-only (the selector requires data-columns).
	 */
	.mo-grid[data-ruled][data-columns] > :global(.mo-grid:not(:last-child)) {
		border-block-end: var(--mo-border-width) solid var(--mo-intent-outline);
		padding-block-end: var(--mo-space-2);
	}

	/* minTrack intent → a track floor (rem, so it scales with root font size). */
	.mo-grid[data-min-track="narrow"] {
		--mo-track: 10rem;
	}
	.mo-grid[data-min-track="regular"] {
		--mo-track: 16rem;
	}
	.mo-grid[data-min-track="wide"] {
		--mo-track: 24rem;
	}

	/*
	 * Renormalized emphasis reaches the grid as a data attribute. A layout
	 * primitive only adjusts neutral separation, never functional color — an
	 * emphasized grid breathes a little more so it reads as a distinct band.
	 */
	.mo-grid[data-emphasis="strong"],
	.mo-grid[data-emphasis="critical"] {
		gap: var(--mo-ctx-space, var(--mo-space-5));
	}
</style>

<script lang="ts">

	/*
	 * Table — the data-table capability (ADR-0020).
	 *
	 * Real browser table semantics, owned structurally: a required <caption>
	 * (`captionHidden` keeps it for AT without repeating an adjacent heading),
	 * <th scope="col"> column heads, optional <th scope="row"> row headers,
	 * numeric column alignment (right-aligned tabular figures), a DECLARED
	 * responsive policy, optional sticky headers, and a full-width row-associated
	 * diagnostics lane — so an alert explains its row without painting over it.
	 *
	 * Responsive policy is authored intent, never inference:
	 *   - "scroll" (default): honest overflow — the table keeps its geometry
	 *     inside a focus-reachable overflow-x container.
	 *   - "collapse": container queries hide priority:"detail" then "secondary"
	 *     columns as the container narrows; "primary" never disappears.
	 *   - "records": at narrow widths each row becomes a labelled record — cells
	 *     stack block-wise, each labelled by its column header (stamped as data,
	 *     structural pairing, no positional guesswork).
	 *
	 * Context (Lemma 2): the table enters the algebra as a list-shaped boundary
	 * (the same descent Grid's tabular mode uses); every cell's children render
	 * with that child context. Chrome is deliberately light: the ledger hairline
	 * (`--mo-intent-outline`), the caption/label type ramp, base surface only.
	 *
	 * Agent edits ONLY this file.
	 */

	import { emphasisToStrokeStep, transform } from "../../context/algebra.js";
	import {
		boundaryStyle,
		provideReactiveMorpheContext,
	} from "../../context/Context.svelte.js";
	import type { Table } from "../../grammar/types.js";
	import Node from "../../render/Node.svelte";
	import type { PrimitiveProps } from "../../render/props.js";

	let { node, ctx }: PrimitiveProps<Table> = $props();

	const child = $derived(transform(ctx, "list", { childCount: node.rows.length }));
	provideReactiveMorpheContext(() => child);

	// Rendered at the emphasis the parent granted this table, never a self-claim.
	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");
	const childStyle = $derived(boundaryStyle(child));

	const responsive = $derived(node.responsive ?? "scroll");
	const columnCount = $derived(node.columns.length);
</script>

<!-- In scroll mode the wrapper is a labelled, focusable region so overflowed
     geometry stays keyboard-operable (the caption names it for AT). This is the
     WAI-recommended scrollable-region pattern: tabindex="0" + role="region" +
     an accessible name — the tabindex is only ever set alongside the role. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="mo-table"
	data-responsive={responsive}
	data-sticky={node.sticky ? "" : undefined}
	data-emphasis={emphasis}
	{...responsive === "scroll" ? { role: "region" } : {}}
	aria-label={responsive === "scroll" ? node.caption : undefined}
	tabindex={responsive === "scroll" ? 0 : undefined}
	style={childStyle}
	style:--mo-ctx-stroke={emphasisToStrokeStep(emphasis)}
>
	<table class="mo-table__table">
		<caption class="mo-table__caption" data-hidden={node.captionHidden ? "" : undefined}>
			{node.caption}
		</caption>
		<thead class="mo-table__head">
			<tr>
				{#each node.columns as column, columnIndex (columnIndex)}
					<th
						scope="col"
						data-numeric={column.numeric ? "" : undefined}
						data-priority={column.priority ?? undefined}
					>
						{column.header}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each node.rows as row, rowIndex (rowIndex)}
				<tr>
					{#each row.cells as cell, cellIndex (cellIndex)}
						{@const column = node.columns[cellIndex]}
						{#if node.rowHeader && cellIndex === 0}
							<th
								scope="row"
								data-header={column?.header}
								data-priority={column?.priority ?? undefined}
							>
								{#each cell.children as cellChild, childIndex (childIndex)}
									<Node node={cellChild} ctx={child} />
								{/each}
							</th>
						{:else}
							<td
								data-header={column?.header}
								data-numeric={column?.numeric ? "" : undefined}
								data-priority={column?.priority ?? undefined}
							>
								{#each cell.children as cellChild, childIndex (childIndex)}
									<Node node={cellChild} ctx={child} />
								{/each}
							</td>
						{/if}
					{/each}
				</tr>
				{#if row.diagnostics && row.diagnostics.length > 0}
					<!-- The row-associated diagnostics lane: full width, immediately
					     after its row — never inside a cell where it would paint
					     over the values it explains. -->
					<tr class="mo-table__lane">
						<td colspan={columnCount}>
							{#each row.diagnostics as diagnostic, diagnosticIndex (diagnosticIndex)}
								<Node node={diagnostic} ctx={child} />
							{/each}
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>

<style>
	.mo-table {
		container-type: inline-size;
		inline-size: 100%;
	}
	/* "scroll": honest overflow. The container is keyboard-reachable so the
	   overflowed geometry is operable without a pointer. */
	.mo-table[data-responsive="scroll"] {
		overflow-x: auto;
	}

	.mo-table__table {
		inline-size: 100%;
		border-collapse: collapse;
		font-size: var(--mo-ctx-type, var(--mo-type-3));
	}

	/* Caption: the table's name, start-aligned at label register. `data-hidden`
	   keeps it in the accessibility tree while removing it visually (the
	   adjacent authored heading already names the region). */
	.mo-table__caption {
		text-align: start;
		font-family: var(--mo-font-label);
		font-size: var(--mo-type-2);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
		padding-block-end: var(--mo-space-3);
	}
	.mo-table__caption[data-hidden] {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	th,
	td {
		text-align: start;
		vertical-align: baseline;
		padding-block: var(--mo-space-3);
		padding-inline-end: var(--mo-ctx-space, var(--mo-space-5));
	}
	th:last-child,
	td:last-child {
		padding-inline-end: 0;
	}

	/* Column heads: label register, quiet weight — the ledger hairline below
	   them is the structural cue, not a heavy band. */
	thead th {
		font-family: var(--mo-font-label);
		font-weight: 500;
		font-size: var(--mo-type-2);
		letter-spacing: 0.01em;
		color: var(--mo-intent-on-surface-muted);
		border-block-end: var(--mo-border-width) solid var(--mo-intent-outline);
	}

	/* Row headers read at body ink and medium weight — the record's name. */
	tbody th[scope="row"] {
		font-weight: 500;
	}

	/* Ledger rules between rows; the lane row shares its row's rule. */
	tbody tr:not(:last-child):not(.mo-table__lane) > th,
	tbody tr:not(:last-child):not(.mo-table__lane) > td {
		border-block-end: var(--mo-border-width) solid var(--mo-intent-outline);
	}

	/* Numeric register: right-aligned tabular figures, heads included — the
	   horizontal half of ledger alignment (Text.numeric is the glyph half). */
	th[data-numeric],
	td[data-numeric] {
		text-align: end;
		font-variant-numeric: tabular-nums;
		font-feature-settings: "tnum" 1;
	}

	/* The diagnostics lane sits tight under its row and spans every column. */
	.mo-table__lane > td {
		padding-block: var(--mo-space-2) var(--mo-space-3);
	}

	/* Sticky heads pin inside the scroll container on the base surface —
	   pinning adds no visual mass. */
	.mo-table[data-sticky] thead th {
		position: sticky;
		inset-block-start: 0;
		background: var(--mo-intent-surface-base, var(--mo-surface-base));
	}

	/* "collapse": declared priority columns leave in order as the container
	   narrows; "primary" (and undeclared) columns never disappear. */
	@container (max-inline-size: 44rem) {
		.mo-table[data-responsive="collapse"] :is(th, td)[data-priority="detail"] {
			display: none;
		}
	}
	@container (max-inline-size: 30rem) {
		.mo-table[data-responsive="collapse"] :is(th, td)[data-priority="secondary"] {
			display: none;
		}
	}

	/* "records": below the threshold each row becomes a labelled record.
	   Cells stack block-wise; each is labelled by its column header, stamped as
	   data so the pairing is structural. The 390px overlap class is
	   unrepresentable here — nothing shares a line it cannot afford. */
	@container (max-inline-size: 40rem) {
		.mo-table[data-responsive="records"] .mo-table__table,
		.mo-table[data-responsive="records"] tbody,
		.mo-table[data-responsive="records"] tbody tr,
		.mo-table[data-responsive="records"] tbody :is(th, td) {
			display: block;
		}
		.mo-table[data-responsive="records"] thead {
			/* Visually retired; the stamped labels below carry the pairing.
			   (display:none would also drop the header semantics AT uses on wide
			   viewports; at record width the per-cell labels replace them.) */
			display: none;
		}
		.mo-table[data-responsive="records"] tbody tr {
			padding-block: var(--mo-space-4);
			border-block-end: var(--mo-border-width) solid var(--mo-intent-outline);
		}
		.mo-table[data-responsive="records"] tbody :is(th, td) {
			border-block-end: none;
			padding-block: var(--mo-space-1);
			padding-inline-end: 0;
			text-align: start;
		}
		.mo-table[data-responsive="records"] tbody :is(th, td)[data-header]::before {
			content: attr(data-header);
			display: block;
			font-family: var(--mo-font-label);
			font-size: var(--mo-type-2);
			letter-spacing: 0.01em;
			color: var(--mo-intent-on-surface-muted);
		}
		/* The row header IS the record's title: no label needed above the name. */
		.mo-table[data-responsive="records"] tbody th[scope="row"][data-header]::before {
			display: none;
		}
	}
</style>

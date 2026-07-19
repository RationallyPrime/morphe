/**
 * The composed cross-kernel home surface as an authored Morphe tree (KRA-789).
 *
 * Pure presenter — no clock, no I/O. The server admits + compiles each configured home
 * panel through the shared pane pipeline and hands the already-gated subtrees here; this
 * module GRAFTS each whole compiled tree into one authored home tree WITHOUT mutating the
 * compiled testimony. Digest density is achieved through the substrate, never CSS:
 *
 *   - a targeted `Within(density → compact)` OWNS the grafted subtree and RETIERS it
 *     compact (context algebra, Lemma 2), and
 *   - a targeted `Within(collapse)` WITHHOLDS it behind a native labelled disclosure,
 *
 * both wrapped in the home tree's own authored `Frame`/panel with a strong lede. The
 * compiled tree is only ever a Within TARGET — it is passed through untouched.
 *
 * Failure posture is stale-beats-blank: a live panel renders fresh, a stale panel renders
 * its last-good compile stamped "as of HH:MM" at `provenance` intent, and a dead panel
 * with no cache degrades to a quiet cell naming the source. One dead kernel never blanks
 * or 500s the home. No trust/receipt chrome is painted here — receipts stay on the pane.
 */

import type { Node } from "$lib";

export interface LivePanelView {
	readonly kind: "live";
	readonly sourceId: string;
	readonly title: string;
	readonly tree: Node;
	readonly resolvedWindow?: string;
}

export interface StalePanelView {
	readonly kind: "stale";
	readonly sourceId: string;
	readonly title: string;
	readonly tree: Node;
	readonly resolvedWindow?: string;
	/** Wall-clock "HH:MM" the cached compile was last admitted. */
	readonly staleAsOf: string;
}

export interface DeadPanelView {
	readonly kind: "dead";
	readonly sourceId: string;
	readonly title: string;
}

export type HomePanelView = LivePanelView | StalePanelView | DeadPanelView;

export interface HomeModel {
	readonly title: string;
	readonly grammarVersion: string;
	/** The requested `as_of`, echoed in the masthead when the viewer is holding a date. */
	readonly asOf?: string;
	readonly panels: readonly HomePanelView[];
}

export function homeTree(model: HomeModel): Node {
	return {
		kind: "frame",
		role: "page",
		surface: "base",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					masthead(model),
					{ kind: "spacer", size: "md" },
					...(model.panels.length === 0 ? [emptyState()] : [panelGrid(model.panels)]),
					{ kind: "spacer", size: "lg" },
					footer(model),
				],
			},
		],
	};
}

function masthead(model: HomeModel): Node {
	const heading: Node = {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "Home", as: "caption", intent: "folio" },
			{ kind: "text", value: model.title, as: "display", emphasis: "strong" },
			...(model.asOf === undefined
				? []
				: [
						{
							kind: "text",
							value: `as of ${model.asOf}`,
							as: "caption",
							intent: "provenance",
						} as Node,
					]),
		],
	};
	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "baseline",
		children: [
			heading,
			{ kind: "badge", label: `grammar ${model.grammarVersion}`, intent: "provenance" },
		],
	};
}

function emptyState(): Node {
	return {
		kind: "inline-alert",
		tone: "info",
		title: "No home panels configured",
		detail: "Declare `home_panel` on a source in MORPHE_SOURCES to compose the home surface.",
	};
}

function panelGrid(panels: readonly HomePanelView[]): Node {
	return {
		kind: "grid",
		role: "list",
		minTrack: "wide",
		children: panels.map(panel),
	};
}

function panel(view: HomePanelView): Node {
	if (view.kind === "dead") return deadPanel(view);
	return digestPanel(view);
}

/** Caption row for a live/stale panel: resolved-window and stale-stamp, both provenance. */
function captions(view: LivePanelView | StalePanelView): Node[] {
	const out: Node[] = [];
	if (view.resolvedWindow !== undefined) {
		out.push({ kind: "badge", label: `resolved ${view.resolvedWindow}`, intent: "provenance" });
	}
	if (view.kind === "stale") {
		out.push({
			kind: "text",
			value: `as of ${view.staleAsOf}`,
			as: "caption",
			intent: "provenance",
		});
	}
	return out;
}

function digestPanel(view: LivePanelView | StalePanelView): Node {
	const header: Node = {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "baseline",
		children: [
			// The strong lede — the one loud claim per panel (budget renormalizes the rest).
			{ kind: "text", value: view.title, as: "heading", emphasis: "strong" },
			{ kind: "cluster", role: "inline", align: "center", children: captions(view) },
		],
	};
	// collapse WITHHOLDS a density-RETIERED graft of the whole compiled tree. The compiled
	// tree is only a Within target — never mutated. Default choice 1 → collapsed; default 0
	// on the inner density Within → compact.
	const digest: Node = {
		kind: "within",
		id: `home:${view.sourceId}:collapse`,
		dimension: "collapse",
		range: [0, 1],
		default: 1,
		summary: "Open full surface",
		target: {
			kind: "within",
			id: `home:${view.sourceId}:density`,
			dimension: "density",
			range: [0, 2],
			default: 0,
			target: view.tree,
		},
	};
	return {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [header, { kind: "spacer", size: "sm" }, digest],
	};
}

function deadPanel(view: DeadPanelView): Node {
	return {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{ kind: "text", value: view.title, as: "heading", emphasis: "strong" },
			{ kind: "spacer", size: "sm" },
			{
				kind: "inline-alert",
				tone: "info",
				title: "Source unavailable",
				detail: `${view.title} could not be reached and has no cached surface yet.`,
			},
		],
	};
}

function footer(model: HomeModel): Node {
	const live = model.panels.filter((p) => p.kind === "live").length;
	const stale = model.panels.filter((p) => p.kind === "stale").length;
	const dead = model.panels.filter((p) => p.kind === "dead").length;
	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		children: [
			{
				kind: "text",
				value: `${model.panels.length} panels · ${live} live · ${stale} stale · ${dead} unavailable`,
				as: "caption",
				intent: "provenance",
			},
			{
				kind: "link",
				href: "/surfaces",
				label: "Browse the full surface catalog",
			},
		],
	};
}

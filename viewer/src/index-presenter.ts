/**
 * The index page as an authored Morphe tree (pure presenter — no clock, no I/O).
 *
 * The viewer's own landing page is dogfood: one SignalCard per configured source
 * (kicker = declared kind + icon, measure = declared surface count, body slot =
 * the surface links, signal slot = the source's dialect as a badge), rendered
 * under whatever dialect the deployment declares. Everything painted here is
 * config-declared — the index never probes an upstream to decorate itself.
 */

import type { Node } from "$lib";

export interface IndexSurfaceLink {
	readonly title: string;
	readonly href: string;
}

export interface IndexSource {
	readonly id: string;
	readonly title: string;
	readonly kind: "store" | "kernel";
	/** Declared dialect for the source's panes; absent when per-artifact (store). */
	readonly dialectId?: string;
	readonly icon?: string;
	readonly surfaces: readonly IndexSurfaceLink[];
}

export interface IndexModel {
	readonly title: string;
	readonly grammarVersion: string;
	readonly sources: readonly IndexSource[];
}

const KIND_LABEL: Record<IndexSource["kind"], string> = {
	kernel: "Kernel",
	store: "Artifact store",
};

export function indexTree(model: IndexModel): Node {
	const surfaceCount = model.sources.reduce((sum, source) => sum + source.surfaces.length, 0);
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
					...(model.sources.length === 0 ? [emptyState()] : [sourceGrid(model.sources)]),
					{ kind: "spacer", size: "lg" },
					footer(model, surfaceCount),
				],
			},
		],
	};
}

function masthead(model: IndexModel): Node {
	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "baseline",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{ kind: "text", value: "Surfaces", as: "caption", intent: "folio" },
					{ kind: "text", value: model.title, as: "display", emphasis: "strong" },
				],
			},
			{ kind: "badge", label: `grammar ${model.grammarVersion}`, intent: "provenance" },
		],
	};
}

function emptyState(): Node {
	return {
		kind: "inline-alert",
		tone: "info",
		title: "No sources configured",
		detail:
			"Set MORPHE_SOURCES (or the legacy MORPHE_ARTIFACT_BASE_URL) to give this viewer something to show.",
	};
}

function sourceGrid(sources: readonly IndexSource[]): Node {
	return {
		kind: "grid",
		role: "list",
		minTrack: "regular",
		children: sources.map(sourceCard),
	};
}

function sourceCard(source: IndexSource): Node {
	const signal: Node[] =
		source.dialectId === undefined
			? []
			: [{ kind: "badge", label: source.dialectId, intent: "info" }];
	return {
		kind: "compound",
		name: "SignalCard",
		args: {
			kicker: kicker(source),
			title: { kind: "text", value: source.title, as: "subheading" },
			measure: surfaceMeasure(source),
		},
		slots: {
			signal,
			body: [surfaceLinks(source)],
		},
	};
}

function kicker(source: IndexSource): Node {
	const label: Node = {
		kind: "text",
		value: KIND_LABEL[source.kind],
		as: "caption",
		intent: "folio",
	};
	if (source.icon === undefined) return label;
	return {
		kind: "cluster",
		role: "inline",
		align: "center",
		children: [{ kind: "icon", name: source.icon, a11y: { role: "decorative" } }, label],
	};
}

function surfaceMeasure(source: IndexSource): Node {
	return {
		kind: "number",
		value: source.surfaces.length,
		format: "integer",
		emphasis: "strong",
		intent: source.surfaces.length === 0 ? "neutral" : "evidence",
	};
}

function surfaceLinks(source: IndexSource): Node {
	if (source.surfaces.length === 0) {
		return {
			kind: "text",
			value:
				source.kind === "store"
					? "No declared surfaces — store artifacts are addressed directly by id."
					: "No declared surfaces.",
			as: "caption",
			intent: "marginalia",
		};
	}
	return {
		kind: "stack",
		role: "list",
		children: source.surfaces.map((surface) => ({
			kind: "link",
			href: surface.href,
			label: surface.title,
		})),
	};
}

function footer(model: IndexModel, surfaceCount: number): Node {
	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		children: [
			{
				kind: "text",
				value: `${model.sources.length} sources · ${surfaceCount} declared surfaces`,
				as: "caption",
				intent: "provenance",
			},
			{
				kind: "text",
				value: "Declared surfaces only — this viewer is not an open proxy.",
				as: "caption",
				intent: "marginalia",
			},
		],
	};
}

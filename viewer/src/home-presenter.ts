/**
 * The operator-first composed home surface (KRA-798).
 *
 * Pure presenter — no clock, no I/O and no source-shaped branches. The server admits each
 * source's DECLARED home pane through the shared pane pipeline and reduces the result to the
 * same three states for every source: live, stale last-good, or unavailable. The reading order
 * is deliberate:
 *
 *   1. current admission freshness;
 *   2. exceptions that need attention (from admission state or authored caution feedback); and
 *   3. navigation to the declared domain panes.
 *
 * A live source no longer becomes an equal raised card or a duplicate embedded application.
 * Instead, generic Morphe feedback semantics (`status`/`inline-alert` with `caution` tone) lift
 * an attention-bearing live pane into the exception queue. Stale still beats blank. In both
 * cases, the whole admitted testimony remains available inside the exception that explains it;
 * an outline-retiered clone becomes the density/collapse `Within` target, and the admitted input
 * is never mutated.
 */

import { type Node, resolveVaryOption } from "$lib";

interface PanelIdentity {
	readonly sourceId: string;
	readonly sourceTitle: string;
	readonly title: string;
	/** The source's config-declared home pane, never a discovered or inferred route. */
	readonly href: string;
}

export interface LivePanelView extends PanelIdentity {
	readonly kind: "live";
	readonly tree: Node;
	readonly resolvedWindow?: string;
}

export interface StalePanelView extends PanelIdentity {
	readonly kind: "stale";
	readonly tree: Node;
	readonly resolvedWindow?: string;
	/** Wall-clock "HH:MM" the cached compile was last admitted. */
	readonly staleAsOf: string;
}

export interface DeadPanelView extends PanelIdentity {
	readonly kind: "dead";
}

export type HomePanelView = LivePanelView | StalePanelView | DeadPanelView;

export interface HomeModel {
	readonly title: string;
	readonly grammarVersion: string;
	/** The requested `as_of`, echoed in the masthead and carried into domain links. */
	readonly asOf?: string;
	readonly panels: readonly HomePanelView[];
}

interface TestimonyAttention {
	readonly view: LivePanelView;
	readonly signals: readonly string[];
}

type HomeException = StalePanelView | DeadPanelView | TestimonyAttention;

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
					...(model.panels.length === 0 ? [emptyState()] : homeContent(model.panels, model.asOf)),
					{ kind: "spacer", size: "lg" },
					footer(model),
				],
			},
		],
	};
}

function masthead(model: HomeModel): Node {
	return {
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
}

function emptyState(): Node {
	return {
		kind: "inline-alert",
		tone: "info",
		title: "No home sources configured",
		detail: "Declare a home pane on a source to include it in this operational overview.",
	};
}

function homeContent(panels: readonly HomePanelView[], asOf?: string): Node[] {
	const exceptions = attentionQueue(panels);
	return [
		freshnessSection(panels),
		...(exceptions.length === 0 ? [] : [exceptionSection(exceptions, asOf)]),
		domainNavigation(panels, asOf),
	];
}

function attentionQueue(panels: readonly HomePanelView[]): HomeException[] {
	const queue: HomeException[] = [];
	for (const panel of panels) {
		if (panel.kind !== "live") {
			queue.push(panel);
			continue;
		}
		const signals = testimonyAttention(panel.tree);
		if (signals.length > 0) queue.push({ view: panel, signals });
	}
	return queue;
}

/**
 * Read only Morphe's generic feedback semantics. This does not inspect producer fields,
 * diagnostic codes, labels, source IDs, or compound names. A caution Status/InlineAlert is an
 * authored request for attention under every kernel and dialect; success/info/neutral remain
 * calm. Walking every rendered object value also finds feedback carried through compound args
 * and slots. A Vary contributes only its authored default because home has no choice map; an
 * inactive option must not create a phantom exception.
 */
function testimonyAttention(tree: Node): string[] {
	const alertSignals: string[] = [];
	const statusSignals: string[] = [];
	const seen = new WeakSet<object>();

	function visit(value: unknown): void {
		if (typeof value !== "object" || value === null || seen.has(value)) return;
		seen.add(value);
		if (Array.isArray(value)) {
			for (const child of value) visit(child);
			return;
		}

		const record = value as Record<string, unknown>;
		if (record.kind === "vary") {
			const selected = resolveVaryOption(
				value as Extract<Node, { readonly kind: "vary" }>,
				undefined,
			);
			if (selected !== undefined) visit(selected);
			return;
		}

		if (record.kind === "status" && record.tone === "caution") {
			const signal = record.signal;
			if (typeof signal === "object" && signal !== null) {
				const text = (signal as Record<string, unknown>).text;
				if (typeof text === "string" && text.trim().length > 0) statusSignals.push(text.trim());
			}
		} else if (record.kind === "inline-alert" && record.tone === "caution") {
			const detail = nonEmptyString(record.detail);
			const repair = nonEmptyString(record.repair);
			const operatorCopy = uniqueStrings([detail, repair]).join(" — ");
			if (operatorCopy.length > 0) {
				alertSignals.push(operatorCopy);
			} else {
				const title = nonEmptyString(record.title);
				if (title !== undefined) alertSignals.push(title);
			}
		}

		for (const child of Object.values(record)) visit(child);
	}

	visit(tree);
	return uniqueStrings(alertSignals.length > 0 ? alertSignals : statusSignals);
}

function nonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
	return [...new Set(values.filter((value): value is string => value !== undefined))];
}

function freshnessSection(panels: readonly HomePanelView[]): Node {
	const live = panels.filter((panel) => panel.kind === "live").length;
	const stale = panels.filter((panel) => panel.kind === "stale").length;
	const dead = panels.filter((panel) => panel.kind === "dead").length;
	const freshnessExceptionCount = stale + dead;
	const summary: Node =
		freshnessExceptionCount === 0
			? {
					kind: "status",
					tone: "success",
					signal: {
						text:
							live === 1 ? "The configured source is current" : `All ${live} sources are current`,
						icon: "check_circle",
					},
				}
			: {
					kind: "status",
					tone: "caution",
					signal: {
						text: `${freshnessExceptionCount} ${freshnessExceptionCount === 1 ? "source is" : "sources are"} not current`,
						icon: "warning",
					},
				};

	return {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "Source freshness", as: "heading", emphasis: "strong" },
			summary,
			{
				kind: "text",
				value: `${live} current · ${stale} cached · ${dead} unavailable`,
				as: "caption",
				intent: "provenance",
			},
			{ kind: "spacer", size: "md" },
		],
	};
}

function exceptionSection(exceptions: readonly HomeException[], asOf?: string): Node {
	return {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "Needs attention", as: "heading", emphasis: "strong" },
			{
				kind: "stack",
				role: "list",
				children: exceptions.map((view) => exceptionItem(view, asOf)),
			},
			{ kind: "spacer", size: "md" },
		],
	};
}

function exceptionItem(view: HomeException, asOf?: string): Node {
	if ("view" in view) return liveAttentionItem(view, asOf);
	if (view.kind === "dead") {
		return {
			kind: "stack",
			role: "section",
			children: [
				{
					kind: "inline-alert",
					tone: "caution",
					title: `${view.title} is unavailable`,
					detail: "The source could not be reached and no cached surface is available.",
				},
				paneLink(view, asOf, true),
			],
		};
	}

	return {
		kind: "stack",
		role: "section",
		children: [
			{
				kind: "inline-alert",
				tone: "caution",
				title: `${view.title} is using cached data`,
				detail: `Current admission failed. The last admitted surface from ${view.staleAsOf} remains available.`,
			},
			staleDigest(view),
			paneLink(view, asOf, true),
		],
	};
}

function liveAttentionItem(attention: TestimonyAttention, asOf?: string): Node {
	const { view, signals } = attention;
	return {
		kind: "stack",
		role: "section",
		children: [
			{
				kind: "inline-alert",
				tone: "caution",
				title: `${view.title} reports attention`,
				detail: signals.join(" · "),
			},
			testimonyDigest(view, `Review ${view.title}`),
			paneLink(view, asOf, true),
		],
	};
}

/** Preserve the whole last-good compile without returning to an always-equal card wall. */
function staleDigest(view: StalePanelView): Node {
	return testimonyDigest(view, `Review cached ${view.title}`);
}

function testimonyDigest(view: LivePanelView | StalePanelView, summary: string): Node {
	return {
		kind: "within",
		id: `home:${view.sourceId}:attention-collapse`,
		dimension: "collapse",
		range: [0, 1],
		default: 1,
		summary,
		target: {
			kind: "within",
			id: `home:${view.sourceId}:attention-density`,
			dimension: "density",
			range: [0, 2],
			default: 0,
			target: embeddedTestimony(view.tree),
		},
	};
}

/**
 * A pane owns the page-level task heading when rendered by itself. Once grafted beneath the
 * home's disclosure, that same explicit level-one heading becomes level two so the document
 * keeps one H1. Clone every node/value (including inactive choices and compound arguments),
 * changing only that outline metadata: the admitted testimony remains complete and its input is
 * never mutated.
 */
function embeddedTestimony(tree: Node): Node {
	return cloneForEmbeddedOutline(tree, new WeakMap()) as Node;
}

function cloneForEmbeddedOutline(value: unknown, seen: WeakMap<object, unknown>): unknown {
	if (typeof value !== "object" || value === null) return value;
	if (seen.has(value)) return seen.get(value);

	if (Array.isArray(value)) {
		const clone: unknown[] = [];
		seen.set(value, clone);
		for (const child of value) clone.push(cloneForEmbeddedOutline(child, seen));
		return clone;
	}

	const record = value as Record<string, unknown>;
	const clone: Record<string, unknown> = {};
	seen.set(value, clone);
	for (const [key, child] of Object.entries(record)) {
		clone[key] = cloneForEmbeddedOutline(child, seen);
	}
	if (record.kind === "text" && record.level === 1) clone.level = 2;
	return clone;
}

function domainNavigation(panels: readonly HomePanelView[], asOf?: string): Node {
	return {
		kind: "stack",
		role: "section",
		children: [
			{ kind: "text", value: "Domains", as: "heading", emphasis: "strong" },
			{
				kind: "text",
				value: "Open a declared domain pane for its complete worklist and audit detail.",
				as: "body",
			},
			{
				kind: "stack",
				role: "list",
				children: panels.map((view) => domainRow(view, asOf)),
			},
		],
	};
}

function domainRow(view: HomePanelView, asOf?: string): Node {
	const liveAttention = view.kind === "live" ? testimonyAttention(view.tree).length : 0;
	const status: Node =
		view.kind === "live"
			? liveAttention === 0
				? { kind: "status", tone: "success", signal: { text: "Current", icon: "check_circle" } }
				: {
						kind: "status",
						tone: "caution",
						signal: {
							text: `Current · ${liveAttention} attention ${liveAttention === 1 ? "signal" : "signals"}`,
							icon: "warning",
						},
					}
			: view.kind === "stale"
				? {
						kind: "status",
						tone: "caution",
						signal: { text: `Cached from ${view.staleAsOf}`, icon: "history" },
					}
				: { kind: "status", tone: "caution", signal: { text: "Unavailable", icon: "warning" } };
	const context =
		view.kind !== "dead" && view.resolvedWindow !== undefined
			? [
					{
						kind: "text",
						value: `Resolved ${view.resolvedWindow}`,
						as: "caption",
						intent: "provenance",
					} as Node,
				]
			: [];
	const paneContext: Node[] =
		view.title === view.sourceTitle
			? context
			: [{ kind: "text", value: view.title, as: "body", intent: "neutral" }, ...context];

	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "center",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{ kind: "text", value: view.sourceTitle, as: "subheading" },
					...paneContext,
					status,
				],
			},
			paneLink(view, asOf),
		],
	};
}

function paneLink(view: PanelIdentity, asOf?: string, detail = false): Node {
	const href =
		asOf === undefined
			? view.href
			: `${view.href}?${new URLSearchParams({ as_of: asOf }).toString()}`;
	return {
		kind: "link",
		href,
		label: detail ? `Open ${view.sourceTitle} details` : `Open ${view.sourceTitle}`,
	};
}

function footer(model: HomeModel): Node {
	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "baseline",
		children: [
			{ kind: "link", href: "/surfaces", label: "Browse every declared surface" },
			{
				kind: "disclosure",
				summary: "Technical details",
				children: [
					{
						kind: "text",
						value: `Grammar ${model.grammarVersion}`,
						as: "caption",
						intent: "provenance",
					},
				],
			},
		],
	};
}

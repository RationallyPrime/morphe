/**
 * The operator-first composed home surface (KRA-798).
 *
 * Pure presenter — no clock, no I/O and no source-shaped branches. The server admits each
 * source's DECLARED home pane through the shared pane pipeline and reduces the result to the
 * same three states for every source: live, stale last-good, or unavailable. The reading order
 * is deliberate:
 *
 *   1. immediate board identity and reporting date;
 *   2. one compact freshness pulse;
 *   3. exceptions that need attention (from admission state or authored caution feedback); and
 *   4. a compact map of calm domains that are not already represented by an action.
 *
 * A live source no longer becomes an equal raised card or a duplicate embedded application.
 * Instead, generic Morphe feedback semantics (`status`/`inline-alert` with `caution` tone) lift
 * an attention-bearing live pane into a calm ActionSummary. Stale still beats blank. The whole
 * admitted testimony remains available on demand; the default scan path carries source, state,
 * consequence, and action without repeating raw resolution identifiers.
 */

import { type Node, resolveVaryOption } from "$lib";
import { withForwardedQuery } from "./forward-query.js";

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
	const count = model.panels.length;
	return {
		kind: "stack",
		role: "section",
		children: [
			{
				kind: "text",
				value: "Operational board",
				as: "caption",
				intent: "footnote",
			},
			{ kind: "text", value: model.title, as: "display", emphasis: "strong" },
			{
				kind: "text",
				value:
					count === 0
						? "A signed operating picture will appear as domains are declared."
						: `${quantityWord(count)} independent ${count === 1 ? "domain" : "domains"}. One signed operating picture.`,
				as: "body",
				intent: "neutral",
			},
			...(model.asOf === undefined
				? []
				: [
						{
							kind: "text",
							value: `Reporting date · ${displayDate(model.asOf)}`,
							as: "caption",
							intent: "provenance",
						} as Node,
					]),
		],
	};
}

function quantityWord(value: number): string {
	const words = [
		"Zero",
		"One",
		"Two",
		"Three",
		"Four",
		"Five",
		"Six",
		"Seven",
		"Eight",
		"Nine",
		"Ten",
	];
	return words[value] ?? String(value);
}

function displayDate(value: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (match === null) return value;
	const month = Number(match[2]);
	const day = Number(match[3]);
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];
	const monthName = months[month - 1];
	if (monthName === undefined || day < 1 || day > 31) return value;
	return `${monthName} ${day}, ${match[1]}`;
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
	const represented = new Set(
		exceptions.map((exception) =>
			"view" in exception ? exception.view.sourceId : exception.sourceId,
		),
	);
	const calmPanels = panels.filter((panel) => !represented.has(panel.sourceId));
	return [
		freshnessSection(panels),
		...(exceptions.length === 0 ? [] : [exceptionSection(exceptions, asOf)]),
		...(calmPanels.length === 0 ? [] : [domainNavigation(calmPanels, asOf, exceptions.length > 0)]),
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

	// The counts breakdown earns its line only when there is more than one
	// source to break down; for a single source it restates the status above.
	const counts: Node[] =
		panels.length > 1
			? [
					{
						kind: "text",
						value: `${live} current · ${stale} cached · ${dead} unavailable`,
						as: "caption",
						intent: "provenance",
					} as Node,
				]
			: [];
	return {
		kind: "frame",
		role: "panel",
		surface: "sunken",
		density: "compact",
		children: [
			{
				kind: "cluster",
				role: "toolbar",
				justify: "between",
				align: "center",
				children: [
					{
						kind: "stack",
						role: "section",
						children: [
							{
								kind: "text",
								value: "Operational pulse",
								as: "subheading",
								emphasis: "strong",
							},
							...counts,
						],
					},
					summary,
				],
			},
		],
	};
}

function exceptionSection(exceptions: readonly HomeException[], asOf?: string): Node {
	return {
		kind: "stack",
		role: "section",
		children: [
			{
				kind: "text",
				value: "Needs attention",
				as: "heading",
				emphasis: "strong",
			},
			{
				kind: "text",
				value: `${exceptions.length} ${exceptions.length === 1 ? "domain has" : "domains have"} an open decision or freshness problem.`,
				as: "body",
				intent: "neutral",
			},
			{
				kind: "stack",
				role: "list",
				children: exceptions.map((view, index) => exceptionItem(view, asOf, index)),
			},
			{ kind: "spacer", size: "md" },
		],
	};
}

function exceptionItem(view: HomeException, asOf: string | undefined, index: number): Node {
	if ("view" in view) return liveAttentionItem(view, asOf, index);
	if (view.kind === "dead") {
		return actionFrame(
			view,
			"Unavailable",
			"The source could not be reached and no last-good surface is available.",
			asOf,
			index,
		);
	}

	return actionFrame(
		view,
		"Using last-good data",
		`Current admission failed. The surface admitted at ${view.staleAsOf} remains available.`,
		asOf,
		index,
		[staleDigest(view)],
	);
}

function liveAttentionItem(
	attention: TestimonyAttention,
	asOf: string | undefined,
	index: number,
): Node {
	const { view, signals } = attention;
	return actionFrame(view, "Needs review", signals.join(" · "), asOf, index, [
		testimonyDigest(view, `Preview ${view.title} here`),
	]);
}

function actionFrame(
	view: PanelIdentity,
	state: string,
	summary: string,
	asOf: string | undefined,
	index: number,
	detail: readonly Node[] = [],
): Node {
	return {
		kind: "frame",
		role: "panel",
		surface: index === 0 ? "raised" : "base",
		density: index === 0 ? "regular" : "compact",
		children: [
			{
				kind: "compound",
				name: "ActionSummary",
				args: {
					eyebrow: {
						kind: "text",
						value: view.sourceTitle,
						as: "caption",
						intent: "footnote",
					},
					title: {
						kind: "text",
						value: view.title,
						as: "subheading",
						emphasis: index === 0 ? "strong" : "normal",
					},
					summary: {
						kind: "text",
						value: summary,
						as: "body",
						intent: "neutral",
					},
				},
				slots: {
					signal: [
						{
							kind: "status",
							tone: "caution",
							signal: {
								text: state,
								icon: state === "Unavailable" ? "cloud_off" : "warning",
							},
						},
					],
					action: [paneLink(view, asOf, true)],
					detail,
				},
			},
		],
	};
}

/** Preserve the whole last-good compile without returning to an always-equal card wall. */
function staleDigest(view: StalePanelView): Node {
	return testimonyDigest(view, `Preview cached ${view.title} here`);
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

function domainNavigation(
	panels: readonly HomePanelView[],
	asOf: string | undefined,
	followsExceptions: boolean,
): Node {
	return {
		kind: "stack",
		role: "section",
		children: [
			{
				kind: "text",
				value: followsExceptions ? "Other domains" : "Domains",
				as: "heading",
				emphasis: "strong",
			},
			{
				kind: "text",
				value: followsExceptions
					? `${panels.length} current ${panels.length === 1 ? "domain has" : "domains have"} no open review.`
					: "Every declared home pane is current and one move away.",
				as: "body",
			},
			{
				kind: "grid",
				role: "list",
				minTrack: "wide",
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
				? {
						kind: "status",
						tone: "success",
						signal: { text: "Current", icon: "check_circle" },
					}
				: {
						kind: "status",
						tone: "caution",
						signal: {
							text: "Needs review",
							icon: "warning",
						},
					}
			: view.kind === "stale"
				? {
						kind: "status",
						tone: "caution",
						signal: { text: `Cached from ${view.staleAsOf}`, icon: "history" },
					}
				: {
						kind: "status",
						tone: "caution",
						signal: { text: "Unavailable", icon: "warning" },
					};
	const paneContext: Node[] =
		view.title === view.sourceTitle
			? []
			: [{ kind: "text", value: view.title, as: "body", intent: "neutral" }];

	return {
		kind: "frame",
		role: "panel",
		surface: "sunken",
		density: "compact",
		children: [
			{
				kind: "stack",
				role: "panel",
				children: [
					{
						kind: "cluster",
						role: "toolbar",
						justify: "between",
						align: "center",
						children: [{ kind: "text", value: view.sourceTitle, as: "subheading" }, status],
					},
					...paneContext,
					paneLink(view, asOf),
				],
			},
		],
	};
}

function paneLink(view: PanelIdentity, asOf?: string, detail = false): Node {
	const href = withForwardedQuery(
		view.href,
		asOf === undefined ? new URLSearchParams() : new URLSearchParams({ as_of: asOf }),
	);
	return {
		kind: "link",
		href,
		label: detail ? `Open ${view.sourceTitle} details` : `Open ${view.sourceTitle}`,
		intent: "primary-action",
	};
}

function footer(model: HomeModel): Node {
	return {
		kind: "cluster",
		role: "toolbar",
		justify: "between",
		align: "baseline",
		children: [
			{
				kind: "link",
				href: withForwardedQuery(
					"/surfaces",
					model.asOf === undefined
						? new URLSearchParams()
						: new URLSearchParams({ as_of: model.asOf }),
				),
				label: "Browse every declared surface",
			},
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

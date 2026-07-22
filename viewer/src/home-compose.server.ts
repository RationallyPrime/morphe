/**
 * The composed-home orchestration core (KRA-789), deliberately `$env`-free so it is
 * unit-testable by injecting the fetch/load seam — exactly how the other viewer server
 * tests mock the pipeline. The route wrapper (`routes/+page.server.ts`) owns `$env`:
 * reading config, resolving the dialect, and resolving each source's PRIVATE bearer, then
 * handing the resolved panel roster here.
 *
 * Each roster entry is admitted through the SHARED `loadSourcePane`. Success writes the
 * last-good cache and yields a live panel; a caught failure falls back to the cache
 * (stale, stamped) or a quiet dead cell. One dead kernel never blanks or 500s the home.
 */

import { readLastGood, staleStamp, writeLastGood } from "./home-cache.server.js";
import type { HomePanelView } from "./home-presenter.js";
import {
	loadSourcePane,
	type PaneLoad,
	type PaneLoadRequest,
	paneRequestIdentity,
} from "./pane-load.server.js";
import type { BoardConfig, SourceConfig, SurfaceEntry } from "./sources.js";

export interface HomePanelSource {
	readonly source: SourceConfig;
	readonly entry: SurfaceEntry;
	readonly bearer?: string;
	/** Declared panel lede title from `home_panel`. */
	readonly title: string;
}

export interface ComposeHomeOptions {
	readonly board: BoardConfig;
	readonly panels: readonly HomePanelSource[];
	readonly searchParams: URLSearchParams;
	readonly fetch: typeof globalThis.fetch;
	/** The single dialect every panel is gated + rendered under on home. */
	readonly dialectId: string;
	/** Parsed board/mount policy namespace; prevents stale joined links crossing a config change. */
	readonly boardPolicyKey: string;
	/** Capture-time clock for the last-good stamp (injectable for deterministic tests). */
	readonly now?: () => Date;
	/** The admission seam; defaults to the shared pane loader, overridable in tests. */
	readonly loadPane?: (request: PaneLoadRequest) => Promise<PaneLoad>;
}

export async function composeHomePanels(options: ComposeHomeOptions): Promise<HomePanelView[]> {
	const load = options.loadPane ?? loadSourcePane;
	const now = options.now ?? (() => new Date());
	const views: HomePanelView[] = [];

	for (const { source, entry, bearer, title } of options.panels) {
		const requestIdentity = paneRequestIdentity(source, entry, options.searchParams);
		const deliveryRequestKey = requestIdentity.cacheKey;
		try {
			const pane = await load({
				board: options.board,
				source,
				entry,
				searchParams: requestIdentity.normalizedQuery,
				fetch: options.fetch,
				...(bearer === undefined ? {} : { bearer }),
				dialectOverride: options.dialectId,
			});
			writeLastGood(
				source.id,
				entry.id,
				pane.surface.dialectId,
				options.boardPolicyKey,
				deliveryRequestKey,
				{
					tree: pane.surface.tree,
					dialectId: pane.surface.dialectId,
					...(pane.resolvedWindow === undefined ? {} : { resolvedWindow: pane.resolvedWindow }),
					admittedAt: now(),
				},
			);
			views.push({
				kind: "live",
				sourceId: source.id,
				sourceTitle: source.title,
				title,
				href: `/s/${source.id}/${entry.id}`,
				tree: pane.surface.tree,
				...(pane.resolvedWindow === undefined ? {} : { resolvedWindow: pane.resolvedWindow }),
			});
		} catch {
			const cached = readLastGood(
				source.id,
				entry.id,
				options.dialectId,
				options.boardPolicyKey,
				deliveryRequestKey,
			);
			if (cached !== undefined) {
				views.push({
					kind: "stale",
					sourceId: source.id,
					sourceTitle: source.title,
					title,
					href: `/s/${source.id}/${entry.id}`,
					tree: cached.tree,
					...(cached.resolvedWindow === undefined ? {} : { resolvedWindow: cached.resolvedWindow }),
					staleAsOf: staleStamp(cached.admittedAt),
				});
			} else {
				views.push({
					kind: "dead",
					sourceId: source.id,
					sourceTitle: source.title,
					title,
					href: `/s/${source.id}/${entry.id}`,
				});
			}
		}
	}

	return views;
}

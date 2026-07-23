/**
 * Sibling-pane navigation for the viewer chrome.
 *
 * A pane route is not a dead end: every declared, catalog-visible pane of the
 * SAME source is one hop away. The rungs are pure data (like `crumbs.ts`) so the
 * trail unit-tests without a component render — `ViewerChrome` stays a dumb
 * renderer. Route-only surfaces are declared destinations, not navigation
 * positions, so they never appear here; a source with fewer than two visible
 * panes has nothing to switch between and contributes no nav at all.
 *
 * `as_of` is the one cross-pane operator state (KRA-789 fan-out convention): it
 * rides every sibling link so switching panes keeps the selected date. Pane-
 * local filters (a worker id, a run id) deliberately do NOT carry — they belong
 * to the pane that minted them.
 */

import type { SourceConfig } from "./sources.js";

export interface PaneNavItem {
	readonly label: string;
	/** Absent on the current pane, which renders as inert `aria-current` text. */
	readonly href?: string;
}

export function paneNav(
	source: SourceConfig,
	currentSurfaceId: string,
	asOf?: string,
): PaneNavItem[] {
	const visible = source.surfaces.filter((surface) => !surface.routeOnly);
	if (visible.length < 2 && visible.some((surface) => surface.id === currentSurfaceId)) {
		return [];
	}
	if (visible.length === 0) return [];
	const query = asOf === undefined ? "" : `?${new URLSearchParams({ as_of: asOf })}`;
	return visible.map((surface) =>
		surface.id === currentSurfaceId
			? { label: surface.title }
			: { label: surface.title, href: `/s/${source.id}/${surface.id}${query}` },
	);
}

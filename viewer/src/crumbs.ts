/**
 * Breadcrumb trails, re-rooted at Home (KRA-789).
 *
 * Home (`/`) is the navigation root; the source catalog moved to `/surfaces`. A pane trail
 * therefore leads with a Home rung, then the catalog, then the source collection (when the
 * source declares one), then the inert current pane. Kept as pure data so the trail is unit
 * tested without a component render — `ViewerChrome` is a dumb renderer of these rungs.
 */

export interface Crumb {
	readonly label: string;
	readonly href?: string;
}

/** Home is the root: a single inert current-location rung. */
export function homeCrumbs(): Crumb[] {
	return [{ label: "Home" }];
}

/** The catalog is reachable from home and links back to it. */
export function catalogCrumbs(): Crumb[] {
	return [{ label: "Home", href: "/" }, { label: "Surfaces" }];
}

export interface PaneCrumbInput {
	readonly sourceTitle: string;
	readonly surfaceTitle: string;
	/** The source's declared collection pane, when there is one and it is not this pane. */
	readonly collectionHref?: string;
}

export function paneCrumbs(input: PaneCrumbInput): Crumb[] {
	return [
		{ label: "Home", href: "/" },
		{ label: "Surfaces", href: "/surfaces" },
		{ label: input.sourceTitle, href: input.collectionHref },
		{ label: input.surfaceTitle },
	];
}

import { describe, expect, it } from "vitest";
import { catalogCrumbs, homeCrumbs, paneCrumbs } from "./crumbs.js";

describe("breadcrumb re-root (KRA-789)", () => {
	it("home is the inert current-location root", () => {
		expect(homeCrumbs()).toEqual([{ label: "Home" }]);
	});

	it("the catalog links back to home", () => {
		expect(catalogCrumbs()).toEqual([{ label: "Home", href: "/" }, { label: "Surfaces" }]);
	});

	it("keeps the selected frontier on the catalog's route back to home", () => {
		expect(catalogCrumbs("2026-07-31")).toEqual([
			{ label: "Home", href: "/?as_of=2026-07-31" },
			{ label: "Surfaces" },
		]);
	});

	it("a pane trail leads with Home, then the catalog, then the collection, then the pane", () => {
		expect(
			paneCrumbs({
				sourceTitle: "Taxis",
				surfaceTitle: "Roster",
				collectionHref: "/s/taxis/orgs",
			}),
		).toEqual([
			{ label: "Home", href: "/" },
			{ label: "Surfaces", href: "/surfaces" },
			{ label: "Taxis", href: "/s/taxis/orgs" },
			{ label: "Roster" },
		]);
	});

	it("preserves the selected frontier through every navigable pane crumb", () => {
		expect(
			paneCrumbs({
				sourceTitle: "Taxis",
				surfaceTitle: "Roster",
				collectionHref: "/s/taxis/orgs?region=west",
				asOf: "2026-07-31",
			}),
		).toEqual([
			{ label: "Home", href: "/?as_of=2026-07-31" },
			{ label: "Surfaces", href: "/surfaces?as_of=2026-07-31" },
			{
				label: "Taxis",
				href: "/s/taxis/orgs?region=west&as_of=2026-07-31",
			},
			{ label: "Roster" },
		]);
	});

	it("leaves the source rung inert when the source declares no collection", () => {
		const crumbs = paneCrumbs({ sourceTitle: "Taxis", surfaceTitle: "Roster" });
		expect(crumbs[0]).toEqual({ label: "Home", href: "/" });
		expect(crumbs[1]).toEqual({ label: "Surfaces", href: "/surfaces" });
		expect(crumbs[2]?.href).toBeUndefined();
		expect(crumbs[3]).toEqual({ label: "Roster" });
	});
});

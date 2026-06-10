/**
 * PLATE MANIFEST tests — the pure half of the derivative pipeline (KRA-325).
 *
 * Two laws under test, no sharp and no filesystem:
 *
 *   1. The OUTPUT SET: every `.png` source plans exactly 3 widths x 2 modern
 *      formats + 1 PNG fallback (7 files), with stable slug-sorted order — the
 *      committed `static/images/plates/` listing is this function's image.
 *   2. The EXCLUSION LAW: private working files (`t1-*`, `*.raw.png`,
 *      `*-raw.png`) make the WHOLE plan throw. Never a silent skip — a stray
 *      private file in the input dir must stop the pipeline cold.
 */

import { describe, expect, it } from "vitest";
import {
	assertPublicPlates,
	FALLBACK_WIDTH,
	isPrivatePlate,
	PLATE_FORMATS,
	PLATE_WIDTHS,
	plateManifest,
} from "./plate-manifest.js";

describe("plateManifest — the planned output file set", () => {
	it("plans 3 widths x 2 modern formats + the PNG fallback per source", () => {
		const entries = plateManifest(["b1-boot-on-premises.png"]);
		expect(entries).toHaveLength(1);
		const entry = entries[0];
		expect(entry?.slug).toBe("b1-boot-on-premises");
		expect(entry?.derivatives.map((d) => d.file)).toEqual([
			"b1-boot-on-premises-640.avif",
			"b1-boot-on-premises-640.webp",
			"b1-boot-on-premises-960.avif",
			"b1-boot-on-premises-960.webp",
			"b1-boot-on-premises-1440.avif",
			"b1-boot-on-premises-1440.webp",
			"b1-boot-on-premises-960.png",
		]);
	});

	it("the rungs are exactly {640, 960, 1440} x {avif, webp} and the fallback is 960 png", () => {
		// The site's srcset strings hardcode these descriptors; a drift here would
		// silently 404 every plate, so the constants themselves are pinned.
		expect(PLATE_WIDTHS).toEqual([640, 960, 1440]);
		expect(PLATE_FORMATS).toEqual(["avif", "webp"]);
		expect(FALLBACK_WIDTH).toBe(960);
	});

	it("plans all eleven public-story plates in stable slug-sorted order", () => {
		const sources = [
			"index-1.png",
			"b9-on-the-record.png",
			"b1-boot-on-premises.png",
			"b2-bind-the-sources.png",
			"b3-information-flows-in.png",
			"b4-aristotle-authors.png",
			"b5-plato-smiths.png",
			"b6-a-trigger.png",
			"b7-philosopher-king-reasons.png",
			"b8-governed-workflow.png",
			"index-0.png",
		];
		const entries = plateManifest(sources);
		expect(entries).toHaveLength(11);
		expect(entries.flatMap((e) => e.derivatives)).toHaveLength(77);
		// Stable order regardless of directory-listing order.
		expect(entries.map((e) => e.slug)).toEqual([...entries.map((e) => e.slug)].sort());
	});

	it("ignores non-png entries instead of planning derivatives for them", () => {
		const entries = plateManifest(["notes.md", "b1-boot-on-premises.png", ".gitkeep"]);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.source).toBe("b1-boot-on-premises.png");
	});
});

describe("exclusion law — private working files THROW, never skip", () => {
	it.each([
		"t1-anything.png",
		"T1-anything.png", // case-insensitive: a rename must not slip through
		"b1-boot-on-premises.raw.png",
		"b1-boot-on-premises-raw.png",
		"b1-boot-on-premises.RAW.PNG",
	])("rejects %s", (name) => {
		expect(isPrivatePlate(name)).toBe(true);
		expect(() => plateManifest([name])).toThrow(/never be committed/);
	});

	it("a single private file poisons the whole plan, even among public plates", () => {
		const listing = ["b1-boot-on-premises.png", "t1-anything.png", "b2-bind-the-sources.png"];
		expect(() => plateManifest(listing)).toThrow("t1-anything.png");
	});

	it("the assertion checks EVERY extension, not only .png inputs", () => {
		// A private file that would not even be planned (wrong extension) still throws.
		expect(() => assertPublicPlates(["t1-anything.svg"])).toThrow("t1-anything.svg");
	});

	it("accepts the public-story plates", () => {
		expect(isPrivatePlate("b1-boot-on-premises.png")).toBe(false);
		expect(isPrivatePlate("index-0.png")).toBe(false);
		expect(() => assertPublicPlates(["b1-boot-on-premises.png", "index-0.png"])).not.toThrow();
	});
});

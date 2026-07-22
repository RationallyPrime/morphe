import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import { DIALECT_LIST } from "$lib";
import ViewerChrome from "./ViewerChrome.svelte";

vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

const DIALECTS = DIALECT_LIST.filter(({ id }) => id === "gallery" || id === "ledger");

describe("ViewerChrome operator and inspection modes", () => {
	it("keeps task controls in operator chrome and collapses dialect inspection by default", () => {
		const html = render(ViewerChrome, {
			props: {
				dialects: DIALECTS,
				current: "gallery",
				crumbs: [
					{ label: "Home", href: "/" },
					{ label: "Surfaces", href: "/surfaces" },
					{ label: "Taxis fixture" },
					{ label: "Weekly roster" },
				],
				temporalPolicies: ["minute", "exact"],
				temporalPolicy: "minute",
			},
		}).body;

		expect(html).toContain('aria-label="Breadcrumb"');
		expect(html.match(/aria-current="page"/g) ?? []).toHaveLength(1);
		expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>Weekly roster<\/span>/);
		expect(html).not.toMatch(/<span[^>]*aria-current="page"[^>]*>Taxis fixture<\/span>/);
		expect(html).toContain("Operator controls");
		expect(html).toContain("Substrate inspection");

		const inspectionStart = html.indexOf("<details");
		expect(inspectionStart).toBeGreaterThan(0);
		expect(html.indexOf("Time")).toBeLessThan(inspectionStart);
		expect(html.indexOf("Dialect")).toBeGreaterThan(inspectionStart);
		expect(html).toMatch(/<option value="gallery"[^>]*>Gallery<\/option>/);
		expect(html).toContain("Explain Gallery");
		expect(html).toContain("Explain this pane");
		expect(html).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);
	});

	it("retains inspection mode without inventing operator controls on a catalog route", () => {
		const html = render(ViewerChrome, {
			props: {
				dialects: DIALECTS,
				current: "ledger",
				crumbs: [{ label: "Surfaces" }],
			},
		}).body;

		expect(html).not.toContain("Operator controls");
		expect(html).toContain("Substrate inspection");
		expect(html).toContain("Dialect");
	});

	it("renders the selected as-of date when the route enables the control", () => {
		const html = render(ViewerChrome, {
			props: {
				dialects: DIALECTS,
				current: "gallery",
				showAsOf: true,
				asOf: "2026-07-15",
			},
		}).body;

		expect(html).toContain("Operator controls");
		expect(html).toContain("As of");
		expect(html).toMatch(/<input type="date" value="2026-07-15"/);
	});
});

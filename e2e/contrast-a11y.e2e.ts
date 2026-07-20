/**
 * KRA-796 Defect 3 (the "plus" checks) — the composed playground under adverse
 * conditions the contrast matrix alone can't see: reflow at a narrow width, a
 * 200%-zoom-equivalent viewport, keyboard focus visibility, forced-colors, and
 * reduced-motion. Run against the live `/substrate` playground (one authored tree,
 * every native control, a real `mo-link`).
 */

import { expect, test } from "@playwright/test";

const ROUTE = "/substrate";
// A deterministic proof surface with real, un-disclosed Morphe links + ink on all
// three surface tiers (the app's other routes gate their links behind disclosures).
const LAB = "/contrast-lab";

test.describe("composed surface — reflow / zoom / keyboard / forced-colors / reduced-motion", () => {
	test("390px: the authored surface reflows with no horizontal overflow (WCAG 1.4.10)", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		// A 1px sub-pixel rounding slack; anything more is a real horizontal scrollbar.
		expect(overflow, "horizontal overflow at 390px").toBeLessThanOrEqual(1);
	});

	test("200%-zoom equivalent (640px reflow): no horizontal overflow", async ({ page }) => {
		// 1280 CSS px at 200% zoom reflows to a 640 CSS-px column — the reflow the
		// WCAG 200%-zoom criterion demands. A narrow viewport is the cross-browser
		// proxy (no page.zoom API); the surface must not force sideways scrolling.
		await page.setViewportSize({ width: 640, height: 900 });
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow, "horizontal overflow at 640px").toBeLessThanOrEqual(1);
	});

	test("keyboard-only: the first focusable control shows a visible focus ring", async ({
		page,
	}) => {
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		await page.keyboard.press("Tab");
		const visible = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			if (!el || el === document.body) return false;
			const s = getComputedStyle(el);
			const ring =
				(s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
			return ring;
		});
		expect(visible, "focused control has no visible focus indicator").toBe(true);
	});

	test("forced-colors: a Morphe link keeps its underline affordance", async ({ page }) => {
		await page.emulateMedia({ forcedColors: "active" });
		await page.goto(LAB, { waitUntil: "networkidle" });
		const link = page.locator("a.mo-link").first();
		await expect(link).toBeVisible();
		const deco = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
		expect(deco, "link lost its underline under forced-colors").toContain("underline");
	});

	test("reduced-motion: a Morphe link disables its colour/underline transition", async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(LAB, { waitUntil: "networkidle" });
		const link = page.locator("a.mo-link").first();
		await expect(link).toBeVisible();
		const duration = await link.evaluate((el) => getComputedStyle(el).transitionDuration);
		// The Link reduced-motion rule collapses every transition to 0s.
		expect(
			duration.split(",").every((d) => d.trim() === "0s"),
			`transitions not disabled under reduced-motion: ${duration}`,
		).toBe(true);
	});
});

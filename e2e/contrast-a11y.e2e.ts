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
const GEOMETRY_TOLERANCE_PX = 0.5;
const AA_NORMAL = 4.5;

type Rgb = [number, number, number];
function relativeLuminance([red, green, blue]: Rgb): number {
	const channel = (value: number): number => {
		const srgb = value / 255;
		return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
	const first = relativeLuminance(foreground);
	const second = relativeLuminance(background);
	const [high, low] = first >= second ? [first, second] : [second, first];
	return (high + 0.05) / (low + 0.05);
}

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

	test("Gloss markers use sibling-safe contrast ink and keep a visible keyboard ring", async ({
		page,
	}) => {
		await page.goto(LAB, { waitUntil: "networkidle" });
		for (const probe of [
			{ name: /^Explain .* link$/, term: "a.mo-link", matchesTerm: true },
			{ name: "Explain open", term: "a.mo-status", matchesTerm: false },
		] as const) {
			const trigger = page.getByRole("button", { name: probe.name }).first();
			await expect(trigger).toBeVisible();
			const contrastCarrier = await trigger.evaluate(
				(element, { termSelector, matchesTerm }) => {
					const term = element.previousElementSibling;
					if (!(term instanceof HTMLElement) || !term.matches(termSelector)) return null;
					const markerStyle = getComputedStyle(element);
					const canvas = document.createElement("canvas");
					canvas.width = canvas.height = 1;
					const context = canvas.getContext("2d", {
						willReadFrequently: true,
					}) as CanvasRenderingContext2D;
					const toRgb = (color: string): Rgb => {
						context.clearRect(0, 0, 1, 1);
						context.fillStyle = "#000";
						context.fillStyle = color;
						context.fillRect(0, 0, 1, 1);
						const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
						return [red, green, blue];
					};
					const backgroundOf = (start: Element): string => {
						let current: Element | null = start;
						while (current) {
							const color = getComputedStyle(current).backgroundColor;
							if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
							current = current.parentElement;
						}
						return "rgb(255, 255, 255)";
					};
					return {
						marker: markerStyle.color,
						term: getComputedStyle(term).color,
						markerRgb: toRgb(markerStyle.color),
						backgroundRgb: toRgb(backgroundOf(element)),
						opacity: markerStyle.opacity,
						matchesTerm,
					};
				},
				{ termSelector: probe.term, matchesTerm: probe.matchesTerm },
			);
			expect(contrastCarrier).not.toBeNull();
			if (contrastCarrier?.matchesTerm) {
				expect(contrastCarrier.marker).toBe(contrastCarrier.term);
			}
			if (contrastCarrier) {
				expect(
					contrastRatio(contrastCarrier.markerRgb, contrastCarrier.backgroundRgb),
					`${probe.term} Gloss marker must clear WCAG AA`,
				).toBeGreaterThanOrEqual(AA_NORMAL);
			}
			expect(contrastCarrier?.opacity).toBe("1");

			await trigger.focus();
			const ring = await trigger.evaluate((element) => {
				const style = getComputedStyle(element);
				return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
			});
			expect(ring, "focused Gloss marker has no visible focus indicator").toBe(true);
		}
	});
});

test.describe("layout ownership — parent primitives own geometry (KRA-800)", () => {
	test.use({ viewport: { width: 1440, height: 1000 } });

	test("definition-grid Status, Badge, and Button stay intrinsic inside flexible tracks", async ({
		page,
	}) => {
		await page.goto(LAB, { waitUntil: "networkidle" });
		const grid = page.locator('.mo-grid[data-role="field-group"][data-columns]').filter({
			hasText: "Status chip probe",
		});
		await expect(grid).toHaveCount(1);

		for (const selector of [".mo-status", ".mo-badge", ".mo-action"]) {
			const chip = grid.locator(selector);
			const cell = chip.locator("xpath=parent::*");
			await expect(cell).toHaveClass(/mo-grid__item/);
			const [chipBox, cellBox] = await Promise.all([chip.boundingBox(), cell.boundingBox()]);
			if (chipBox === null || cellBox === null) throw new Error(`${selector} geometry missing`);
			expect(chipBox.width, `${selector} must not fill its flexible track`).toBeLessThan(
				cellBox.width - GEOMETRY_TOLERANCE_PX,
			);
		}
	});

	test("a tiled SignalCard keeps its auto Stack vertical at desktop page width", async ({
		page,
	}) => {
		await page.goto(LAB, { waitUntil: "networkidle" });
		const grid = page.locator('.mo-grid[data-role="list"]').filter({ hasText: "Layout card A" });
		const cell = grid.locator(":scope > .mo-grid__item").first();
		const stack = cell.locator(":scope > .mo-stack");
		await expect(stack).toContainText("Layout card A");
		const geometry = await cell.evaluate((element) => ({
			width: element.getBoundingClientRect().width,
			containerType: getComputedStyle(element).containerType,
			stackDirection: getComputedStyle(element.firstElementChild as Element).flexDirection,
		}));
		expect(geometry.width, "fixture must stay below the 32rem auto-flip threshold").toBeLessThan(
			512,
		);
		expect(geometry.containerType).toBe("inline-size");
		expect(geometry.stackDirection).toBe("column");
	});

	test("a long Cluster min-content token cannot force its toolbar past the card", async ({
		page,
	}) => {
		await page.goto(LAB, { waitUntil: "networkidle" });
		const token = page.getByText(/KRA800_CLUSTER_PRESSURE_/);
		const cluster = token.locator(
			"xpath=ancestor::*[contains(concat(' ', @class, ' '), ' mo-cluster ')][1]",
		);
		const stack = cluster.locator(
			"xpath=ancestor::*[contains(concat(' ', @class, ' '), ' mo-stack ')][1]",
		);
		const [clusterBox, stackBox] = await Promise.all([cluster.boundingBox(), stack.boundingBox()]);
		if (clusterBox === null || stackBox === null) throw new Error("cluster geometry missing");
		expect(clusterBox.x, "cluster left edge stays inside its Stack").toBeGreaterThanOrEqual(
			stackBox.x - GEOMETRY_TOLERANCE_PX,
		);
		expect(
			clusterBox.x + clusterBox.width,
			"cluster right edge stays inside its Stack",
		).toBeLessThanOrEqual(stackBox.x + stackBox.width + GEOMETRY_TOLERANCE_PX);
	});
});

/**
 * KRA-796 Defect 3 (the "plus" checks) — the composed playground under adverse
 * conditions the contrast matrix alone can't see: reflow at a narrow width, a
 * 200%-zoom-equivalent viewport, keyboard focus visibility, forced-colors, and
 * reduced-motion. Run against the live `/substrate` playground (one authored tree,
 * every native control, a real `mo-link`).
 */

import { expect, type Locator, test } from "@playwright/test";

const ROUTE = "/substrate";
// A deterministic proof surface with real, un-disclosed Morphe links + ink on all
// three surface tiers (the app's other routes gate their links behind disclosures).
const LAB = "/contrast-lab";
const GEOMETRY_TOLERANCE_PX = 0.5;
const AA_NORMAL = 4.5;
const DIALECTS = [
	"icelandic-archive",
	"clinical",
	"reykjavik-registry",
	"timaeus",
	"gallery",
	"night",
	"ledger",
	"estate",
	"foundry",
] as const;
const NON_GOLD_COMPOUNDS = [
	"SignalCard",
	"EntityHeader",
	"ProvenanceFooter",
	"StatBand",
	"Breakdown",
	"TrailEntry",
	"KeyValuePanel",
	"ContentSection",
	"SignalBand",
	"DefinitionRow",
	"ProgressRow",
	"Trail",
	"OperationalPane",
	"RecordCard",
	"DiagnosticGroup",
	"EmptyState",
] as const;

async function setRange(control: Locator, value: number): Promise<void> {
	await control.evaluate((element, next) => {
		if (!(element instanceof HTMLInputElement)) throw new Error("range control is not an input");
		element.value = String(next);
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
	}, value);
}

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

test.describe("ADR-0022 — ActionSummary gold-standard circuit", () => {
	test("the identical benchmark fixture renders through every shipped dialect", async ({
		page,
	}) => {
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		await expect(page.getByRole("button", { name: /Gold Standard/ })).toHaveAttribute(
			"aria-current",
			"page",
		);

		for (const dialect of DIALECTS) {
			await page.locator("#dialect-select").selectOption(dialect);
			await expect(page.locator(".workbench__preview .mo-root").first()).toHaveAttribute(
				"data-mo-dialect",
				dialect,
			);
			await expect(
				page.getByRole("heading", { name: "Close the governed action circuit" }),
			).toBeVisible();
			await expect(page.getByText("Gold circuit connected")).toBeVisible();
			await expect(page.getByRole("button", { name: "Advance evidence" })).toBeVisible();
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow, `${dialect} introduced horizontal overflow`).toBeLessThanOrEqual(1);
		}
	});

	test("store, actions, Vary, and both targeted Within dimensions stay host-bound", async ({
		page,
	}) => {
		await page.goto(ROUTE, { waitUntil: "networkidle" });

		const evidence = page.getByRole("textbox", { name: /Evidence note/ });
		await expect(evidence).toHaveValue("Verify the complete evidence chain");
		await evidence.fill("Browser-verified evidence");
		await expect(evidence).toHaveValue("Browser-verified evidence");
		await page.getByRole("combobox", { name: "Review posture" }).selectOption("ratify");
		await expect(page.getByRole("combobox", { name: "Review posture" })).toHaveValue("ratify");
		const reviewed = page.getByRole("switch", { name: "Evidence reviewed" });
		await reviewed.click();
		await expect(reviewed).toHaveAttribute("aria-checked", "true");
		const confidence = page.getByRole("slider", { name: "Confidence" });
		await setRange(confidence, 91);
		await expect(confidence).toHaveValue("91");

		await setRange(page.locator("#gold-mode-choice"), 2);
		await expect(page.getByRole("heading", { name: "Decision receipt" })).toBeVisible();
		await page.getByRole("button", { name: "Advance evidence" }).click();
		await expect(page.getByRole("heading", { name: "Compact evidence" })).toBeVisible();
		await page.getByRole("button", { name: "Record attestation" }).click();
		await expect(page.locator(".workbench__proof")).toContainText("gold.attest");

		const detail = page.locator("details").filter({ hasText: "Inspect the complete gold circuit" });
		await expect(detail).toHaveAttribute("open", "");
		await setRange(page.locator("#gold-detail-choice"), 1);
		await expect(detail).not.toHaveAttribute("open", "");
		await setRange(page.locator("#gold-detail-choice"), 0);
		await expect(detail).toHaveAttribute("open", "");

		const densityBoundary = page.locator(".mo-within-context").last();
		const regularStyle = await densityBoundary.getAttribute("style");
		await setRange(page.locator("#gold-density-choice"), 2);
		await expect.poll(async () => densityBoundary.getAttribute("style")).not.toBe(regularStyle);
	});

	test("CMS preview revalidates dialect, honors mobile viewport, and owns temporary sockets", async ({
		page,
	}) => {
		await page.goto("/preview/capability-page.demo/rev-001?dialect=night&viewport=mobile", {
			waitUntil: "networkidle",
		});
		const host = page.locator(".preview-host");
		await expect(host).toHaveClass(/preview-host--mobile/);
		expect((await host.boundingBox())?.width).toBeLessThanOrEqual(390);
		await expect(page.locator(".preview-host__canvas .mo-root")).toHaveAttribute(
			"data-mo-dialect",
			"night",
		);
		await page.getByRole("combobox", { name: "Choice preview.mode" }).selectOption("1");
		await expect(page.getByText("Host-selected branch")).toBeVisible();
		await page.getByRole("button", { name: "Record preview action" }).click();
		await expect(page.getByText("Preview action recorded: preview_record")).toBeVisible();

		const response = await page.goto("/preview/capability-page.demo/rev-001?dialect=invented", {
			waitUntil: "domcontentloaded",
		});
		expect(response?.status()).toBe(400);
	});
});

test.describe("dialect boundary proof", () => {
	test("every global dialect leaves the pinned night root intact", async ({ page }) => {
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: /Dialect Lab/ }).click();
		await expect(page.getByRole("button", { name: /Dialect Lab/ })).toHaveAttribute(
			"aria-current",
			"page",
		);

		const dialectSelect = page.locator("#dialect-select");
		const mainRoot = page.locator(".workbench__preview > .mo-root");
		const pinnedRoot = page.locator(".workbench__preview .pinned .mo-root");
		const boundaryHeading = page.getByRole("heading", { name: "Pinned dialect boundary" });

		await expect(boundaryHeading).toBeVisible();
		for (const dialect of DIALECTS) {
			await dialectSelect.selectOption(dialect);
			await expect(dialectSelect).toHaveValue(dialect);
			await expect(mainRoot).toHaveAttribute("data-mo-dialect", dialect);
			await expect(pinnedRoot).toHaveAttribute("data-mo-dialect", "night");
			await expect(boundaryHeading).toBeVisible();
		}
	});
});

test.describe("ADR-0023 — promoted compound mint", () => {
	test.describe.configure({ mode: "serial" });

	test("the complete non-gold ledger survives every shipped dialect", async ({ page }) => {
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: /Compound Mint/ }).click();
		await expect(page.getByRole("button", { name: /Compound Mint/ })).toHaveAttribute(
			"aria-current",
			"page",
		);

		for (const name of NON_GOLD_COMPOUNDS) {
			await expect(
				page.getByRole("heading", { name: `${name} · benchmark`, exact: true }),
			).toBeVisible();
		}

		const dialectSelect = page.locator("#dialect-select");
		const previewRoot = page.locator(".workbench__preview > .mo-root");
		for (const dialect of DIALECTS) {
			await dialectSelect.selectOption(dialect);
			await expect(dialectSelect).toHaveValue(dialect);
			await expect
				.poll(() => previewRoot.getAttribute("data-mo-dialect"), {
					message: `mint did not settle on ${dialect}`,
					timeout: 20_000,
				})
				.toBe(dialect);
			await expect(
				page.getByText("Every non-gold catalog entry has a complete fixture"),
			).toBeVisible();
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow, `${dialect} introduced mint overflow`).toBeLessThanOrEqual(1);
		}
	});

	test("at 390px Clinical the complete mint and Gold host controls stay reachable", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(ROUTE, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: /Compound Mint/ }).click();
		const dialectSelect = page.locator("#dialect-select");
		await dialectSelect.selectOption("clinical");
		await expect(dialectSelect).toHaveValue("clinical");
		await expect(page.locator(".workbench__preview > .mo-root")).toHaveAttribute(
			"data-mo-dialect",
			"clinical",
		);

		for (const name of NON_GOLD_COMPOUNDS) {
			await expect(
				page.getByRole("heading", { name: `${name} · benchmark`, exact: true }),
			).toBeVisible();
		}

		const action = page.getByRole("button", { name: "Record section evidence" });
		await action.click();
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Tab");
		await expect(action).toBeFocused();
		const ring = await action.evaluate((element) => {
			const style = getComputedStyle(element);
			return (
				(style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) ||
				style.boxShadow !== "none"
			);
		});
		expect(ring, "mint action has no visible focus indicator").toBe(true);
		await page.keyboard.press("Enter");
		await expect(page.locator(".workbench__proof")).toContainText("mint.record");

		const mintOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(mintOverflow, "Clinical compound mint overflows at 390px").toBeLessThanOrEqual(1);

		await page.getByRole("button", { name: /Gold Standard/ }).click();
		await expect(page.getByRole("button", { name: /Gold Standard/ })).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(page.locator(".workbench__preview > .mo-root")).toHaveAttribute(
			"data-mo-dialect",
			"clinical",
		);

		const mode = page.locator("#gold-mode-choice");
		await mode.focus();
		await page.keyboard.press("End");
		await expect(mode).toHaveValue("2");
		await expect(page.getByRole("heading", { name: "Decision receipt" })).toBeVisible();

		const detail = page.locator("details").filter({ hasText: "Inspect the complete gold circuit" });
		await expect(detail).toHaveAttribute("open", "");
		const detailChoice = page.locator("#gold-detail-choice");
		await detailChoice.focus();
		await page.keyboard.press("End");
		await expect(detailChoice).toHaveValue("1");
		await expect(detail).not.toHaveAttribute("open", "");

		const densityBoundary = page.locator(".mo-within-context").last();
		const regularStyle = await densityBoundary.getAttribute("style");
		const density = page.locator("#gold-density-choice");
		await density.focus();
		await page.keyboard.press("End");
		await expect(density).toHaveValue("2");
		await expect.poll(async () => densityBoundary.getAttribute("style")).not.toBe(regularStyle);

		const goldOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(goldOverflow, "Clinical Gold Standard overflows at 390px").toBeLessThanOrEqual(1);
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

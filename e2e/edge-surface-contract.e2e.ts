import { expect, type Locator, type Page, test } from "@playwright/test";

const SURFACE_PATH = "/s/taxis/roster";
const HIDDEN_FIELD = "dispatchSecret";
const HIDDEN_SENTINEL = "MORPHE-HIDDEN-TAXIS-7CFE42";
const GEOMETRY_TOLERANCE_PX = 0.5;
const TOUCH_TARGET_FLOOR_PX = 44;
const SHIPPED_DIALECTS = [
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
const VIEWPORTS = [
	{ name: "wide", width: 1440, height: 1000 },
	{ name: "narrow", width: 760, height: 1000 },
] as const;

async function openSurface(page: Page, dialect = "gallery"): Promise<void> {
	const response = await page.goto(`${SURFACE_PATH}?dialect=${dialect}`);
	expect(response, "the real stripped-viewer route must answer").not.toBeNull();
	expect(
		response?.ok() || response?.status() === 304,
		"the real stripped-viewer route must answer successfully (including a valid cache hit)",
	).toBe(true);
	await expect(page.locator(".viewer-surface .mo-root")).toHaveAttribute(
		"data-mo-dialect",
		dialect,
	);
}

async function semanticSkeleton(surface: Locator): Promise<unknown> {
	return surface.evaluate((root) => {
		function shape(node: Node): unknown {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent?.replace(/\s+/g, " ").trim();
				return text ? text : null;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return null;

			const element = node as Element;
			const attributes = ["aria-label", "aria-valuenow", "href", "role"]
				.map((name) => [name, element.getAttribute(name)] as const)
				.filter((entry): entry is readonly [string, string] => entry[1] !== null);
			return {
				tag: element.tagName.toLowerCase(),
				classes: [...element.classList].sort(),
				attributes,
				children: [...element.childNodes].map(shape).filter((child) => child !== null),
			};
		}

		return shape(root);
	});
}

async function assertSemanticSurface(page: Page): Promise<void> {
	const taskHeading = page.getByRole("heading", { level: 1, name: "Weekly roster" });
	await expect(taskHeading).toBeVisible();
	await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
	await expect(
		page.locator('.mo-text[data-as="caption"]').filter({ hasText: /Vestfirðir[\s\S]*roster/ }),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Scheduled payroll" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Dispatch mode" })).toBeVisible();
	await expect(page.getByText("weather hold", { exact: true })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Newest event" })).toBeVisible();
	await expect(page.getByText("2026-07-17 11:59 UTC", { exact: true })).toBeVisible();

	const active = page.locator(".mo-status").filter({ hasText: "active" });
	const review = page.locator(".mo-status").filter({ hasText: "review" });
	await expect(active).toHaveAttribute("role", "status");
	await expect(active).toHaveAttribute("data-tone", "success");
	await expect(review).toHaveAttribute("role", "status");
	await expect(review).toHaveAttribute("data-tone", "caution");

	await expect(page.getByText("TAXIS_ROW_REVIEW", { exact: true })).toBeVisible();
	// The cell diagnostic is lifted into the row lane (KRA-796 Defect 2) with the
	// field label preserved in its visible copy, so the code now reads label-first.
	await expect(
		page.getByText("Allocation: TAXIS_ALLOCATION_SOURCE", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("The second worker needs roster review.", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("Allocation reflects the signed planning window.", { exact: true }),
	).toBeVisible();

	await expect(page.getByRole("progressbar", { name: "Window coverage" })).toHaveAttribute(
		"aria-valuenow",
		"75",
	);
	const allocations = page.getByRole("progressbar", { name: "Allocation" });
	await expect(allocations).toHaveCount(2);
	expect(
		(await allocations.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("aria-valuenow")).sort(),
		)) as Array<string | null>,
	).toEqual(["45", "80"]);

	const numberDigits = (await page.locator(".mo-number").allTextContents()).map((value) =>
		value.replace(/\D/g, ""),
	);
	expect(numberDigits).toContain("2450000");
	expect(numberDigits).toContain("7950");

	await expect(page.getByRole("link", { name: "Open Arna" })).toHaveAttribute(
		"href",
		"/s/taxis/worker-arna",
	);
	await expect(page.getByRole("link", { name: "Open Baldur" })).toHaveAttribute(
		"href",
		"/s/taxis/worker-baldur",
	);

	const documentHtml = await page.content();
	expect(documentHtml).not.toContain(HIDDEN_FIELD);
	expect(documentHtml).not.toContain(HIDDEN_SENTINEL);
}

async function assertTableContract(page: Page): Promise<void> {
	const table = page.locator(".mo-grid[data-columns][data-ruled]");
	await expect(table).toHaveCount(1);
	const rows = table.locator(":scope > .mo-grid");
	await expect(rows).toHaveCount(3);

	for (let index = 0; index < (await rows.count()); index += 1) {
		const template = await rows
			.nth(index)
			.evaluate((element) => getComputedStyle(element).gridTemplateColumns);
		expect(template.toLowerCase(), `row ${index} must compute as a subgrid`).toContain("subgrid");
	}

	const leftEdges = await rows.evaluateAll((elements) =>
		elements.map((row) => [...row.children].map((cell) => cell.getBoundingClientRect().left)),
	);
	for (const [rowIndex, row] of leftEdges.entries()) {
		expect(row, `row ${rowIndex} must carry all six table cells`).toHaveLength(6);
	}
	for (let column = 0; column < 6; column += 1) {
		const positions = leftEdges.map((row) => row[column] as number);
		const delta = Math.max(...positions) - Math.min(...positions);
		expect(delta, `column ${column} left edges must align`).toBeLessThanOrEqual(
			GEOMETRY_TOLERANCE_PX,
		);
	}

	const rowAlert = table.locator(":scope > .mo-alert").filter({ hasText: "TAXIS_ROW_REVIEW" });
	await expect(rowAlert).toHaveCount(1);
	const relationship = await rowAlert.evaluate((alert) => ({
		parentIsTable: alert.parentElement?.matches(".mo-grid[data-columns]") ?? false,
		previousIsRow: alert.previousElementSibling?.matches(".mo-grid") ?? false,
		wrapsRow: alert.querySelector(".mo-grid") !== null,
	}));
	expect(relationship).toEqual({ parentIsTable: true, previousIsRow: true, wrapsRow: false });

	// Cell diagnostics are LIFTED into the row lane (KRA-796 Defect 2): the alert is
	// no longer nested inside the cell's row grid (where a 12rem-min alert overpainted
	// neighbouring cells), but a full-width sibling of the table, in the lane after the
	// row it concerns — exactly like the row-level alert. Its visible copy keeps the
	// field label ("Allocation:") so the lifted diagnostic still names its subject.
	const cellAlert = table.locator(":scope > .mo-alert").filter({
		hasText: "TAXIS_ALLOCATION_SOURCE",
	});
	await expect(cellAlert).toHaveCount(1);
	await expect(cellAlert).toContainText("Allocation:");
	const tableBoxForCell = await table.boundingBox();
	if (tableBoxForCell === null) throw new Error("table must be visible for the cell-lane check");
	expect(
		await cellAlert.evaluate((alert) => ({
			parentIsTable: alert.parentElement?.matches(".mo-grid[data-columns]") ?? false,
			wrapsRow: alert.querySelector(".mo-grid") !== null,
		})),
	).toEqual({ parentIsTable: true, wrapsRow: false });
	// Lifted into the lane, it spans the full table width (no 12rem overpaint).
	const cellAlertBox = await cellAlert.boundingBox();
	if (cellAlertBox === null) throw new Error("cell alert must be visible");
	expect(Math.abs(cellAlertBox.x - tableBoxForCell.x), "cell alert left edge").toBeLessThanOrEqual(
		GEOMETRY_TOLERANCE_PX,
	);
	expect(
		Math.abs(cellAlertBox.width - tableBoxForCell.width),
		"cell alert spans full row",
	).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);

	const nullableCell = rows.nth(2).locator(":scope > *").nth(4);
	expect((await nullableCell.textContent())?.trim()).toBe("");

	const tableBox = await table.boundingBox();
	const alertBox = await rowAlert.boundingBox();
	if (tableBox === null || alertBox === null)
		throw new Error("table contract boxes must be visible");
	expect(Math.abs(alertBox.x - tableBox.x), "row alert left edge").toBeLessThanOrEqual(
		GEOMETRY_TOLERANCE_PX,
	);
	expect(
		Math.abs(alertBox.x + alertBox.width - (tableBox.x + tableBox.width)),
		"row alert right edge",
	).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
}

test.describe("dialect-independent source compilation", () => {
	test.use({ viewport: { width: 1440, height: 1000 } });

	test("keeps one semantic tree across gallery, ledger, and every shipped dialect", async ({
		page,
	}) => {
		const blockedModules: string[] = [];
		page.on("response", (response) => {
			if (response.status() === 403) blockedModules.push(response.url());
		});
		await openSurface(page, "gallery");
		const renderedSurface = page.locator(".viewer-surface");
		const gallery = await semanticSkeleton(renderedSurface);
		const compilationTreeSha256 = await renderedSurface.getAttribute(
			"data-compilation-tree-sha256",
		);
		expect(compilationTreeSha256).toMatch(/^sha256:[0-9a-f]{64}$/);

		await page.waitForLoadState("networkidle");
		await page.getByText("Substrate inspection", { exact: true }).click();
		await page.getByLabel("Dialect").selectOption("ledger");
		await expect(page).toHaveURL(new RegExp(`${SURFACE_PATH}\\?dialect=ledger$`));
		await expect(page.locator(".viewer-surface .mo-root")).toHaveAttribute(
			"data-mo-dialect",
			"ledger",
		);
		await expect(renderedSurface).toHaveAttribute(
			"data-compilation-tree-sha256",
			compilationTreeSha256 as string,
		);
		expect(await semanticSkeleton(renderedSurface)).toEqual(gallery);
		expect(blockedModules, "viewer hydration must not hit Vite's fs deny list").toEqual([]);

		for (const dialect of SHIPPED_DIALECTS) {
			await openSurface(page, dialect);
			await expect(page.getByRole("heading", { level: 1, name: "Weekly roster" })).toBeVisible();
			await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
			await expect(
				page.locator('.mo-text[data-as="caption"]').filter({
					hasText: /Vestfirðir[\s\S]*roster/,
				}),
			).toBeVisible();
		}
	});
});

test.describe("operator-first viewer chrome", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("navigates a seeded pane across dates and clears back to the current frontier", async ({
		page,
	}) => {
		await openSurface(page);
		await page.waitForLoadState("networkidle");
		const asOf = page.getByLabel("As of");
		await expect(asOf).toBeVisible();

		await asOf.fill("2026-07-15");
		await asOf.dispatchEvent("change");
		await expect(page).toHaveURL(new RegExp(`${SURFACE_PATH}\\?dialect=gallery&as_of=2026-07-15$`));
		await expect(page.getByLabel("As of")).toHaveValue("2026-07-15");

		await page.getByLabel("As of").fill("2026-07-08");
		await page.getByLabel("As of").dispatchEvent("change");
		await expect(page).toHaveURL(new RegExp(`${SURFACE_PATH}\\?dialect=gallery&as_of=2026-07-08$`));
		await expect(page.getByLabel("As of")).toHaveValue("2026-07-08");

		await page.getByLabel("As of").fill("");
		await page.getByLabel("As of").dispatchEvent("change");
		await expect(page).toHaveURL(new RegExp(`${SURFACE_PATH}\\?dialect=gallery$`));
		await expect(page.getByLabel("As of")).toHaveValue("");
	});

	test("preserves breadcrumbs, collapses inspection, and keeps 44px native targets", async ({
		page,
	}) => {
		await openSurface(page);

		const chrome = page.locator("header.chrome");
		const breadcrumb = chrome.getByRole("navigation", { name: "Breadcrumb" });
		const inspection = chrome.locator("details.chrome__inspection");
		const inspectionSummary = inspection.locator("summary");
		await expect(breadcrumb).toBeVisible();
		await expect(breadcrumb.locator('[aria-current="page"]')).toHaveCount(1);
		await expect(breadcrumb.getByRole("link", { name: "Home" })).toBeVisible();
		await expect(chrome.getByLabel("Time")).toBeVisible();
		await expect(inspection).not.toHaveAttribute("open", "");
		await expect(chrome.getByLabel("Dialect")).toBeHidden();

		const chromeOverflow = await chrome.evaluate(
			(element) => element.scrollWidth - element.clientWidth,
		);
		expect(chromeOverflow, "390px chrome must not overflow horizontally").toBeLessThanOrEqual(1);

		await inspectionSummary.focus();
		await page.keyboard.press("Enter");
		await expect(inspection).toHaveAttribute("open", "");
		await expect(chrome.getByLabel("Dialect")).toBeVisible();
		expect(
			await chrome.evaluate((element) => element.scrollWidth - element.clientWidth),
			"open inspection mode must still fit the 390px chrome",
		).toBeLessThanOrEqual(1);

		const visibleTargets = await chrome
			.locator("a, summary, select, input")
			.evaluateAll((targets) =>
				targets
					.map((target) => {
						const box = target.getBoundingClientRect();
						return { label: target.textContent?.trim() ?? target.tagName, ...box.toJSON() };
					})
					.filter((box) => box.width > 0 && box.height > 0),
			);
		for (const target of visibleTargets) {
			expect(target.width, `${target.label} target width`).toBeGreaterThanOrEqual(
				TOUCH_TARGET_FLOOR_PX,
			);
			expect(target.height, `${target.label} target height`).toBeGreaterThanOrEqual(
				TOUCH_TARGET_FLOOR_PX,
			);
		}
	});
});

test.describe("operator-first composed home", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("prioritizes live attention, keeps testimony reachable, and remains usable at 390px", async ({
		page,
	}) => {
		const response = await page.goto("/", { waitUntil: "networkidle" });
		expect(response?.ok(), "the configured composed home must answer").toBe(true);

		const home = page.locator("main.viewer-home");
		await expect(home.locator(".mo-root")).toHaveAttribute("data-mo-dialect", "gallery");
		await expect(
			home.getByRole("heading", { level: 1, name: "Edge surface contract" }),
		).toBeVisible();
		await expect(home.getByRole("heading", { level: 2, name: "Source freshness" })).toBeVisible();
		await expect(home.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
		await expect(home.getByRole("heading", { level: 2, name: "Domains" })).toBeVisible();

		const visibleHeadings = await home.getByRole("heading").evaluateAll((headings) =>
			headings
				.filter((heading) => {
					const style = getComputedStyle(heading);
					return style.display !== "none" && style.visibility !== "hidden";
				})
				.map((heading) => heading.textContent?.trim()),
		);
		expect(visibleHeadings.slice(0, 4)).toEqual([
			"Edge surface contract",
			"Source freshness",
			"Needs attention",
			"Domains",
		]);

		await expect(home.getByText("Weekly roster reports attention", { exact: true })).toBeVisible();
		const attentionSummary = home
			.locator(".mo-alert")
			.filter({ hasText: "Weekly roster reports attention" })
			.first();
		await expect(attentionSummary).toContainText("The second worker needs roster review.");
		await expect(attentionSummary).toContainText("Confirm the allocation before dispatch.");
		await expect(attentionSummary).not.toContainText("TAXIS_ROW_REVIEW");
		const testimony = home.locator("details").filter({ hasText: "Review Weekly roster" });
		await expect(testimony).not.toHaveAttribute("open", "");
		await expect(
			home.getByRole("link", { name: "Open Taxis fixture", exact: true }),
		).toHaveAttribute("href", "/s/taxis/roster");
		await expect(home.locator('.mo-frame[data-surface="raised"]')).toHaveCount(0);

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow, "390px home must not overflow horizontally").toBeLessThanOrEqual(1);

		const asOf = page.getByLabel("As of");
		await expect(asOf).toBeVisible();
		const asOfBox = await asOf.boundingBox();
		if (asOfBox === null) throw new Error("As-of control must have a visible target");
		expect(asOfBox.width, "As-of target width").toBeGreaterThanOrEqual(TOUCH_TARGET_FLOOR_PX);
		expect(asOfBox.height, "As-of target height").toBeGreaterThanOrEqual(TOUCH_TARGET_FLOOR_PX);

		await page.keyboard.press("Tab");
		await expect(asOf).toBeFocused();
		expect(
			await asOf.evaluate((control) => {
				const style = getComputedStyle(control);
				return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
			}),
			"keyboard focus on As-of must remain visible",
		).toBe(true);

		await testimony.locator("summary").click();
		await expect(testimony).toHaveAttribute("open", "");
		await expect(
			testimony.getByRole("heading", { level: 2, name: "Weekly roster", exact: true }),
		).toBeVisible();
		await expect(home.locator("h1")).toHaveCount(1);
		await expect(testimony).toContainText("TAXIS_ROW_REVIEW");

		const contrastRatios = await home
			.locator('h1, h2, a.mo-link, .mo-alert[data-tone="caution"] .mo-alert__title')
			.evaluateAll((elements) => {
				const canvas = document.createElement("canvas");
				canvas.width = canvas.height = 1;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (context === null) throw new Error("No canvas context for contrast probe");
				const rgb = (value: string): [number, number, number] => {
					context.clearRect(0, 0, 1, 1);
					context.fillStyle = "#000";
					context.fillStyle = value;
					context.fillRect(0, 0, 1, 1);
					const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
					return [red ?? 0, green ?? 0, blue ?? 0];
				};
				const background = (element: Element): string => {
					let current: Element | null = element;
					while (current !== null) {
						const value = getComputedStyle(current).backgroundColor;
						if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") return value;
						current = current.parentElement;
					}
					return "rgb(255, 255, 255)";
				};
				const luminance = ([r, g, b]: [number, number, number]): number => {
					const linear = (channel: number): number => {
						const srgb = channel / 255;
						return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
					};
					return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
				};
				return elements
					.filter((element) => element.getClientRects().length > 0)
					.map((element) => {
						const foregroundColor = rgb(getComputedStyle(element).color);
						const backgroundColor = rgb(background(element));
						const foreground = luminance(foregroundColor);
						const ground = luminance(backgroundColor);
						return {
							label: element.textContent?.trim() ?? element.tagName,
							ratio: (Math.max(foreground, ground) + 0.05) / (Math.min(foreground, ground) + 0.05),
							foregroundColor,
							backgroundColor,
						};
					});
			});
		expect(contrastRatios.length, "home contrast probes must render").toBeGreaterThan(0);
		const contrastFailures = contrastRatios.filter((probe) => probe.ratio < 4.5);
		expect(contrastFailures, "visible home copy must clear WCAG AA").toEqual([]);
	});
});

for (const viewport of VIEWPORTS) {
	test.describe(`${viewport.name} compiler-renderer geometry`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		test("renders signed testimony with aligned subgrid rows and sibling diagnostics", async ({
			page,
		}) => {
			await openSurface(page);
			await assertSemanticSurface(page);
			await assertTableContract(page);
		});
	});
}

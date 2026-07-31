import { expect, type Locator, type Page, test } from "@playwright/test";

const SURFACE_PATH = "/s/taxis/roster";
const HIDDEN_FIELD = "dispatchSecret";
const HIDDEN_SENTINEL = "MORPHE-HIDDEN-TAXIS-7CFE42";
const GEOMETRY_TOLERANCE_PX = 1.5;
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
	{ name: "narrow", width: 390, height: 844 },
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

	await expect(page.getByText("Taxis row review", { exact: true })).toBeVisible();
	// The producer named where the offending entry lives (Diagnostic.href); the
	// trust gate rewrote it against the declared surfaces, so the warning IS the
	// drill-through to the entry it indicts.
	await expect(page.locator("a.mo-alert").filter({ hasText: "Taxis row review" })).toHaveAttribute(
		"href",
		"/s/taxis/worker-baldur",
	);
	// The cell diagnostic is lifted into the row lane (KRA-796 Defect 2) with the
	// field label preserved in its visible copy, so the code now reads label-first.
	await expect(
		page.getByText("Allocation: Taxis allocation source", { exact: true }),
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

async function assertTableContract(page: Page, recordsExpected: boolean): Promise<void> {
	const wrapper = page.locator('.mo-table[data-responsive="records"]');
	await expect(wrapper).toHaveCount(1);
	const table = page.getByRole("table", { name: "Workers" });
	await expect(table).toBeVisible();
	await expect(table.getByRole("columnheader")).toHaveCount(recordsExpected ? 0 : 6);
	await expect(table.getByRole("rowheader")).toHaveCount(2);

	const rows = table.locator("tbody > tr:not(.mo-table__lane)");
	const lanes = table.locator("tbody > tr.mo-table__lane");
	await expect(rows).toHaveCount(2);
	await expect(lanes).toHaveCount(2);
	await expect(lanes.locator(":scope > td[colspan='6']")).toHaveCount(2);
	for (let index = 0; index < 2; index += 1) {
		await expect(rows.nth(index).locator(":scope > :is(th, td)")).toHaveCount(6);
	}

	const rowDisplays = await rows.evaluateAll((elements) =>
		elements.map((row) => ({
			row: getComputedStyle(row).display,
			cells: [...row.children].map((cell) => getComputedStyle(cell).display),
		})),
	);
	if (recordsExpected) {
		for (const [index, display] of rowDisplays.entries()) {
			expect(display.row, `record ${index} must stack`).toBe("block");
			expect(display.cells, `record ${index} cells must stack`).toEqual(Array(6).fill("block"));
		}
		const headers = await rows
			.locator(":scope > :is(th, td)")
			.evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-header")));
		expect(headers.every((header) => typeof header === "string" && header.length > 0)).toBe(true);
	} else {
		for (const [index, display] of rowDisplays.entries()) {
			expect(display.row, `row ${index} keeps native table geometry`).toBe("table-row");
			expect(
				display.cells.every((value) => value === "table-cell"),
				`row ${index} cells keep native table geometry`,
			).toBe(true);
		}

		const leftEdges = await rows.evaluateAll((elements) =>
			elements.map((row) => [...row.children].map((cell) => cell.getBoundingClientRect().left)),
		);
		for (let column = 0; column < 6; column += 1) {
			const positions = leftEdges.map((row) => row[column] as number);
			const delta = Math.max(...positions) - Math.min(...positions);
			expect(delta, `column ${column} left edges must align`).toBeLessThanOrEqual(
				GEOMETRY_TOLERANCE_PX,
			);
		}
	}

	const rowAlert = lanes.locator(".mo-alert").filter({ hasText: "Taxis row review" });
	await expect(rowAlert).toHaveCount(1);
	expect(
		await rowAlert.evaluate((alert) => {
			const lane = alert.closest("tr");
			return {
				inDiagnosticLane: lane?.classList.contains("mo-table__lane") ?? false,
				previousIsDataRow:
					lane?.previousElementSibling?.matches("tr:not(.mo-table__lane)") ?? false,
				wrapsDataRow: alert.querySelector("tr") !== null,
			};
		}),
	).toEqual({ inDiagnosticLane: true, previousIsDataRow: true, wrapsDataRow: false });

	// Cell diagnostics share that same row-owned lane. Their visible copy keeps
	// the field label, while the lane spans all six columns on wide and record
	// layouts alike.
	const cellAlert = lanes.locator(".mo-alert").filter({
		hasText: "Taxis allocation source",
	});
	await expect(cellAlert).toHaveCount(1);
	await expect(cellAlert).toContainText("Allocation:");
	await expect(cellAlert.locator("tr")).toHaveCount(0);

	const nullableCell = rows.nth(1).locator(":scope > :is(th, td)").nth(4);
	expect((await nullableCell.textContent())?.trim()).toBe("");

	const overflow = await wrapper.evaluate((element) => element.scrollWidth - element.clientWidth);
	expect(overflow, "declared records mode must not overflow").toBeLessThanOrEqual(1);

	if (!recordsExpected) {
		const wrapperBox = await wrapper.boundingBox();
		const rowAlertBox = await rowAlert.boundingBox();
		const cellAlertBox = await cellAlert.boundingBox();
		if (wrapperBox === null || rowAlertBox === null || cellAlertBox === null) {
			throw new Error("semantic table contract boxes must be visible");
		}
		for (const [label, alertBox] of [
			["row alert", rowAlertBox],
			["cell alert", cellAlertBox],
		] as const) {
			expect(Math.abs(alertBox.x - wrapperBox.x), `${label} left edge`).toBeLessThanOrEqual(
				GEOMETRY_TOLERANCE_PX,
			);
			expect(
				Math.abs(alertBox.x + alertBox.width - (wrapperBox.x + wrapperBox.width)),
				`${label} right edge`,
			).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
		}
	}
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
		await page.locator("details.chrome__inspection > summary").click();
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

	test("offers every visible sibling pane from a pane route, carrying as_of", async ({ page }) => {
		await openSurface(page);

		const paneNav = page.getByRole("navigation", { name: "Source panes" });
		await expect(paneNav).toBeVisible();
		// The current pane is present but inert; siblings are real links.
		await expect(paneNav.locator('[aria-current="page"]')).toHaveText("Weekly roster");
		await expect(paneNav.getByRole("link", { name: "Arna K." })).toHaveAttribute(
			"href",
			"/s/taxis/worker-arna",
		);
		await expect(paneNav.getByRole("link", { name: "Baldur R." })).toHaveAttribute(
			"href",
			"/s/taxis/worker-baldur",
		);

		// The one cross-pane operator state (as_of) rides sibling links; pane-local
		// filters and render-only params do not.
		const asOf = page.getByLabel("As of");
		await asOf.fill("2026-07-15");
		await asOf.dispatchEvent("change");
		await expect(paneNav.getByRole("link", { name: "Arna K." })).toHaveAttribute(
			"href",
			"/s/taxis/worker-arna?as_of=2026-07-15",
		);
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
			.locator("a, summary, select, input:not([type='checkbox']), label.chrome__explain")
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
		await expect(home.getByRole("heading", { level: 3, name: "Operational pulse" })).toBeVisible();
		await expect(home.getByRole("heading", { level: 2, name: "Needs attention" })).toBeVisible();
		// One region owns a source (KRA-819): the fixture's only panel is lifted
		// into the attention queue, so a Domains section restating it must NOT
		// render — the queue carries the status, context, and pane link.
		await expect(home.getByRole("heading", { level: 2, name: "Domains" })).toHaveCount(0);

		const visibleHeadings = await home.getByRole("heading").evaluateAll((headings) =>
			headings
				.filter((heading) => {
					const style = getComputedStyle(heading);
					return style.display !== "none" && style.visibility !== "hidden";
				})
				.map((heading) => heading.textContent?.trim()),
		);
		expect(visibleHeadings.slice(0, 3)).toEqual([
			"Edge surface contract",
			"Operational pulse",
			"Needs attention",
		]);

		await expect(
			home.getByRole("heading", { level: 3, name: "Weekly roster", exact: true }),
		).toBeVisible();
		await expect(home.getByText("Needs review", { exact: true })).toBeVisible();
		const attentionSummary = home.locator('.mo-frame[data-surface="raised"]').first();
		await expect(attentionSummary).toContainText("The second worker needs roster review.");
		await expect(attentionSummary).toContainText("Confirm the allocation before dispatch.");
		await expect(attentionSummary).not.toContainText("TAXIS_ROW_REVIEW");
		const testimony = home.locator("details").filter({ hasText: "Preview Weekly roster here" });
		await expect(testimony).not.toHaveAttribute("open", "");
		const primaryAction = home.getByRole("link", {
			name: "Open Taxis fixture details",
			exact: true,
		});
		await expect(primaryAction).toHaveAttribute("href", "/s/taxis/roster");
		const primaryActionBox = await primaryAction.boundingBox();
		if (primaryActionBox === null) throw new Error("Attention action must be visible");
		expect(primaryActionBox.width).toBeGreaterThanOrEqual(TOUCH_TARGET_FLOOR_PX);
		expect(primaryActionBox.height).toBeGreaterThanOrEqual(TOUCH_TARGET_FLOOR_PX);
		await expect(home.locator('.mo-frame[data-surface="raised"]')).toHaveCount(1);

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
		await expect(testimony).toContainText("Taxis row review");
		await expect(testimony).not.toContainText("TAXIS_ROW_REVIEW");

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

	test("keeps pre- and post-event dated homes clean while carrying the exact frontier", async ({
		page,
	}) => {
		// The fixture's newest signed event is 17 July. Exercise a frontier on
		// either side so this is not merely one hard-coded query-retention check.
		for (const perspective of [
			{ date: "2026-07-15", display: "July 15, 2026" },
			{ date: "2026-07-31", display: "July 31, 2026" },
		]) {
			const response = await page.goto(`/?as_of=${perspective.date}`, {
				waitUntil: "networkidle",
			});
			expect(response?.ok(), "the dated composed home must answer").toBe(true);

			const home = page.locator("main.viewer-home");
			await expect(home.getByText(`Reporting date · ${perspective.display}`)).toBeVisible();
			await expect(
				home.getByRole("link", { name: "Open Taxis fixture details", exact: true }),
			).toHaveAttribute("href", `/s/taxis/roster?as_of=${perspective.date}`);
			await expect(home).not.toContainText("Resolved ");
			await expect(home).not.toContainText("westfjords:2026-W29");
			await expect(home).not.toContainText(
				/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/i,
			);
		}
	});
});

for (const viewport of VIEWPORTS) {
	test.describe(`${viewport.name} compiler-renderer geometry`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		test("renders signed testimony as a semantic table with labelled records", async ({ page }) => {
			await openSurface(page);
			await assertSemanticSurface(page);
			await assertTableContract(page, viewport.width <= 640);
		});
	});
}

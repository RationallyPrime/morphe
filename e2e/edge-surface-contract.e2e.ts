import { expect, type Locator, type Page, test } from "@playwright/test";

const SURFACE_PATH = "/s/taxis/roster";
const HIDDEN_FIELD = "dispatchSecret";
const HIDDEN_SENTINEL = "MORPHE-HIDDEN-TAXIS-7CFE42";
const GEOMETRY_TOLERANCE_PX = 1;
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
	await expect(page.getByRole("heading", { level: 2, name: "_TaxisRoster" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 1, name: /Vestfirðir.*roster/ })).toBeVisible();
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
	await expect(page.getByText("TAXIS_ALLOCATION_SOURCE", { exact: true })).toBeVisible();
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

	const cellAlert = rows.nth(1).locator(".mo-alert").filter({
		hasText: "TAXIS_ALLOCATION_SOURCE",
	});
	await expect(cellAlert).toHaveCount(1);
	expect(
		await cellAlert.evaluate(
			(alert) => alert.parentElement?.matches(".mo-grid[data-columns]") ?? false,
		),
	).toBe(false);

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
			await expect(
				page.getByRole("heading", { level: 1, name: /Vestfirðir.*roster/ }),
			).toBeVisible();
		}
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

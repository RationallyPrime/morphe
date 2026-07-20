import { defineConfig, devices } from "@playwright/test";

/**
 * KRA-796 Defect 3 — the WCAG 2.2 AA contrast matrix + composed-surface a11y
 * gate. Separate from the edge-surface contract config: the contrast MATRIX
 * (`contrast-matrix.e2e.ts`) is server-free (page.setContent over the real token
 * CSS), and the composed A11Y checks (`contrast-a11y.e2e.ts`) drive the live
 * playground. Chromium + Firefox both resolve `color-mix()` natively, so the
 * measured colours are the real shipped pixels.
 */

const PLAYGROUND_PORT = 4402;
const PLAYGROUND_URL = `http://127.0.0.1:${PLAYGROUND_PORT}`;

export default defineConfig({
	testDir: "./e2e",
	testMatch: /contrast-(matrix|a11y)\.e2e\.ts/,
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? "github" : "list",
	timeout: 45_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: PLAYGROUND_URL,
		locale: "en-US",
		timezoneId: "Atlantic/Reykjavik",
		deviceScaleFactor: 1,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"], deviceScaleFactor: 1 } },
	],
	webServer: [
		{
			command: `bun run dev --host 127.0.0.1 --port ${PLAYGROUND_PORT}`,
			url: `${PLAYGROUND_URL}/substrate`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
	],
});

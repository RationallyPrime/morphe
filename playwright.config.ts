import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const STUB_PORT = 4401;
const VIEWER_PORT = 4176;
const VIEWER_URL = `http://127.0.0.1:${VIEWER_PORT}`;
const MAX_FIXTURE_AGE_SECONDS = 100 * 365 * 24 * 60 * 60;

interface ConformanceCase {
	readonly id: string;
	readonly expected: {
		readonly issuer: string;
		readonly key_id: string;
		readonly public_key_raw_hex: string;
		readonly surface_id: string;
	};
}

const manifest = JSON.parse(
	readFileSync(new URL("./fixtures/source-surface/conformance-v1.json", import.meta.url), "utf8"),
) as { readonly cases: readonly ConformanceCase[] };
const taxis = manifest.cases.find((candidate) => candidate.id === "taxis-roster");
if (taxis === undefined) throw new Error("source conformance manifest has no Taxis case");
const taxisPublicKey = Buffer.from(taxis.expected.public_key_raw_hex, "hex").toString("base64url");

const sources = JSON.stringify({
	taxis: {
		title: "Taxis fixture",
		kind: "kernel",
		base_url: `http://127.0.0.1:${STUB_PORT}`,
		dialect_hint: "gallery",
		home_panel: { pane: "roster", title: "Weekly roster" },
		source_trust: {
			issuer: taxis.expected.issuer,
			public_keys: {
				[taxis.expected.key_id]: taxisPublicKey,
			},
			max_age_seconds: MAX_FIXTURE_AGE_SECONDS,
		},
		surfaces: [
			{
				id: "roster",
				title: "Weekly roster",
				path: "/source/taxis-roster",
				representation: "source-v1",
				surface_id: taxis.expected.surface_id,
				dialect_hint: "gallery",
			},
			// Link-rewrite targets only (asserted as rewritten hrefs, never
			// navigated): declared source-v1 like every admitted entry —
			// the legacy representation is retired (KRA-775 Stage 5).
			{
				id: "worker-arna",
				title: "Arna K.",
				path: "/workers/wrk-001",
				representation: "source-v1",
				surface_id: "taxis.worker:wrk-001",
			},
			{
				id: "worker-baldur",
				title: "Baldur R.",
				path: "/workers/wrk-002",
				representation: "source-v1",
				surface_id: "taxis.worker:wrk-002",
			},
		],
	},
});

export default defineConfig({
	testDir: "./e2e",
	testMatch: "edge-surface-contract.e2e.ts",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? "github" : "list",
	timeout: 45_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: VIEWER_URL,
		locale: "en-US",
		timezoneId: "Atlantic/Reykjavik",
		deviceScaleFactor: 1,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "off",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"], deviceScaleFactor: 1 },
		},
	],
	webServer: [
		{
			command: "node scripts/stub-source-surface-store.mjs",
			url: `http://127.0.0.1:${STUB_PORT}/healthz`,
			reuseExistingServer: false,
			timeout: 120_000,
		},
		{
			command: `bun run viewer:dev --host 127.0.0.1 --port ${VIEWER_PORT}`,
			url: `${VIEWER_URL}/healthz`,
			env: {
				MORPHE_INDEX_DIALECT: "gallery",
				MORPHE_INDEX_TITLE: "Edge surface contract",
				MORPHE_SOURCES: sources,
			},
			reuseExistingServer: false,
			timeout: 120_000,
		},
	],
});

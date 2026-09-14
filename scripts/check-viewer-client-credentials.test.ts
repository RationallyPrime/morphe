import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	collectCredentialOffenders,
	viewerClientScanRoots,
} from "./check-viewer-client-credentials.js";

function writeTree(root: string, entries: Record<string, string>): void {
	for (const [rel, body] of Object.entries(entries)) {
		const path = join(root, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, body);
	}
}

describe("viewer client credential scan", () => {
	it("requires the adapter-node client tree", () => {
		const root = mkdtempSync(join(tmpdir(), "viewer-build-"));
		expect(() => viewerClientScanRoots(root)).toThrow(/client build is missing/);
	});

	it("scans client and prerendered output, not the server bundle", () => {
		const root = mkdtempSync(join(tmpdir(), "viewer-build-"));
		writeTree(root, {
			"client/app.js": "export const ok = 1;",
			"prerendered/index.html": "<html></html>",
			"server/index.js": 'headers.Authorization = "Bearer server-secret";',
			"index.js": 'Authorization: "Bearer leaked"',
		});
		const roots = viewerClientScanRoots(root);
		expect(roots).toEqual([join(root, "client"), join(root, "prerendered")]);
		expect(collectCredentialOffenders(roots)).toEqual([]);
	});

	it("fails when the client bundle contains a bearer token", () => {
		const root = mkdtempSync(join(tmpdir(), "viewer-build-"));
		writeTree(root, {
			"client/app.js": 'fetch({ headers: { Authorization: "Bearer abc.def" } });',
		});
		expect(collectCredentialOffenders(viewerClientScanRoots(root)).length).toBeGreaterThan(0);
	});
});

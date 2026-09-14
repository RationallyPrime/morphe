import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const VIEWER_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLIENT_HINTS = ["Authorization", "Bearer ", "VIEWER_TAXIS_TOKEN", "token_env"];

function walk(directory: string): readonly string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".svelte-kit") continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else if (entry.isFile() && [".svelte", ".ts", ".js"].includes(extname(entry.name))) {
			files.push(path);
		}
	}
	return files;
}

function isServerModule(path: string): boolean {
	return (
		path.endsWith(".server.ts") ||
		(path.includes("/routes/") && path.endsWith("+page.server.ts")) ||
		path.endsWith("sources.server.ts") ||
		path.endsWith("home-compose.server.ts") ||
		path.endsWith("pane-load.server.ts") ||
		path.endsWith("surface-load.server.ts") ||
		path.endsWith("home-cache.server.ts")
	);
}

describe("viewer credential boundary", () => {
	it("does not serialize bearer tokens in page-shaped trees", async () => {
		const { homeTree } = await import("./home-presenter.js");
		const tree = homeTree({
			title: "Operations",
			grammarVersion: "0.8.0",
			panels: [],
		});
		const serialized = JSON.stringify(tree);
		expect(serialized).not.toContain("Bearer ");
		expect(serialized).not.toContain("authorization");
		expect(serialized).not.toMatch(/"bearer"\s*:/);
	});

	it("keeps credential material out of client-imported viewer modules", () => {
		const offenders: string[] = [];
		for (const file of walk(join(VIEWER_ROOT, "src"))) {
			if (isServerModule(file)) continue;
			if (file.endsWith(".test.ts")) continue;
			if (file.endsWith("sources.ts")) continue;
			if (file.endsWith("sources.test.ts")) continue;
			const source = readFileSync(file, "utf8");
			for (const hint of CLIENT_HINTS) {
				if (source.includes(hint)) offenders.push(`${relative(VIEWER_ROOT, file)}:${hint}`);
			}
		}
		expect(offenders).toEqual([]);
		expect(statSync(join(VIEWER_ROOT, "src")).isDirectory()).toBe(true);
	});
});

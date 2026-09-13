import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const TOKEN_AUTHORITY = join("src", "lib", "tokens", "scales.css");
const SOURCE_ROOTS = ["src", "viewer/src"] as const;
const SKIP_DIRECTORIES = new Set(["node_modules", ".svelte-kit", "dist"]);
const SOURCE_EXTENSIONS = new Set([".css", ".svelte", ".ts", ".js"]);
const RAW_LAYER = /z-index\s*:\s*-?\d+/;

function walk(directory: string): readonly string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (SKIP_DIRECTORIES.has(entry.name)) continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
	}
	return files;
}

describe("layer tokens", () => {
	it("rejects raw numeric z-index outside the scale authority", () => {
		const offenders: string[] = [];
		for (const root of SOURCE_ROOTS) {
			for (const file of walk(join(ROOT, root))) {
				const relativePath = relative(ROOT, file);
				if (relativePath === TOKEN_AUTHORITY) continue;
				if (relativePath.endsWith("layers.test.ts")) continue;
				const source = readFileSync(file, "utf8");
				if (RAW_LAYER.test(source)) offenders.push(relativePath);
			}
		}
		expect(offenders).toEqual([]);
		expect(statSync(join(ROOT, TOKEN_AUTHORITY)).isFile()).toBe(true);
	});
});

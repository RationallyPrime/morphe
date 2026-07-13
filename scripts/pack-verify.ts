/**
 * Pack verification for the published package shape.
 *
 * This deliberately installs the tarball into a throwaway Vite + Svelte app
 * instead of importing from the workspace. It catches broken export maps,
 * missing CSS assets, missing peer/runtime deps, and deep-path accidents before
 * the package ever reaches GitHub Packages.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const tempRoot = mkdtempSync(join(tmpdir(), "morphe-pack-verify-"));
const runtimeDir = join(tempRoot, "xdg-runtime");
const scaffold = join(tempRoot, "consumer");
const verifyRegistry = process.env.MORPHE_VERIFY_REGISTRY === "1";
let tarball = "";

interface Command {
	readonly cmd: string;
	readonly args: readonly string[];
	readonly cwd: string;
}

function run({ cmd, args, cwd }: Command): string {
	const result = spawnSync(cmd, [...args], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			TEMP: runtimeDir,
			TMP: runtimeDir,
			TMPDIR: runtimeDir,
			XDG_RUNTIME_DIR: runtimeDir,
		},
	});
	if (result.status !== 0) {
		const rendered = [`$ ${cmd} ${args.join(" ")}`];
		if (result.stdout.trim()) rendered.push(result.stdout.trim());
		if (result.stderr.trim()) rendered.push(result.stderr.trim());
		throw new Error(rendered.join("\n"));
	}
	return result.stdout.trim();
}

function write(path: string, content: string): void {
	writeFileSync(path, content.trimStart(), "utf8");
}

function packageVersionFromManifest(): string {
	const manifest: unknown = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
	if (!manifest || typeof manifest !== "object") {
		throw new Error("package.json must contain an object");
	}
	const version = (manifest as { readonly version?: unknown }).version;
	if (typeof version !== "string" || version.length === 0) {
		throw new Error("package.json must contain a non-empty version string");
	}
	return version;
}

try {
	mkdirSync(runtimeDir, { recursive: true });
	mkdirSync(join(scaffold, "src"), { recursive: true });

	let dependencySource = "";
	const surfaceText = verifyRegistry ? "Registry verify surface" : "Pack verify surface";

	if (verifyRegistry) {
		const packageVersion = process.env.MORPHE_VERIFY_PACKAGE || packageVersionFromManifest();
		dependencySource = packageVersion;
	} else {
		const packed = run({
			cmd: "bun",
			args: ["pm", "pack", "--destination", tempRoot, "--quiet"],
			cwd: repoRoot,
		});
		const packedParts = packed.split(/\s+/);
		let tarballName: string | undefined;
		for (let i = packedParts.length - 1; i >= 0; i -= 1) {
			const part = packedParts[i];
			if (part?.endsWith(".tgz")) {
				tarballName = part;
				break;
			}
		}
		if (!tarballName) {
			throw new Error(`bun pm pack did not report a tarball name: ${packed}`);
		}
		tarball = isAbsolute(tarballName) ? tarballName : join(tempRoot, tarballName);
		if (!existsSync(tarball)) {
			throw new Error(`Expected tarball at ${tarball}`);
		}
		dependencySource = `file:${tarball}`;
	}

	write(
		join(scaffold, "package.json"),
		JSON.stringify(
			{
				type: "module",
				private: true,
				scripts: {
					build: "vite build",
					"build:ssr": "vite build --ssr src/entry-server.ts --outDir .ssr",
					verify: "bun run build:ssr && bun src/verify-built.ts",
				},
				dependencies: {
					"@rationallyprime/morphe": dependencySource,
					"@sveltejs/vite-plugin-svelte": "^4.0.0",
					"@tanstack/svelte-query": "^6.1.34",
					svelte: "^5.1.0",
					typescript: "^5.6.0",
					vite: "^5.4.0",
					zod: "^4.4.3",
				},
			},
			null,
			"\t",
		),
	);
	write(
		join(scaffold, "tsconfig.json"),
		JSON.stringify(
			{
				compilerOptions: {
					module: "ESNext",
					moduleResolution: "bundler",
					strict: true,
					target: "ES2022",
					verbatimModuleSyntax: true,
				},
				include: ["src/**/*.ts", "src/**/*.svelte", "vite.config.ts"],
			},
			null,
			"\t",
		),
	);
	write(
		join(scaffold, "vite.config.ts"),
		`
			import { svelte } from "@sveltejs/vite-plugin-svelte";
			import { defineConfig } from "vite";

			export default defineConfig({
				plugins: [svelte()],
			});
		`,
	);
	write(
		join(scaffold, "index.html"),
		`
			<div id="app"></div>
			<script type="module" src="/src/main.ts"></script>
		`,
	);
	write(
		join(scaffold, "src", "App.svelte"),
		`
			<script lang="ts">
				import "@rationallyprime/morphe/styles.css";
				import type { Node } from "@rationallyprime/morphe";
				import { MorpheRoot } from "@rationallyprime/morphe/components";

				const tree: Node = {
					kind: "frame",
					role: "section",
					children: [
						{
							kind: "text",
							value: "${surfaceText}",
							as: "heading",
							intent: "provenance",
						},
					],
				};
			</script>

			<MorpheRoot {tree} />
		`,
	);
	write(
		join(scaffold, "src", "main.ts"),
		`
			import { mount } from "svelte";
			import App from "./App.svelte";

			const target = document.getElementById("app");
			if (!target) throw new Error("missing #app target");
			mount(App, { target });
		`,
	);
	write(
		join(scaffold, "src", "entry-server.ts"),
		`
			import { render } from "svelte/server";
			import App from "./App.svelte";

			export function renderSurface(): string {
				return render(App).body;
			}
		`,
	);
	write(
		join(scaffold, "src", "verify-built.ts"),
		`
			const { renderSurface } = await import("../.ssr/entry-server.js") as {
				renderSurface: () => string;
			};
			const body = renderSurface();
			if (!body.includes("${surfaceText}")) {
				throw new Error(\`expected rendered package surface, got: \${body}\`);
			}

			// The schemas seam: the JSON Schema artifacts resolve through the export
			// map and carry the grammar's discriminated union.
			const grammarSchema = (await import(
				"@rationallyprime/morphe/schemas/morphe-grammar.schema.json"
			)) as { default?: Record<string, unknown> } & Record<string, unknown>;
			const schemaRoot = grammarSchema.default ?? grammarSchema;
			if (!schemaRoot || typeof schemaRoot !== "object" || !("$defs" in schemaRoot)) {
				throw new Error("expected morphe-grammar.schema.json to expose $defs through ./schemas/*");
			}

			const { validateSurfaceArtifact } = await import("@rationallyprime/morphe/artifacts");
			const artifact = {
				artifact_version: "1.0.0",
				tree: { kind: "frame", role: "page", children: [] },
				grammar_version: "0.1.0",
				producer_version: "0.2.0",
				compiler_version: "0.2.0",
				diagnostics: [],
				produced_at: "",
			};
			if (!validateSurfaceArtifact(artifact).ok) {
				throw new Error("expected installed artifact trust gate to accept a valid surface");
			}
			if (validateSurfaceArtifact({ ...artifact, tree: { kind: "text" } }).ok) {
				throw new Error("expected installed artifact trust gate to reject an invalid tree");
			}

			const surfaceSchema = (await import(
				"@rationallyprime/morphe/schemas/morphe-surface-artifact.schema.json"
			)) as { default?: Record<string, unknown> } & Record<string, unknown>;
			const surfaceSchemaRoot = surfaceSchema.default ?? surfaceSchema;
			if (!surfaceSchemaRoot || surfaceSchemaRoot.title !== "Morphe Compiled Surface Artifact") {
				throw new Error("expected the installed compiled-surface schema artifact");
			}
		`,
	);

	run({ cmd: "bun", args: ["install"], cwd: scaffold });
	run({ cmd: "bun", args: ["run", "build"], cwd: scaffold });
	run({ cmd: "bun", args: ["run", "verify"], cwd: scaffold });

	if (verifyRegistry) {
		process.stdout.write(`registry-verify passed: @rationallyprime/morphe@${dependencySource}\n`);
	} else {
		process.stdout.write(`pack-verify passed: ${tarball}\n`);
	}
} finally {
	if (process.env.KEEP_PACK_VERIFY !== "1") {
		rmSync(tempRoot, { recursive: true, force: true });
	}
}

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

interface SourceConformanceCase {
	readonly id: string;
	readonly paths: { readonly node: string; readonly source: string };
	readonly expected: {
		readonly issuer: string;
		readonly key_id: string;
		readonly public_key_raw_hex: string;
		readonly surface_id: string;
	};
}

function sourceConformanceCase(): SourceConformanceCase {
	const manifest = JSON.parse(
		readFileSync(join(repoRoot, "fixtures/source-surface/conformance-v1.json"), "utf8"),
	) as { readonly cases?: readonly SourceConformanceCase[] };
	const fixture = manifest.cases?.find((candidate) => candidate.id === "taxis-roster");
	if (fixture === undefined) throw new Error("source conformance manifest has no Taxis case");
	return fixture;
}

try {
	mkdirSync(runtimeDir, { recursive: true });
	mkdirSync(join(scaffold, "src"), { recursive: true });

	let dependencySource = "";
	const surfaceText = verifyRegistry ? "Registry verify surface" : "Pack verify surface";
	const sourceCase = sourceConformanceCase();
	const sourceFixture = readFileSync(join(repoRoot, sourceCase.paths.source), "utf8");
	const expectedSourceNode = readFileSync(join(repoRoot, sourceCase.paths.node), "utf8");
	const sourcePublicKey = Buffer.from(sourceCase.expected.public_key_raw_hex, "hex").toString(
		"base64url",
	);

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
					typecheck: "tsc --noEmit --project tsconfig.types.json",
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
		join(scaffold, "tsconfig.types.json"),
		JSON.stringify(
			{
				extends: "./tsconfig.json",
				compilerOptions: {
					noEmit: true,
				},
				include: ["src/verify-types.ts"],
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
			import { DIALECT_IDS, GRAMMAR_VERSION } from "@rationallyprime/morphe";
			import App from "./App.svelte";

			export const installedDialectIds = DIALECT_IDS;
			export const installedGrammarVersion = GRAMMAR_VERSION;

			export function renderSurface(): string {
				return render(App).body;
			}
		`,
	);
	write(
		join(scaffold, "src", "verify-types.ts"),
		`
			import {
				SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA,
				type Sha256,
				type SourceSurfaceArtifactV1,
			} from "@rationallyprime/morphe/artifacts";
			import type {
				CompilationReceipt,
				SourceAdmissionResult,
				TrustedSourceSurface,
			} from "@rationallyprime/morphe/surface-edge";

			const sourceDiscriminators = {
				kind: "morphe.source-surface",
				wire_version: "1.0",
			} satisfies Pick<SourceSurfaceArtifactV1, "kind" | "wire_version">;
			const zeroDigest: Sha256 =
				"sha256:0000000000000000000000000000000000000000000000000000000000000000";
			const sourceSchema: Record<string, unknown> = SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA;

			void sourceDiscriminators;
			void zeroDigest;
			void sourceSchema;
			void (undefined as unknown as CompilationReceipt);
			void (undefined as unknown as SourceAdmissionResult);
			void (undefined as unknown as TrustedSourceSurface);
		`,
	);
	write(join(scaffold, "src", "source-fixture.json"), sourceFixture);
	write(join(scaffold, "src", "source-node.json"), expectedSourceNode);
	write(
		join(scaffold, "src", "verify-built.ts"),
		`
			import { createHash } from "node:crypto";
			import { readFileSync } from "node:fs";
			import { fileURLToPath } from "node:url";
			import { isDeepStrictEqual } from "node:util";

			const { installedDialectIds, installedGrammarVersion, renderSurface } = await import(
				"../.ssr/entry-server.js"
			) as {
				installedDialectIds: readonly string[];
				installedGrammarVersion: string;
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

			const maskManifestModule = (await import(
				"@rationallyprime/morphe/schemas/masks/manifest.json"
			)) as { default?: Record<string, unknown> } & Record<string, unknown>;
			const maskManifest = maskManifestModule.default ?? maskManifestModule;
			if (maskManifest.format_version !== 1) {
				throw new Error("expected decoder-mask manifest format_version 1");
			}
			if (maskManifest.grammar_version !== installedGrammarVersion) {
				throw new Error("installed decoder-mask manifest and runtime grammar disagree");
			}
			const dialectEntries = maskManifest.dialects;
			if (!dialectEntries || typeof dialectEntries !== "object" || Array.isArray(dialectEntries)) {
				throw new Error("expected installed decoder-mask manifest dialect entries");
			}
			const manifestDialectIds = Object.keys(dialectEntries).sort();
			const runtimeDialectIds = [...installedDialectIds].sort();
			if (JSON.stringify(manifestDialectIds) !== JSON.stringify(runtimeDialectIds)) {
				throw new Error("installed decoder-mask manifest and runtime dialect registry disagree");
			}
			for (const [dialectId, rawEntry] of Object.entries(dialectEntries)) {
				if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
					throw new Error(\`invalid decoder-mask manifest entry for \${dialectId}\`);
				}
				const entry = rawEntry as Record<string, unknown>;
				const schemaPath = entry.schema;
				if (typeof schemaPath !== "string") {
					throw new Error(\`decoder-mask entry for \${dialectId} has no schema path\`);
				}
				const expectedDigest = entry.sha256;
				if (typeof expectedDigest !== "string" || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
					throw new Error(\`decoder-mask entry for \${dialectId} has no valid SHA-256\`);
				}
				const schemaSpecifier = \`@rationallyprime/morphe/schemas/masks/\${schemaPath}\`;
				const maskModule = (await import(
					schemaSpecifier
				)) as { default?: Record<string, unknown> } & Record<string, unknown>;
				const mask = maskModule.default ?? maskModule;
				if (mask["x-morphe-dialect"] !== dialectId || !("$defs" in mask)) {
					throw new Error(\`installed decoder mask for \${dialectId} is malformed\`);
				}
				const installedPath = fileURLToPath(import.meta.resolve(schemaSpecifier));
				const actualDigest = createHash("sha256")
					.update(readFileSync(installedPath))
					.digest("hex");
				if (actualDigest !== expectedDigest) {
					throw new Error(\`installed decoder mask for \${dialectId} failed SHA-256 verification\`);
				}
			}
			const clinicalEntry = (dialectEntries as Record<string, Record<string, unknown>>).clinical;
			const clinicalPolicy = clinicalEntry?.compound_policy;
			if (
				!clinicalPolicy ||
				typeof clinicalPolicy !== "object" ||
				(clinicalPolicy as Record<string, unknown>).mode !== "allowlist" ||
				JSON.stringify((clinicalPolicy as Record<string, unknown>).compounds) !==
					JSON.stringify([
						"SignalCard",
						"EntityHeader",
						"StatBand",
						"Breakdown",
						"TrailEntry",
						"KeyValuePanel",
					])
			) {
				throw new Error("expected installed clinical mask to allow exactly the promoted catalog");
			}

			const { SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA, validateSurfaceArtifact } = await import(
				"@rationallyprime/morphe/artifacts"
			);
			const sourceDiscriminators = {
				kind: "morphe.source-surface",
				wire_version: "1.0",
			} as const;
			if (
				sourceDiscriminators.kind !== "morphe.source-surface" ||
				SOURCE_SURFACE_ARTIFACT_JSON_SCHEMA.additionalProperties !== false
			) {
				throw new Error("expected installed generated source-artifact ingress contract");
			}
			const artifact = {
				artifact_version: "1.0.0",
				tree: { kind: "frame", role: "page", children: [] },
				grammar_version: "0.2.0",
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

			const sourceSchema = (await import(
				"@rationallyprime/morphe/schemas/morphe-source-surface.schema.json"
			)) as { default?: Record<string, unknown> } & Record<string, unknown>;
			const sourceSchemaRoot = sourceSchema.default ?? sourceSchema;
			const sourceProperties = sourceSchemaRoot.properties as Record<string, unknown> | undefined;
			if (
				sourceSchemaRoot.title !== "Morphe Source Surface Artifact V1" ||
				sourceSchemaRoot.additionalProperties !== false ||
				!sourceProperties?.schema ||
				sourceProperties.tree
			) {
				throw new Error("expected the installed strict source-surface schema artifact");
			}

			// The server-only source-edge seam must survive the installed tarball:
			// admit the real signed fixture, compile it, and match the frozen Python oracle.
			const {
				COMPILER_BUILD_SHA256,
				COMPILER_VERSION,
				admitSourceSurfaceJson,
				compileSourceSurface,
			} = await import("@rationallyprime/morphe/surface-edge");
			const sourceRaw = readFileSync(
				fileURLToPath(new URL("./source-fixture.json", import.meta.url)),
				"utf8",
			);
			const admitted = await admitSourceSurfaceJson(sourceRaw, {
				expectedIssuer: "${sourceCase.expected.issuer}",
				expectedSurfaceId: "${sourceCase.expected.surface_id}",
				publicKeys: {
					"${sourceCase.expected.issuer}": {
						"${sourceCase.expected.key_id}": "${sourcePublicKey}",
					},
				},
				now: () => new Date("2026-07-17T12:01:00Z"),
			});
			if (!admitted.ok) {
				throw new Error(\`installed source admission failed: \${admitted.issue.reason}\`);
			}
			const compiled = compileSourceSurface(admitted.value);
			const expectedNode = JSON.parse(
				readFileSync(fileURLToPath(new URL("./source-node.json", import.meta.url)), "utf8"),
			) as unknown;
			if (!isDeepStrictEqual(compiled.tree, expectedNode)) {
				throw new Error("installed source compiler drifted from the Python Node oracle");
			}
			if (
				compiled.receipt.compilerBuildSha256 !== COMPILER_BUILD_SHA256 ||
				compiled.receipt.compilerVersion !== COMPILER_VERSION ||
				compiled.receipt.grammarVersion !== installedGrammarVersion
			) {
				throw new Error("installed source compiler stamped an inconsistent receipt");
			}
		`,
	);

	run({ cmd: "bun", args: ["install"], cwd: scaffold });
	run({ cmd: "bun", args: ["run", "typecheck"], cwd: scaffold });
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

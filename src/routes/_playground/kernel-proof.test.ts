import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { DIALECT_IDS, getDialect, validateNodeForDialect } from "$lib";
import { validateNodeDocument } from "$lib/artifacts";
import { MorpheRoot } from "$lib/components";
import { admitSourceSurfaceJson } from "$lib/surface-edge";
import { compileSourceSurfaceDetailed } from "$lib/surface-edge/compile.js";
import { KERNEL_PROOF_CASES } from "./kernel-proof.js";

const CORPUS_URL = new URL("../../../fixtures/krepis-proof/", import.meta.url);
const CORPUS_ROOT = fileURLToPath(CORPUS_URL);
const MANIFEST_URL = new URL("manifest.json", CORPUS_URL);
const VALIDATION_URL = new URL("validation.json", CORPUS_URL);
const SOURCE_GENERATION_URL = new URL("source-generation.json", CORPUS_URL);
const README_URL = new URL("README.md", CORPUS_URL);
const COMPILER_CODE_BASE_SHA = "5aca9c20d7a62d8264702dc61a8f84e4ffade200";
const VALIDATION_WORKTREE_HEAD_SHA = "a96ecf7d72c422dc6078bdac36c36c1fed70e8d2";
const FIXED_FRESHNESS_NOW = "2026-08-04T12:01:00Z";
const FIXED_COMPILATION_NOW = "2026-08-04T12:00:00Z";

interface CorpusDocument {
	readonly path: string;
	readonly byte_size: number;
	readonly sha256: string;
}

interface ManifestCase {
	readonly id: string;
	readonly issuer: string;
	readonly operation_id: string;
	readonly surface_id: string;
	readonly view_model_id: string;
	readonly public_key: {
		readonly key_id: string;
		readonly base64url: string;
	};
	readonly source: CorpusDocument & {
		readonly source_revision: string;
		readonly testimony_sha256: string;
		readonly content_sha256: string;
		readonly schema_sha256: string;
		readonly signature: string;
	};
	readonly morphe: {
		readonly base_sha: string;
		readonly presentation_now: string;
		readonly documents: {
			readonly surface_spec: CorpusDocument;
			readonly node: CorpusDocument;
		};
		readonly compilation: {
			readonly receipt: {
				readonly sourceTestimonySha256: string;
				readonly treeSha256: string;
			};
		};
	};
}

interface CorpusManifest {
	readonly format: string;
	readonly case_count: number;
	readonly krepis_base_sha: string;
	readonly morphe_base_sha: string;
	readonly repository_context: {
		readonly compiler_code_base_sha: string;
		readonly validation_worktree_head_sha: string;
		readonly later_exact_green_pr_compatibility_proof: string;
	};
	readonly cases: readonly ManifestCase[];
}

interface SignedSourceWire {
	readonly issuer: string;
	readonly surface_id: string;
	readonly source_revision: string;
	readonly view_model: { readonly id: string };
	readonly seals: {
		readonly content_sha256: string;
		readonly schema_sha256: string;
		readonly testimony_sha256: string;
	};
	readonly attestation: { readonly signature: string; readonly key_id: string };
}

interface SourceGenerationReceipt {
	readonly format: string;
	readonly cases: readonly {
		readonly id: string;
		readonly source: { readonly two_fresh_generations_byte_identical: boolean };
	}[];
}

const MANIFEST = JSON.parse(readFileSync(MANIFEST_URL, "utf8")) as CorpusManifest;
const SOURCE_GENERATION = JSON.parse(
	readFileSync(SOURCE_GENERATION_URL, "utf8"),
) as SourceGenerationReceipt;

function corpusUrl(path: string): URL {
	return new URL(path, CORPUS_URL);
}

function sha256(raw: string): string {
	return createHash("sha256").update(raw, "utf8").digest("hex");
}

function readDocument(document: CorpusDocument, caseId: string): string {
	const raw = readFileSync(corpusUrl(document.path), "utf8");
	expect(Buffer.byteLength(raw, "utf8"), `${caseId}:${document.path} byte size`).toBe(
		document.byte_size,
	);
	expect(sha256(raw), `${caseId}:${document.path} SHA-256`).toBe(document.sha256);
	return raw;
}

function serialized(value: unknown): unknown {
	return JSON.parse(JSON.stringify(value));
}

function listedCorpusFiles(directory = CORPUS_ROOT): readonly string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...listedCorpusFiles(path));
		else if (entry.isFile()) files.push(relative(CORPUS_ROOT, path));
	}
	return files.sort();
}

function expectedCorpusFiles(): readonly string[] {
	const paths = ["README.md", "manifest.json", "source-generation.json", "validation.json"];
	for (const fixture of KERNEL_PROOF_CASES) {
		paths.push(
			`artifacts/${fixture.id}/${fixture.id}.node.json`,
			`artifacts/${fixture.id}/${fixture.id}.source.json`,
			`artifacts/${fixture.id}/${fixture.id}.surface-spec.json`,
		);
	}
	return paths.sort();
}

describe("six-kernel source-v1 proof corpus", () => {
	it("keeps all six sealed cases admissible, byte-stable, grammar-valid, and renderable", async () => {
		expect(MANIFEST.format).toBe("krepis-six-kernel-source-v1-evidence/v1");
		expect(MANIFEST.case_count).toBe(6);
		expect(MANIFEST.cases).toHaveLength(6);
		expect(MANIFEST.morphe_base_sha).toBe(COMPILER_CODE_BASE_SHA);
		expect(MANIFEST.repository_context.compiler_code_base_sha).toBe(COMPILER_CODE_BASE_SHA);
		expect(MANIFEST.repository_context.validation_worktree_head_sha).toBe(
			VALIDATION_WORKTREE_HEAD_SHA,
		);
		expect(MANIFEST.repository_context.later_exact_green_pr_compatibility_proof).toContain(
			"not a self-referential final-head claim",
		);
		expect(JSON.parse(readFileSync(VALIDATION_URL, "utf8"))).toMatchObject({
			passed: true,
			morphe_base_sha: COMPILER_CODE_BASE_SHA,
		});
		expect(SOURCE_GENERATION.format).toBe("krepis-six-kernel-source-v1-generation/v1");
		expect(SOURCE_GENERATION.cases).toHaveLength(6);
		expect(SOURCE_GENERATION.cases.map((fixture) => fixture.id)).toEqual(
			KERNEL_PROOF_CASES.map((fixture) => fixture.id),
		);
		for (const fixture of SOURCE_GENERATION.cases) {
			expect(fixture.source.two_fresh_generations_byte_identical, fixture.id).toBe(true);
		}

		expect(KERNEL_PROOF_CASES).toHaveLength(6);
		expect(KERNEL_PROOF_CASES.map((fixture) => fixture.issuer)).toEqual([
			"taxis",
			"misthos",
			"chreos",
			"obolos",
			"apotheke",
			"zygos",
		]);
		expect(new Set(KERNEL_PROOF_CASES.map((fixture) => fixture.issuer)).size).toBe(6);
		expect(KERNEL_PROOF_CASES.map((fixture) => fixture.operationId)).toEqual([
			"get_surface_roster",
			"get_surface_run_summary",
			"get_surface_obligations",
			"get_surface_finality",
			"get_surface_expiry",
			"get_surface_transaction",
		]);
		expect(new Set(KERNEL_PROOF_CASES.map((fixture) => fixture.operationId)).size).toBe(6);
		expect(DIALECT_IDS).toHaveLength(9);

		for (const fixture of KERNEL_PROOF_CASES) {
			const manifestCase = MANIFEST.cases.find((candidate) => candidate.id === fixture.id);
			expect(manifestCase, `${fixture.id} manifest entry`).toBeDefined();
			if (manifestCase === undefined) throw new Error(`missing manifest entry for ${fixture.id}`);

			expect(manifestCase.issuer).toBe(fixture.issuer);
			expect(manifestCase.operation_id).toBe(fixture.operationId);
			expect(manifestCase.surface_id).toBe(fixture.surfaceId);
			expect(manifestCase.source.source_revision).toBe(fixture.sourceRevision);
			expect(manifestCase.source.testimony_sha256).toBe(fixture.testimonySha256);
			expect(manifestCase.morphe.compilation.receipt.sourceTestimonySha256).toBe(
				fixture.testimonySha256,
			);
			expect(manifestCase.morphe.compilation.receipt.treeSha256).toBe(fixture.treeSha256);
			expect(manifestCase.morphe.base_sha).toBe(COMPILER_CODE_BASE_SHA);
			expect(manifestCase.morphe.presentation_now).toBe(FIXED_COMPILATION_NOW);

			const rawSource = readDocument(manifestCase.source, fixture.id);
			for (const key of [
				"national_id",
				"account_identifier",
				"previous_hash",
				"confirmed_hours",
				"open_violations",
			]) {
				expect(rawSource, `${fixture.id} signed source retains forbidden key ${key}`).not.toMatch(
					new RegExp(`"${key}"\\s*:`),
				);
			}
			const expectedSpec = JSON.parse(
				readDocument(manifestCase.morphe.documents.surface_spec, fixture.id),
			) as unknown;
			const expectedNode = JSON.parse(
				readDocument(manifestCase.morphe.documents.node, fixture.id),
			) as unknown;
			const source = JSON.parse(rawSource) as SignedSourceWire;
			expect(source.issuer).toBe(fixture.issuer);
			expect(source.surface_id).toBe(fixture.surfaceId);
			expect(source.source_revision).toBe(fixture.sourceRevision);
			expect(source.view_model.id).toBe(manifestCase.view_model_id);
			expect(source.seals.content_sha256).toBe(manifestCase.source.content_sha256);
			expect(source.seals.schema_sha256).toBe(manifestCase.source.schema_sha256);
			expect(source.seals.testimony_sha256).toBe(fixture.testimonySha256);
			expect(source.attestation.signature).toBe(manifestCase.source.signature);
			expect(source.attestation.key_id).toBe(manifestCase.public_key.key_id);

			const admitted = await admitSourceSurfaceJson(rawSource, {
				expectedIssuer: fixture.issuer,
				expectedSurfaceId: fixture.surfaceId,
				publicKeys: {
					[manifestCase.issuer]: {
						[manifestCase.public_key.key_id]: manifestCase.public_key.base64url,
					},
				},
				now: () => new Date(FIXED_FRESHNESS_NOW),
			});
			expect(admitted.ok, fixture.id).toBe(true);
			if (!admitted.ok) throw new Error(`${fixture.id}: ${admitted.issue.reason}`);
			expect(admitted.value.sourceTestimonySha256).toBe(fixture.testimonySha256);

			const first = compileSourceSurfaceDetailed(admitted.value, {
				now: () => new Date(FIXED_COMPILATION_NOW),
			});
			const second = compileSourceSurfaceDetailed(admitted.value, {
				now: () => new Date(FIXED_COMPILATION_NOW),
			});
			expect(serialized(first.ir), `${fixture.id} SurfaceSpec`).toEqual(expectedSpec);
			expect(serialized(second.ir), `${fixture.id} second SurfaceSpec`).toEqual(expectedSpec);
			expect(serialized(first.tree), `${fixture.id} Node`).toEqual(expectedNode);
			expect(serialized(second.tree), `${fixture.id} second Node`).toEqual(expectedNode);
			expect(serialized(second.ir)).toEqual(serialized(first.ir));
			expect(serialized(second.tree)).toEqual(serialized(first.tree));
			expect(second.diagnostics).toEqual(first.diagnostics);
			expect(second.receipt).toEqual(first.receipt);
			expect(first.receipt.sourceTestimonySha256).toBe(fixture.testimonySha256);
			expect(first.receipt.treeSha256).toBe(fixture.treeSha256);

			expect(validateNodeDocument(fixture.tree).ok, `${fixture.id} fixed tree grammar`).toBe(true);
			expect(validateNodeDocument(first.tree).ok, `${fixture.id} compiled tree grammar`).toBe(true);
			for (const dialectId of DIALECT_IDS) {
				const dialectValidation = validateNodeForDialect(fixture.tree, dialectId, {
					validateNodeValue: (value) => validateNodeDocument(value).ok,
				});
				expect(dialectValidation, `${fixture.id}:${dialectId} dialect`).toEqual({ ok: true });
				const firstHtml = render(MorpheRoot, {
					props: { tree: fixture.tree, dialect: getDialect(dialectId) },
				}).body;
				const secondHtml = render(MorpheRoot, {
					props: { tree: fixture.tree, dialect: getDialect(dialectId) },
				}).body;
				expect(secondHtml, `${fixture.id}:${dialectId} deterministic SSR`).toBe(firstHtml);
				expect(firstHtml, `${fixture.id}:${dialectId} dialect root`).toContain(
					`data-mo-dialect="${dialectId}"`,
				);
			}
		}
	});

	it("contains only sealed evidence, not Krepis code, credentials, private keys, or PII", () => {
		expect(listedCorpusFiles()).toEqual(expectedCorpusFiles());
		for (const path of listedCorpusFiles()) {
			expect([".json", ".md"], `${path} source-code extension`).toContain(extname(path));
		}

		const fixtureModule = readFileSync(new URL("./kernel-proof.ts", import.meta.url), "utf8");
		const imports = [...fixtureModule.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
		expect(
			imports.every(
				(specifier) =>
					specifier === "$lib" || specifier === "$lib/artifacts" || specifier?.endsWith(".json"),
			),
		).toBe(true);

		const README = readFileSync(README_URL, "utf8");
		expect(README).not.toContain("/Users/");
		expect(README).not.toContain("kernel-proof-staging");
		expect(README).toContain(COMPILER_CODE_BASE_SHA);
		expect(README).toContain(VALIDATION_WORKTREE_HEAD_SHA);

		const corpusText = listedCorpusFiles()
			.map((path) => readFileSync(join(CORPUS_ROOT, path), "utf8"))
			.join("\n");
		// Deliberately do not flag the manifest's public_key or signature fields: both are public
		// attestation evidence needed by admission, not secrets.
		const forbidden = [
			/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i,
			/"(?:private_key|privateKey|signing_seed|signingSeed|secret_key|secretKey|api_key|apiKey|access_token|accessToken|password|authorization|bearer_token)"\s*:/i,
			/"(?:ssn|social_security_number|email|email_address|phone|phone_number|mobile|date_of_birth|dob|passport_number|iban|swift|card_number|card_pan|cvv|cvc)"\s*:/i,
			/\bAKIA[0-9A-Z]{16}\b/,
			/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
			/\b\d{3}-\d{2}-\d{4}\b/,
			/\b(?:\d{4}[ -]){3}\d{4}\b/,
			/\b\d{4}[ -]\d{6}[ -]\d{5}\b/,
		];
		for (const sentinel of forbidden) {
			expect(corpusText, `forbidden corpus sentinel ${sentinel}`).not.toMatch(sentinel);
		}
		expect(corpusText).toContain('"public_key"');
		expect(corpusText).toContain('"signature"');
	});
});

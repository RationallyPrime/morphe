import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSurfaceArtifactV1 } from "../artifacts/source-types.generated.js";
import { validateNodeDocument } from "../artifacts/surface.js";
import { validateNodeForDialect } from "../dialects/constraints.js";
import { DIALECT_IDS } from "../dialects/registry.js";
import { buildSurface } from "./build.js";
import { compileSourceSurface } from "./compile.js";
import { emitNode } from "./emit.js";
import { admitSourceSurfaceJson, type TrustedSourceSurface } from "./source.js";

const FIXTURE_ROOT = new URL("../../../fixtures/source-surface/", import.meta.url);

interface ConformanceExpected {
	readonly issuer: string;
	readonly key_id: string;
	readonly public_key_raw_hex: string;
	readonly surface_id: string;
}

interface ConformanceHidden {
	readonly field: string;
	readonly sentinel: string;
}

interface ConformanceCase {
	readonly id: string;
	readonly paths: {
		readonly node: string;
		readonly source: string;
		readonly surface_spec: string;
	};
	readonly expected: ConformanceExpected;
	readonly hidden: ConformanceHidden;
}

interface ConformanceManifest {
	readonly manifest_version: string;
	readonly cases: readonly ConformanceCase[];
}

/** Manifest fixture paths are repo-root-relative; resolve them under the fixtures dir. */
function readFixture(repoRelativePath: string): string {
	const name = repoRelativePath.replace(/^fixtures\/source-surface\//, "");
	return readFileSync(new URL(name, FIXTURE_ROOT), "utf8");
}

function loadManifest(): ConformanceManifest {
	return JSON.parse(
		readFileSync(new URL("conformance-v1.json", FIXTURE_ROOT), "utf8"),
	) as ConformanceManifest;
}

interface OracleCase {
	readonly id: string;
	readonly expected: ConformanceExpected;
	readonly hidden: ConformanceHidden;
	readonly rawSource: string;
	readonly source: SourceSurfaceArtifactV1;
	readonly spec: unknown;
	readonly node: unknown;
}

function oracle(entry: ConformanceCase): OracleCase {
	const rawSource = readFixture(entry.paths.source);
	return {
		id: entry.id,
		expected: entry.expected,
		hidden: entry.hidden,
		rawSource,
		source: JSON.parse(rawSource) as SourceSurfaceArtifactV1,
		spec: JSON.parse(readFixture(entry.paths.surface_spec)),
		node: JSON.parse(readFixture(entry.paths.node)),
	};
}

// KRA-765 F2: the corpus is the conformance manifest itself, never a hand-kept
// list that can silently shrink when a fixture is dropped or a regeneration stops
// emitting a case.
const MANIFEST = loadManifest();
const CASES = MANIFEST.cases.map(oracle);

function hasSignedRootOrder(source: SourceSurfaceArtifactV1): boolean {
	const hint = source.schema["x-morphe"];
	return (
		typeof hint === "object" &&
		hint !== null &&
		!Array.isArray(hint) &&
		Array.isArray((hint as Record<string, unknown>).order)
	);
}

describe("Python/TypeScript source-surface migration oracles", () => {
	it("drives the corpus from the conformance manifest and refuses to shrink", () => {
		expect(MANIFEST.manifest_version).toBe("1.0");
		// Two pinned pilot kernels (taxis, obolos) are the floor. If the manifest
		// ever ships fewer, this fails rather than quietly gating on less.
		expect(CASES.length).toBeGreaterThanOrEqual(2);
		expect(CASES.map((entry) => entry.id)).toEqual(["taxis-roster", "obolos-evidence"]);
	});

	for (const fixture of CASES) {
		// Stage 0 originally sorted source JSON keys after compiling its oracles,
		// losing authenticated presentation order. KRA-762 repairs this by stamping
		// signed x-morphe.order arrays. Never restore fixture-only order in this test.
		it(`${fixture.id} matches SurfaceSpec and Node exactly`, () => {
			// KRA-765 F2: a regeneration that drops signed root order is a hard
			// failure here, never a silent `it.skip`.
			expect(hasSignedRootOrder(fixture.source), `${fixture.id} lost its signed root order`).toBe(
				true,
			);

			const spec = buildSurface(fixture.source.schema, fixture.source.data, {
				root: fixture.source.schema,
				diagnostics: fixture.source.diagnostics ?? [],
			});
			expect(JSON.parse(JSON.stringify(spec))).toEqual(fixture.spec);

			const node = emitNode(spec);
			expect(node).toEqual(fixture.node);
			expect(validateNodeDocument(node).ok).toBe(true);

			for (const dialect of DIALECT_IDS) {
				expect(
					validateNodeForDialect(node, dialect, {
						validateNodeValue: (value) => validateNodeDocument(value).ok,
					}),
					`${fixture.id} under ${dialect}`,
				).toEqual({ ok: true });
			}

			const source = {
				schema: fixture.source.schema,
				data: fixture.source.data,
				diagnostics: fixture.source.diagnostics ?? [],
				sourceTestimonySha256: fixture.source.seals.testimony_sha256,
			} as TrustedSourceSurface;
			expect(compileSourceSurface(source).tree).toEqual(fixture.node);
		});

		// KRA-765 F1: the parity oracle above only ever sees post-minimization clean
		// fixtures, so a TS-side re-exposure is structurally untestable there. Admit
		// the real signed source end to end and prove the compiled tree carries no
		// residue of the field that was hidden before signing — neither its
		// sentinel value nor its wire name.
		it(`${fixture.id} admits and compiles with no trace of its pre-minimization hidden field`, async () => {
			const publicKey = Buffer.from(fixture.expected.public_key_raw_hex, "hex").toString(
				"base64url",
			);
			const producedAt = Date.parse(fixture.source.produced_at);
			expect(Number.isFinite(producedAt), `${fixture.id} has no parseable produced_at`).toBe(true);

			const admitted = await admitSourceSurfaceJson(fixture.rawSource, {
				expectedIssuer: fixture.expected.issuer,
				expectedSurfaceId: fixture.expected.surface_id,
				publicKeys: {
					[fixture.expected.issuer]: { [fixture.expected.key_id]: publicKey },
				},
				// A minute past production keeps default freshness satisfied for a
				// fixture that carries no explicit valid_until.
				now: () => new Date(producedAt + 60_000),
			});
			expect(admitted.ok, admitted.ok ? "" : admitted.issue.reason).toBe(true);
			if (!admitted.ok) throw new Error(admitted.issue.reason);

			const serialized = JSON.stringify(compileSourceSurface(admitted.value).tree);
			expect(
				serialized.includes(fixture.hidden.sentinel),
				`${fixture.id} leaked its hidden sentinel into the compiled tree`,
			).toBe(false);
			expect(
				serialized.includes(fixture.hidden.field),
				`${fixture.id} leaked its hidden field name into the compiled tree`,
			).toBe(false);
		});
	}
});

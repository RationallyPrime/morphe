import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSurfaceArtifactV1 } from "../artifacts/source-types.generated.js";
import { validateNodeDocument } from "../artifacts/surface.js";
import { validateNodeForDialect } from "../dialects/constraints.js";
import { DIALECT_IDS } from "../dialects/registry.js";
import { buildSurface } from "./build.js";
import { compileSourceSurface } from "./compile.js";
import { emitNode } from "./emit.js";
import type { TrustedSourceSurface } from "./source.js";

const FIXTURE_ROOT = new URL("../../../fixtures/source-surface/", import.meta.url);

interface OracleCase {
	readonly name: string;
	readonly source: SourceSurfaceArtifactV1;
	readonly spec: unknown;
	readonly node: unknown;
}

function json(name: string): unknown {
	return JSON.parse(readFileSync(new URL(name, FIXTURE_ROOT), "utf8"));
}

function oracle(name: string): OracleCase {
	return {
		name,
		source: json(`${name}.source.json`) as SourceSurfaceArtifactV1,
		spec: json(`${name}.surface-spec.json`),
		node: json(`${name}.node.json`),
	};
}

const CASES = [oracle("taxis-roster"), oracle("obolos-evidence")];

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
	for (const fixture of CASES) {
		// Stage 0 originally sorted source JSON keys after compiling its oracles,
		// losing authenticated presentation order. KRA-762 repairs this by stamping
		// signed x-morphe.order arrays. Never restore fixture-only order in this test.
		const parity = hasSignedRootOrder(fixture.source) ? it : it.skip;
		parity(`${fixture.name} matches SurfaceSpec and Node exactly`, () => {
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
					`${fixture.name} under ${dialect}`,
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
	}
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSurfaceArtifactV1 } from "$lib/artifacts/source-types.generated.js";
import { COMPILER_BUILD_SHA256 } from "$lib/surface-edge/build-id.generated.js";
import { parseSourceSurfaceResponse, type SourceEnvelopeOptions } from "./source-envelope.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "./surface-reader.js";

interface GoldenVector {
	readonly public_key_base64url: string;
	readonly artifact: SourceSurfaceArtifactV1;
}

const VECTOR = JSON.parse(
	readFileSync(
		new URL("../../fixtures/source-surface/source-surface-v1.ed25519-vector.json", import.meta.url),
		"utf8",
	),
) as GoldenVector;

function options(overrides: Partial<SourceEnvelopeOptions> = {}): SourceEnvelopeOptions {
	return {
		artifactId: "taxis:roster",
		dialectHint: "ledger",
		admission: {
			expectedIssuer: "taxis",
			expectedSurfaceId: "taxis.roster:westfjords:2026-W29",
			publicKeys: {
				taxis: { "taxis-fixture-2026-01": VECTOR.public_key_base64url },
			},
			now: () => new Date("2026-07-17T12:01:00Z"),
		},
		...overrides,
	};
}

function response(
	artifact: SourceSurfaceArtifactV1 = VECTOR.artifact,
	contentType = SOURCE_SURFACE_V1_MEDIA_TYPE,
): Response {
	return new Response(JSON.stringify(artifact), { headers: { "content-type": contentType } });
}

describe("parseSourceSurfaceResponse", () => {
	it("admits and compiles source-v1 testimony for the final delivery gate", async () => {
		const result = await parseSourceSurfaceResponse(response(), options());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.artifactId).toBe("taxis:roster");
		expect(result.envelope.tree.kind).toBe("frame");
		expect(result.envelope.compilationReceipt.sourceTestimonySha256).toBe(
			VECTOR.artifact.seals.testimony_sha256,
		);
		expect(result.envelope.compilationReceipt.compilerBuildSha256).toBe(COMPILER_BUILD_SHA256);
	});

	it("fails before admission when media negotiation is not exact", async () => {
		const result = await parseSourceSurfaceResponse(
			response(VECTOR.artifact, "application/json"),
			options(),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("Content-Type");
	});

	it("reports the ordered source trust-gate class", async () => {
		const result = await parseSourceSurfaceResponse(
			response(),
			options({
				admission: { ...options().admission, expectedIssuer: "obolos" },
			}),
		);
		expect(result).toEqual({
			ok: false,
			reason: "source identity gate failed: source issuer does not match the expected issuer",
		});
	});
});

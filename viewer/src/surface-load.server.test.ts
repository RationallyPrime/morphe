import { describe, expect, it, vi } from "vitest";
import type { Node } from "$lib";
import type { Sha256 } from "$lib/artifacts/source-types.generated.js";
import type { CompilationReceipt } from "$lib/surface-edge/spec.js";
import { loadGatedSurface } from "./surface-load.server.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "./surface-reader.js";

const hash = (digit: string): Sha256 => `sha256:${digit.repeat(64)}` as Sha256;

const compilationReceipt: CompilationReceipt = {
	sourceTestimonySha256: hash("1"),
	compilerVersion: "0.3.3",
	compilerBuildSha256: hash("2"),
	grammarVersion: "0.2.0",
	treeSha256: hash("3"),
	diagnosticsSha256: hash("4"),
	temporalPolicy: "minute",
	surfaceIdGate: "exact",
};

function parsed(tree: Node, withReceipt = false) {
	return {
		ok: true as const,
		envelope: {
			artifactId: "taxis:roster",
			grammarVersion: "0.2.0",
			compilerVersion: "0.3.3",
			dialectHint: "ledger",
			tree,
			...(withReceipt ? { compilationReceipt } : {}),
		},
	};
}

describe("loadGatedSurface", () => {
	it("negotiates source-v1 and receipts the transformed tree after its exact gate", async () => {
		const fetch = vi.fn(async () => new Response("{}"));
		const result = await loadGatedSurface({
			fetch: fetch as unknown as typeof globalThis.fetch,
			url: "http://taxis.test/roster",
			artifactId: "taxis:roster",
			bearer: "secret",
			accept: SOURCE_SURFACE_V1_MEDIA_TYPE,
			parse: async () => parsed({ kind: "text", value: "before", as: "body" }, true),
			transformTree: () => ({ kind: "text", value: "after", as: "body" }),
			dialectOverride: null,
		});

		expect(fetch).toHaveBeenCalledWith(
			"http://taxis.test/roster",
			expect.objectContaining({
				headers: {
					accept: SOURCE_SURFACE_V1_MEDIA_TYPE,
					authorization: "Bearer secret",
				},
			}),
		);
		expect(result.tree).toEqual({ kind: "text", value: "after", as: "body" });
		expect(result.deliveryReceipt?.sourceTestimonySha256).toBe(
			compilationReceipt.sourceTestimonySha256,
		);
		expect(result.deliveryReceipt?.deliveredTreeSha256).not.toBe(compilationReceipt.treeSha256);
		expect(result.deliveryReceipt?.dialectId).toBe("ledger");
	});

	it("keeps application/json as the unchanged legacy default", async () => {
		const fetch = vi.fn(async () => new Response("{}"));
		const result = await loadGatedSurface({
			fetch: fetch as unknown as typeof globalThis.fetch,
			url: "http://legacy.test/surface",
			artifactId: "legacy:one",
			parse: async () => parsed({ kind: "text", value: "legacy", as: "body" }),
			dialectOverride: null,
		});
		expect(fetch).toHaveBeenCalledWith(
			"http://legacy.test/surface",
			expect.objectContaining({ headers: { accept: "application/json" } }),
		);
		expect(result.deliveryReceipt).toBeUndefined();
	});

	it("rejects a host transform that makes the exact delivered tree invalid", async () => {
		await expect(
			loadGatedSurface({
				fetch: (async () => new Response("{}")) as typeof globalThis.fetch,
				url: "http://taxis.test/roster",
				artifactId: "taxis:roster",
				parse: async () => parsed({ kind: "text", value: "valid", as: "body" }, true),
				transformTree: () => ({ kind: "invented" }) as unknown as Node,
				dialectOverride: null,
			}),
		).rejects.toMatchObject({
			status: 502,
			body: { code: "invalid-artifact", artifactId: "taxis:roster" },
		});
	});

	it("maps an upstream mid-body read failure to the controlled 502 path", async () => {
		await expect(
			loadGatedSurface({
				fetch: (async () => new Response("{}")) as typeof globalThis.fetch,
				url: "http://taxis.test/roster",
				artifactId: "taxis:roster",
				parse: async () => {
					throw new Error("upstream reset");
				},
				dialectOverride: null,
			}),
		).rejects.toMatchObject({
			status: 502,
			body: { code: "upstream-unreachable", artifactId: "taxis:roster" },
		});
	});
});

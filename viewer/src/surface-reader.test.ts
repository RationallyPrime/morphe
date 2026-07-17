import { describe, expect, it } from "vitest";
import { readSourceSurfaceResponse, SOURCE_SURFACE_V1_MEDIA_TYPE } from "./surface-reader.js";

describe("readSourceSurfaceResponse", () => {
	it("preserves exact raw JSON under the source-v1 media type", async () => {
		const rawJson = '{"number":9007199254740992}';
		const result = await readSourceSurfaceResponse(
			new Response(rawJson, { headers: { "content-type": SOURCE_SURFACE_V1_MEDIA_TYPE } }),
		);
		expect(result).toEqual({ ok: true, rawJson });
	});

	it.each([
		undefined,
		"application/json",
		`${SOURCE_SURFACE_V1_MEDIA_TYPE};charset=utf-8`,
		"application/vnd.morphe.source-surface+json;v=2",
	])("rejects a non-exact Content-Type (%s)", async (contentType) => {
		const headers = contentType === undefined ? undefined : { "content-type": contentType };
		const result = await readSourceSurfaceResponse(new Response("{}", { headers }));
		expect(result.ok).toBe(false);
	});

	it("bounds the declared response before reading", async () => {
		const result = await readSourceSurfaceResponse(
			new Response("{}", {
				headers: {
					"content-type": SOURCE_SURFACE_V1_MEDIA_TYPE,
					"content-length": String(2 * 1024 * 1024 + 1),
				},
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toContain("exceeds");
	});

	it("rejects malformed UTF-8", async () => {
		const result = await readSourceSurfaceResponse(
			new Response(Uint8Array.from([0xc3, 0x28]), {
				headers: { "content-type": SOURCE_SURFACE_V1_MEDIA_TYPE },
			}),
		);
		expect(result).toEqual({ ok: false, reason: "source response is not valid UTF-8" });
	});
});

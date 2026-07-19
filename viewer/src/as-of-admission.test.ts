import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { admitSourceSurfaceJson } from "$lib/surface-edge/source.js";
import { forwardedRequest } from "./forward-query.js";

/*
 * KRA-789 point 7: `as_of` is an ORDINARY presentation param on the public edge, and it
 * must flow the SAME admitted path the KRA-776 family-mode gate already handles.
 *
 * Two halves, proven against the shipped cross-language vector (no re-signing — only the
 * caller's pin/mode options vary, exactly as the route decides them):
 *  1. forwarding `as_of` makes the request DERIVED, which is the single bit the pane route
 *     reads to select `surfaceIdMatch: "family"`; and
 *  2. under family mode a kernel that resolved `as_of` to a DIFFERENT window instance in the
 *     same `<source>.<pane>` family is admitted, while exact mode (a pin with no as_of)
 *     still hard-fails it. The admitted family-canonical id carries the resolved window.
 */

interface GoldenVector {
	readonly artifact: unknown;
	readonly public_key_base64url: string;
}

const VECTOR = JSON.parse(
	readFileSync(
		new URL("../../fixtures/source-surface/source-surface-v1.ed25519-vector.json", import.meta.url),
		"utf8",
	),
) as GoldenVector;

// The kernel resolved `as_of` to W29 (the vector's own id); the PIN the request was made
// through named a different resolved window (W28) — a same-family, different-instance id.
const PIN = "taxis.roster:westfjords:2026-W28";
const RESOLVED = "taxis.roster:westfjords:2026-W29";

function admissionOptions(overrides: Record<string, unknown> = {}) {
	return {
		expectedIssuer: "taxis",
		expectedSurfaceId: PIN,
		publicKeys: { taxis: { "taxis-fixture-2026-01": VECTOR.public_key_base64url } },
		now: () => new Date("2026-07-17T12:10:00Z"),
		freshness: { maxAgeMs: 60 * 60 * 1_000 },
		...overrides,
	} as Parameters<typeof admitSourceSurfaceJson>[1];
}

describe("as_of drill-through admission (KRA-789 §7)", () => {
	it("forwarding as_of flips the request to a DERIVED instance (selects family mode)", () => {
		const withAsOf = forwardedRequest(
			"/orgs/1/surfaces/roster",
			new URLSearchParams({ as_of: "2026-07-08" }),
		);
		expect(withAsOf.derived).toBe(true);
		expect(withAsOf.path).toContain("as_of=2026-07-08");

		// No as_of selected = today's behavior: not derived, exact identity gate.
		expect(forwardedRequest("/orgs/1/surfaces/roster", new URLSearchParams()).derived).toBe(false);
	});

	it("family mode admits the as_of-resolved window instance; exact mode rejects it", async () => {
		const family = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			admissionOptions({ surfaceIdMatch: "family" }),
		);
		expect(family.ok).toBe(true);
		if (family.ok) {
			expect(family.value.surface_id).toBe(RESOLVED);
			expect(family.value.surfaceIdGate).toBe("family");
		}

		const exact = await admitSourceSurfaceJson(
			JSON.stringify(VECTOR.artifact),
			admissionOptions({ surfaceIdMatch: "exact" }),
		);
		expect(exact.ok).toBe(false);
		if (!exact.ok) expect(exact.issue.code).toBe("identity");
	});
});

import { describe, expect, it } from "vitest";
import { forwardedRequest, withForwardedQuery } from "./forward-query.js";

// The pane route strips `dialect` (render-only) and forwards the rest of the
// viewer query onto the kernel fetch, so a filter that survived the link
// rewrite (`?party_id=…`) actually reaches the producer. See links.test.ts for
// the survives-the-rewrite half.
describe("withForwardedQuery", () => {
	it("is a no-op when nothing is forwarded", () => {
		expect(withForwardedQuery("/orgs/1/surfaces/obligations", new URLSearchParams())).toBe(
			"/orgs/1/surfaces/obligations",
		);
	});

	it("appends a forwarded filter onto a query-less path", () => {
		expect(
			withForwardedQuery("/orgs/1/surfaces/obligations", new URLSearchParams({ party_id: "p-7" })),
		).toBe("/orgs/1/surfaces/obligations?party_id=p-7");
	});

	it("merges onto a path that already carries a declared query", () => {
		const forwarded = withForwardedQuery(
			"/orgs/1/surfaces/finality?window_start=2026-07-13",
			new URLSearchParams({ party_id: "p-7" }),
		);
		const params = new URL(`http://x${forwarded}`).searchParams;
		expect(params.get("window_start")).toBe("2026-07-13");
		expect(params.get("party_id")).toBe("p-7");
	});

	it("lets a forwarded value win over a same-named declared one", () => {
		expect(withForwardedQuery("/x?party_id=old", new URLSearchParams({ party_id: "new" }))).toBe(
			"/x?party_id=new",
		);
	});
});

// `derived` is the family-mode trigger (KRA-776): true only when forwarding actually
// changes the request away from the pinned/declared instance. It is decided here at
// request construction, never inferred from the artifact.
describe("forwardedRequest derived detection", () => {
	it("is not derived when nothing is forwarded", () => {
		const result = forwardedRequest("/orgs/1/surfaces/obligations", new URLSearchParams());
		expect(result).toEqual({ path: "/orgs/1/surfaces/obligations", derived: false });
	});

	it("is derived when a filter is appended onto a query-less path", () => {
		const result = forwardedRequest(
			"/orgs/1/surfaces/obligations",
			new URLSearchParams({ party_id: "p-7" }),
		);
		expect(result).toEqual({
			path: "/orgs/1/surfaces/obligations?party_id=p-7",
			derived: true,
		});
	});

	it("is derived when a forwarded value overrides a same-named declared one", () => {
		const result = forwardedRequest("/x?party_id=old", new URLSearchParams({ party_id: "new" }));
		expect(result).toEqual({ path: "/x?party_id=new", derived: true });
	});

	it("is NOT derived when a forwarded param only restates a declared value", () => {
		// The effective request is still the pinned instance, so it stays exact-gated.
		const result = forwardedRequest(
			"/orgs/1/surfaces/finality?window_start=2026-07-13",
			new URLSearchParams({ window_start: "2026-07-13" }),
		);
		expect(result.derived).toBe(false);
	});

	it("is derived when a new key merges onto a path that already carries a declared query", () => {
		const result = forwardedRequest(
			"/orgs/1/surfaces/finality?window_start=2026-07-13",
			new URLSearchParams({ party_id: "p-7" }),
		);
		expect(result.derived).toBe(true);
		const params = new URL(`http://x${result.path}`).searchParams;
		expect(params.get("window_start")).toBe("2026-07-13");
		expect(params.get("party_id")).toBe("p-7");
	});
});

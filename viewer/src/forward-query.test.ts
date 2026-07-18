import { describe, expect, it } from "vitest";
import { withForwardedQuery } from "./forward-query.js";

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

import { describe, expect, it } from "vitest";
import {
	forwardedRequest,
	normalizeViewerQuery,
	withForwardedQuery,
	withoutGovernedParams,
} from "./forward-query.js";

describe("normalizeViewerQuery", () => {
	it("uses one last-value-wins identity for duplicate parameters", () => {
		const raw = new URLSearchParams("as_of=A&worker_id=first&as_of=B&worker_id=last");
		const normalized = normalizeViewerQuery(raw);
		expect(normalized.getAll("as_of")).toEqual(["B"]);
		expect(normalized.getAll("worker_id")).toEqual(["last"]);
		expect(raw.getAll("as_of")).toEqual(["A", "B"]);
	});
});

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

// Governed-read selectors must never leave the public edge: the strip happens
// before forwarding, at the same choke point every filter passes, so neither a
// hand-typed `?include_pii=true` nor a link-carried one reaches the producer.
describe("withoutGovernedParams", () => {
	it("strips a governed key including repeated values", () => {
		const cleaned = withoutGovernedParams(
			new URLSearchParams("include_pii=true&include_pii=1&party_id=p-7"),
			["include_pii"],
		);
		expect(cleaned.toString()).toBe("party_id=p-7");
	});

	it("strips a percent-encoded spelling of a governed key", () => {
		// URLSearchParams decodes `%69nclude_pii` to `include_pii` at parse time,
		// so the encoded spelling cannot smuggle the param past the strip.
		const cleaned = withoutGovernedParams(new URLSearchParams("%69nclude_pii=true"), [
			"include_pii",
		]);
		expect(cleaned.toString()).toBe("");
	});

	it("leaves non-governed filters untouched with an empty deny list", () => {
		const cleaned = withoutGovernedParams(new URLSearchParams("party_id=p-7&week=2026-W25"), []);
		expect(cleaned.toString()).toBe("party_id=p-7&week=2026-W25");
	});

	it("does not mutate the input params", () => {
		const original = new URLSearchParams("include_pii=true&party_id=p-7");
		withoutGovernedParams(original, ["include_pii"]);
		expect(original.get("include_pii")).toBe("true");
	});
});

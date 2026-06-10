/**
 * GLOBAL ACTIVE DIALECT tests (Lemma 4) — the app-wide τ_frame selection.
 *
 * The active dialect is global state, not a value hardcoded per page. These pin
 * the store's contract:
 *
 *   A1  It DEFAULTS to `DEFAULT_DIALECT` (the server renders this; SSR-safe).
 *   A2  `set` and `setById` move the selection; `id`/`current` reflect it.
 *   A3  `setById` with an UNKNOWN id is a NO-OP — never a silent reset to the
 *       default (a stale persisted id must leave the current selection intact).
 *   A4  The registry ships all FOUR global dialects, so the toggle's list and
 *       the persisted-id guard agree with what is selectable.
 *
 * Each test restores the default afterward so module-level state does not leak
 * between cases (the store is a singleton by design).
 */

import { afterEach, describe, expect, it } from "vitest";
import { activeDialect } from "./active.svelte.js";
import { clinical } from "./clinical.js";
import { DEFAULT_DIALECT } from "./icelandic-archive.js";
import { DIALECT_IDS, DIALECTS } from "./registry.js";
import { reykjavikRegistry } from "./reykjavik-registry.js";
import { timaeus } from "./timaeus.js";

afterEach(() => {
	activeDialect.set(DEFAULT_DIALECT);
});

describe("A1 — the global active dialect defaults to DEFAULT_DIALECT", () => {
	it("starts at the default dialect", () => {
		expect(activeDialect.current).toBe(DEFAULT_DIALECT);
		expect(activeDialect.id).toBe(DEFAULT_DIALECT.id);
	});
});

describe("A2 — set / setById move the selection and reflect it back", () => {
	it("set(d) makes d current", () => {
		activeDialect.set(clinical);
		expect(activeDialect.current).toBe(clinical);
		expect(activeDialect.id).toBe("clinical");
	});

	it("setById(id) resolves a known id", () => {
		activeDialect.setById("reykjavik-registry");
		expect(activeDialect.current).toBe(reykjavikRegistry);
		expect(activeDialect.id).toBe("reykjavik-registry");
	});
});

describe("A3 — setById with an unknown id is a no-op (not a reset)", () => {
	it("leaves the current selection intact for an unknown id", () => {
		activeDialect.set(clinical);
		activeDialect.setById("does-not-exist");
		// Unchanged — NOT reset to the default.
		expect(activeDialect.current).toBe(clinical);
		expect(activeDialect.id).toBe("clinical");
	});
});

describe("A4 — the registry contains all four global dialects", () => {
	it("ships icelandic-archive, clinical, reykjavik-registry and timaeus", () => {
		expect(DIALECT_IDS).toEqual(["icelandic-archive", "clinical", "reykjavik-registry", "timaeus"]);
		expect(DIALECTS["icelandic-archive"]).toBe(DEFAULT_DIALECT);
		expect(DIALECTS.clinical).toBe(clinical);
		expect(DIALECTS["reykjavik-registry"]).toBe(reykjavikRegistry);
		expect(DIALECTS.timaeus).toBe(timaeus);
	});
});

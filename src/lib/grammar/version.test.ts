import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAMMAR_VERSION } from "./version.js";

describe("GRAMMAR_VERSION parity", () => {
	it("matches the Python compiler's stamped GRAMMAR_VERSION", () => {
		const compilePy = readFileSync(resolve(process.cwd(), "py/morphe_surface/compile.py"), "utf-8");
		const match = compilePy.match(/^GRAMMAR_VERSION\s*=\s*"([^"]+)"/m);
		expect(match?.[1]).toBe(GRAMMAR_VERSION);
	});

	it("matches the CMS validation gate's GRAMMAR_VERSION", () => {
		const gatePy = readFileSync(
			resolve(process.cwd(), "py/morphe_cms/validation/gate.py"),
			"utf-8",
		);
		const match = gatePy.match(/^GRAMMAR_VERSION\s*=\s*"([^"]+)"/m);
		expect(match?.[1]).toBe(GRAMMAR_VERSION);
	});
});

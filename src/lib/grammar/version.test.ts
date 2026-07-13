import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAMMAR_VERSION } from "./version.js";

describe("GRAMMAR_VERSION parity", () => {
	it("is generated from the authoritative Python grammar version", () => {
		const versionPy = readFileSync(resolve(process.cwd(), "py/morphe_grammar/version.py"), "utf-8");
		const match = versionPy.match(/^GRAMMAR_VERSION:\s*Final\s*=\s*"([^"]+)"/m);
		expect(match?.[1]).toBe(GRAMMAR_VERSION);
	});
});

/*
 * Magic-link tokens — mint/verify round-trips, tamper resistance, the two-tier
 * expiry semantics (page entry enforces TTL, intake submit ignores it), and the
 * unconfigured fail-open contract from ADR-0001.
 */

import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMagicToken,
	MAGIC_LINK_TTL_MS,
	magicLinkConfigured,
	verifyMagicToken,
} from "./magic-link.js";

const mockEnv = vi.hoisted((): Record<string, string | undefined> => ({}));

vi.mock("$env/dynamic/private", () => ({ env: mockEnv }));

const EMAIL = "jon@example.is";
const T0 = 1_750_000_000_000;

beforeEach(() => {
	for (const key of Object.keys(mockEnv)) delete mockEnv[key];
});

describe("unconfigured gate", () => {
	it("reports unconfigured and returns null from mint and verify", () => {
		expect(magicLinkConfigured()).toBe(false);
		expect(createMagicToken(EMAIL, T0)).toBeNull();
		expect(verifyMagicToken("whatever.sig")).toBeNull();
	});
});

describe("configured gate", () => {
	beforeEach(() => {
		mockEnv.MAGIC_LINK_SECRET = "test-secret";
	});

	it("round-trips a fresh token back to the email", () => {
		const token = createMagicToken(EMAIL, T0);
		expect(token).not.toBeNull();
		expect(verifyMagicToken(token as string, { now: T0 })).toEqual({
			valid: true,
			email: EMAIL,
		});
	});

	it("expires exactly past the TTL, but submit-mode (ignoreExpiry) still accepts", () => {
		const token = createMagicToken(EMAIL, T0) as string;
		const justInside = T0 + MAGIC_LINK_TTL_MS;
		const justPast = T0 + MAGIC_LINK_TTL_MS + 1;

		expect(verifyMagicToken(token, { now: justInside })).toEqual({ valid: true, email: EMAIL });
		expect(verifyMagicToken(token, { now: justPast })).toEqual({
			valid: false,
			reason: "expired",
		});
		expect(verifyMagicToken(token, { now: justPast, ignoreExpiry: true })).toEqual({
			valid: true,
			email: EMAIL,
		});
	});

	it("rejects a tampered payload (signature no longer matches)", () => {
		const token = createMagicToken(EMAIL, T0) as string;
		const [, sig] = token.split(".") as [string, string];
		const forgedPayload = Buffer.from(
			JSON.stringify({ email: "attacker@evil.example", exp: T0 + MAGIC_LINK_TTL_MS }),
			"utf8",
		).toString("base64url");

		expect(verifyMagicToken(`${forgedPayload}.${sig}`, { now: T0 })).toEqual({
			valid: false,
			reason: "invalid",
		});
	});

	it("rejects a tampered signature", () => {
		const token = createMagicToken(EMAIL, T0) as string;
		const [body] = token.split(".") as [string, string];
		expect(verifyMagicToken(`${body}.AAAA`, { now: T0 })).toEqual({
			valid: false,
			reason: "invalid",
		});
	});

	it("rejects tokens minted under a different secret", () => {
		const token = createMagicToken(EMAIL, T0) as string;
		mockEnv.MAGIC_LINK_SECRET = "rotated-secret";
		expect(verifyMagicToken(token, { now: T0 })).toEqual({ valid: false, reason: "invalid" });
	});

	it.each([
		"",
		"no-dot",
		".leading",
		"trailing.",
		"not-base64.!!!",
		"a.b.c",
	])("rejects malformed token %j without throwing", (garbage) => {
		expect(verifyMagicToken(garbage, { now: T0 })).toEqual({
			valid: false,
			reason: "invalid",
		});
	});

	it("rejects a well-signed payload that is not the expected shape", () => {
		const payload = JSON.stringify({ nope: true });
		const body = Buffer.from(payload, "utf8").toString("base64url");
		const sig = createHmac("sha256", "test-secret").update(payload).digest("base64url");
		expect(verifyMagicToken(`${body}.${sig}`, { now: T0 })).toEqual({
			valid: false,
			reason: "invalid",
		});
	});
});

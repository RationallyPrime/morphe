/*
 * Stateless magic-link tokens for the /onboarding gate (ADR-0001). A token is
 * HMAC-SHA256(secret, payload) where payload = JSON { email, exp }, encoded as
 * `base64url(payload).base64url(sig)`. No session store, no database: the
 * signature alone proves this server minted the token for that email.
 *
 * Verification is two-tier on purpose:
 *   - Page entry checks signature AND expiry (a stale link must not open the gate).
 *   - Intake submit checks signature only (ignoreExpiry) — filling the form can
 *     legitimately outlast the TTL, and the signature already proves the email
 *     was verified once.
 *
 * Env: MAGIC_LINK_SECRET (server-only). Absent → the gate is unconfigured and
 * callers degrade per ADR-0001 §3 (fail open; never an error surface).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";

/** How long an emailed link opens the gate. */
export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000;

export type MagicVerification =
	| { readonly valid: true; readonly email: string }
	| { readonly valid: false; readonly reason: "expired" | "invalid" };

interface TokenPayload {
	readonly email: string;
	readonly exp: number;
}

/** True when MAGIC_LINK_SECRET is set — i.e. the gate is active. */
export function magicLinkConfigured(): boolean {
	return typeof env.MAGIC_LINK_SECRET === "string" && env.MAGIC_LINK_SECRET.length > 0;
}

function sign(secret: string, payload: string): Buffer {
	return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Mint a token for an email address, expiring MAGIC_LINK_TTL_MS from now.
 * Returns null when the gate is not configured.
 */
export function createMagicToken(email: string, now: number = Date.now()): string | null {
	const secret = env.MAGIC_LINK_SECRET;
	if (!secret) return null;

	const payload = JSON.stringify({ email, exp: now + MAGIC_LINK_TTL_MS } satisfies TokenPayload);
	const body = Buffer.from(payload, "utf8").toString("base64url");
	const sig = sign(secret, payload).toString("base64url");
	return `${body}.${sig}`;
}

/**
 * Verify a token. Returns null when the gate is not configured (callers fail
 * open per ADR-0001); otherwise an honest verdict. With ignoreExpiry the
 * signature is still required — only the time check is waived.
 */
export function verifyMagicToken(
	token: string,
	opts: { ignoreExpiry?: boolean; now?: number } = {},
): MagicVerification | null {
	const secret = env.MAGIC_LINK_SECRET;
	if (!secret) return null;

	const dot = token.indexOf(".");
	if (dot <= 0 || dot === token.length - 1) return { valid: false, reason: "invalid" };

	let payload: string;
	let givenSig: Buffer;
	try {
		payload = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
		givenSig = Buffer.from(token.slice(dot + 1), "base64url");
	} catch {
		return { valid: false, reason: "invalid" };
	}

	const expectedSig = sign(secret, payload);
	if (givenSig.length !== expectedSig.length || !timingSafeEqual(givenSig, expectedSig)) {
		return { valid: false, reason: "invalid" };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch {
		return { valid: false, reason: "invalid" };
	}
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		typeof (parsed as TokenPayload).email !== "string" ||
		typeof (parsed as TokenPayload).exp !== "number"
	) {
		return { valid: false, reason: "invalid" };
	}

	const { email, exp } = parsed as TokenPayload;
	if (!opts.ignoreExpiry && (opts.now ?? Date.now()) > exp) {
		return { valid: false, reason: "expired" };
	}
	return { valid: true, email };
}

/*
 * /onboarding gate (ADR-0001). Three states, decided per request from the
 * stateless token in ?token=:
 *   open    — MAGIC_LINK_SECRET absent: the gate is unconfigured and fails
 *             open (the surface never shows an error).
 *   granted — a valid, unexpired token: render the intake, prefill the email.
 *   locked  — no token, or expired/invalid: render the email-capture gate.
 */

import { magicLinkConfigured, verifyMagicToken } from "$lib/server/magic-link";
import type { PageServerLoad } from "./$types";

export interface GateData {
	gate: "open" | "granted" | "locked";
	email: string | null;
	token: string | null;
	tokenError: "expired" | "invalid" | null;
}

export const load: PageServerLoad = ({ url }): GateData => {
	if (!magicLinkConfigured()) {
		return { gate: "open", email: null, token: null, tokenError: null };
	}

	const token = url.searchParams.get("token");
	if (token) {
		const verdict = verifyMagicToken(token);
		if (verdict?.valid) {
			return { gate: "granted", email: verdict.email, token, tokenError: null };
		}
		return {
			gate: "locked",
			email: null,
			token: null,
			tokenError: verdict && !verdict.valid ? verdict.reason : null,
		};
	}

	return { gate: "locked", email: null, token: null, tokenError: null };
};

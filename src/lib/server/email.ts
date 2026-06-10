/*
 * Postmark transactional email — the one place the site talks to Postmark.
 * Server-only. Two callers: founder alerts ($lib/server/notify) and the
 * magic-link email to a visitor (/api/onboarding/request-link).
 *
 * Env (optional; absence is reported as null, never thrown):
 *   POSTMARK_SERVER_TOKEN — Postmark server API token; without it, no email
 *   SOKRATES_EMAIL_FROM   — sender, defaults to no-reply@sokrates.is
 *                           (must be on the Postmark-verified domain)
 */

import { env } from "$env/dynamic/private";

export interface OutboundEmail {
	readonly to: string;
	readonly subject: string;
	readonly textBody: string;
	/** Where a reply in the recipient's mail client should go. */
	readonly replyTo?: string;
}

/** null = Postmark not configured; otherwise an honest per-send outcome. */
export type EmailResult =
	| { readonly sent: true }
	| { readonly sent: false; readonly reason: string };

const POSTMARK_API = "https://api.postmarkapp.com/email";
const DEFAULT_FROM = "no-reply@sokrates.is";

export function emailConfigured(): boolean {
	return typeof env.POSTMARK_SERVER_TOKEN === "string" && env.POSTMARK_SERVER_TOKEN.length > 0;
}

export async function sendTransactionalEmail(mail: OutboundEmail): Promise<EmailResult | null> {
	const token = env.POSTMARK_SERVER_TOKEN;
	if (!token) return null;

	try {
		const res = await fetch(POSTMARK_API, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"X-Postmark-Server-Token": token,
			},
			body: JSON.stringify({
				From: env.SOKRATES_EMAIL_FROM ?? DEFAULT_FROM,
				To: mail.to,
				Subject: mail.subject,
				TextBody: mail.textBody,
				...(mail.replyTo ? { ReplyTo: mail.replyTo } : {}),
				MessageStream: "outbound",
			}),
		});
		if (!res.ok) return { sent: false, reason: `postmark-${res.status}` };
		return { sent: true };
	} catch {
		return { sent: false, reason: "postmark-network" };
	}
}

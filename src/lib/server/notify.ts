/*
 * Founder alerts — the one outbound notification path the marketing site uses
 * (contact leads + onboarding submissions). Server-only: it reads tokens from
 * private env and never exposes them to the client.
 *
 * Two channels fan out from the single seam, each independently optional:
 *   - Postmark email to the founder inbox, Reply-To set to the lead so a reply
 *     goes straight back to them.
 *   - ntfy push for the phone.
 * The alert is DELIVERED when at least one configured channel accepts it.
 *
 * Delivery is best-effort and HONEST: the caller learns whether it was delivered
 * so the UI can offer a mailto fallback rather than silently swallow a lead. No
 * customer auto-reply is ever sent from here — the founder replies by hand.
 *
 * Env (all optional):
 *   POSTMARK_SERVER_TOKEN         — Postmark server API token; without it, no email
 *   SOKRATES_EMAIL_FROM           — sender, defaults to no-reply@sokrates.is
 *                                   (must be on the Postmark-verified domain)
 *   SOKRATES_EMAIL_TO             — recipient, defaults to hakon@sokrates.is
 *   SOKRATES_ALERT_NTFY_TOPIC     — the ntfy topic; without it, no push
 *   SOKRATES_ALERT_NTFY_TOKEN     — bearer token for a protected topic
 *   SOKRATES_ALERT_NTFY_BASE_URL  — defaults to https://ntfy.sh
 *   SOKRATES_ALERT_NTFY_EMAIL     — optional ntfy email-bridge recipient
 */

import { env } from "$env/dynamic/private";

export interface FounderAlert {
	/** Email subject / ntfy notification title. */
	readonly title: string;
	/** Plain-text body. */
	readonly body: string;
	/** Optional reply-to email: Reply-To on the Postmark mail, email bridge on ntfy. */
	readonly email?: string;
	/** ntfy priority; defaults to "high". */
	readonly priority?: "min" | "low" | "default" | "high" | "max";
}

export interface DeliveryResult {
	readonly delivered: boolean;
	readonly reason?: string;
}

/** Per-channel outcome; null means the channel is not configured. */
type ChannelResult = { delivered: true } | { delivered: false; reason: string } | null;

const POSTMARK_API = "https://api.postmarkapp.com/email";
const DEFAULT_FROM = "no-reply@sokrates.is";
const DEFAULT_TO = "hakon@sokrates.is";

async function sendPostmarkEmail(alert: FounderAlert): Promise<ChannelResult> {
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
				To: env.SOKRATES_EMAIL_TO ?? DEFAULT_TO,
				Subject: alert.title,
				TextBody: alert.body,
				...(alert.email ? { ReplyTo: alert.email } : {}),
				MessageStream: "outbound",
			}),
		});
		if (!res.ok) return { delivered: false, reason: `postmark-${res.status}` };
		return { delivered: true };
	} catch {
		return { delivered: false, reason: "postmark-network" };
	}
}

async function sendNtfyPush(alert: FounderAlert): Promise<ChannelResult> {
	const topic = env.SOKRATES_ALERT_NTFY_TOPIC;
	if (!topic) return null;

	const base = env.SOKRATES_ALERT_NTFY_BASE_URL ?? "https://ntfy.sh";
	const token = env.SOKRATES_ALERT_NTFY_TOKEN;
	const bridgeEmail = env.SOKRATES_ALERT_NTFY_EMAIL;

	const headers: Record<string, string> = {
		"Content-Type": "text/plain; charset=utf-8",
		Title: alert.title,
		Priority: alert.priority ?? "high",
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	if (bridgeEmail) headers.Email = bridgeEmail;

	try {
		const res = await fetch(`${base.replace(/\/$/, "")}/${topic}`, {
			method: "POST",
			headers,
			body: alert.body,
		});
		if (!res.ok) return { delivered: false, reason: `ntfy-${res.status}` };
		return { delivered: true };
	} catch {
		return { delivered: false, reason: "ntfy-network" };
	}
}

export async function sendFounderAlert(alert: FounderAlert): Promise<DeliveryResult> {
	const results = (await Promise.all([sendPostmarkEmail(alert), sendNtfyPush(alert)])).filter(
		(r): r is NonNullable<ChannelResult> => r !== null,
	);

	if (results.length === 0) return { delivered: false, reason: "not-configured" };
	if (results.some((r) => r.delivered)) return { delivered: true };
	return {
		delivered: false,
		reason: results.flatMap((r) => (r.delivered ? [] : [r.reason])).join("+"),
	};
}

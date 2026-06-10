/*
 * Founder alerts over ntfy — the one outbound notification path the marketing
 * site uses (contact leads + onboarding submissions). Server-only: it reads the
 * topic/token from private env and never exposes them to the client.
 *
 * Delivery is best-effort and HONEST: the caller learns whether it was delivered
 * so the UI can offer a mailto fallback rather than silently swallow a lead. No
 * customer auto-reply is ever sent from here — the founder replies by hand.
 *
 * Env (all optional):
 *   SOKRATES_ALERT_NTFY_TOPIC     — the topic; without it, nothing is delivered
 *   SOKRATES_ALERT_NTFY_TOKEN     — bearer token for a protected topic
 *   SOKRATES_ALERT_NTFY_BASE_URL  — defaults to https://ntfy.sh
 *   SOKRATES_ALERT_NTFY_EMAIL     — optional email-bridge recipient
 */

import { env } from "$env/dynamic/private";

export interface FounderAlert {
	/** The ntfy notification title. */
	readonly title: string;
	/** Plain-text body. */
	readonly body: string;
	/** Optional reply-to email, surfaced via the ntfy email bridge when configured. */
	readonly email?: string;
	/** ntfy priority; defaults to "high". */
	readonly priority?: "min" | "low" | "default" | "high" | "max";
}

export interface DeliveryResult {
	readonly delivered: boolean;
	readonly reason?: string;
}

export async function sendFounderAlert(alert: FounderAlert): Promise<DeliveryResult> {
	const topic = env.SOKRATES_ALERT_NTFY_TOPIC;
	if (!topic) return { delivered: false, reason: "not-configured" };

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
		return { delivered: false, reason: "network" };
	}
}

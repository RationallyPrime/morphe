/*
 * POST /api/onboarding/request-link — the gate's front door (ADR-0001). Takes a
 * visitor email, mints a stateless magic token, and emails the link to the
 * VISITOR (the one outbound mail on this site that goes to someone other than
 * the founder). Reply-To is the founder, so a confused "what is this?" reply
 * lands with a human. A founder "onboarding started" alert rides along
 * best-effort — its failure never blocks the visitor's link.
 *
 * 503 not-configured when MAGIC_LINK_SECRET or Postmark env is absent, so the
 * gate screen can degrade to the open conversation path instead of erroring.
 */

import { json } from "@sveltejs/kit";
import { emailConfigured, sendTransactionalEmail } from "$lib/server/email";
import { createMagicToken, MAGIC_LINK_TTL_MS, magicLinkConfigured } from "$lib/server/magic-link";
import { sendFounderAlert } from "$lib/server/notify";
import type { RequestHandler } from "./$types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOUNDER_EMAIL = "hakon@sokrates.is";
const TTL_MINUTES = Math.round(MAGIC_LINK_TTL_MS / 60_000);

interface RequestLinkBody {
	email?: unknown;
	company_url?: unknown; // honeypot — must stay empty
}

export const POST: RequestHandler = async ({ request, url }) => {
	let body: RequestLinkBody;
	try {
		body = (await request.json()) as RequestLinkBody;
	} catch {
		return json({ ok: false, error: "invalid-body" }, { status: 400 });
	}

	// Honeypot: a filled hidden field is a bot. Accept and drop silently.
	if (typeof body.company_url === "string" && body.company_url.trim().length > 0) {
		return json({ ok: true });
	}

	const email = typeof body.email === "string" ? body.email.trim() : "";
	if (!EMAIL_RE.test(email)) {
		return json({ ok: false, error: "invalid-email" }, { status: 422 });
	}

	if (!magicLinkConfigured() || !emailConfigured()) {
		return json({ ok: false, error: "not-configured" }, { status: 503 });
	}

	const token = createMagicToken(email);
	if (token === null) {
		return json({ ok: false, error: "not-configured" }, { status: 503 });
	}

	const link = `${url.origin}/onboarding?token=${encodeURIComponent(token)}`;
	const textBody = [
		"Here is your onboarding link:",
		"",
		link,
		"",
		`It is good for ${TTL_MINUTES} minutes and opens the guided intake. Your`,
		"draft saves as you go, so you can stop and come back.",
		"",
		"If you did not request this, ignore this email — nothing happens without",
		"the link.",
		"",
		"— Sókrates",
	].join("\n");

	// The visitor's link is the critical path; the founder ping is best-effort
	// and must never block or fail the response.
	const [mail] = await Promise.all([
		sendTransactionalEmail({
			to: email,
			subject: "Your Sókrates onboarding link",
			textBody,
			replyTo: FOUNDER_EMAIL,
		}),
		sendFounderAlert({
			title: "Sókrates onboarding started",
			body: `${email} requested an onboarding link.`,
			email,
		}),
	]);

	if (mail === null) {
		return json({ ok: false, error: "not-configured" }, { status: 503 });
	}
	if (!mail.sent) {
		return json({ ok: false, error: mail.reason }, { status: 503 });
	}
	return json({ ok: true });
};

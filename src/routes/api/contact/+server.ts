/*
 * POST /api/contact — a marketing lead. Validates server-side, drops bots via a
 * honeypot, and notifies the founder (Postmark email + ntfy push; see
 * $lib/server/notify for the channel env). There is NO customer auto-reply:
 * Hákon replies by hand. The payload never leaves for anywhere but the
 * founder's inbox/topic.
 *
 * When no channel is configured (or all fail) the route returns 503 so the form
 * can show a mailto fallback — a lead is never silently dropped.
 */

import { json } from "@sveltejs/kit";
import { sendFounderAlert } from "$lib/server/notify";
import type { RequestHandler } from "./$types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactBody {
	name?: unknown;
	email?: unknown;
	operation?: unknown;
	company_url?: unknown; // honeypot — must stay empty
}

export const POST: RequestHandler = async ({ request }) => {
	let body: ContactBody;
	try {
		body = (await request.json()) as ContactBody;
	} catch {
		return json({ ok: false, error: "invalid-body" }, { status: 400 });
	}

	// Honeypot: a filled hidden field is a bot. Accept and drop silently.
	if (typeof body.company_url === "string" && body.company_url.trim().length > 0) {
		return json({ ok: true });
	}

	const name = typeof body.name === "string" ? body.name.trim() : "";
	const email = typeof body.email === "string" ? body.email.trim() : "";
	const operation = typeof body.operation === "string" ? body.operation.trim() : "";

	if (!EMAIL_RE.test(email)) {
		return json({ ok: false, error: "invalid-email" }, { status: 422 });
	}
	if (operation.length < 2) {
		return json({ ok: false, error: "missing-operation" }, { status: 422 });
	}

	const lines = [
		`Name: ${name || "(not given)"}`,
		`Email: ${email}`,
		"",
		"What runs their operation today:",
		operation,
		"",
		`Reply to ${email} within 48h.`,
	];

	const result = await sendFounderAlert({
		title: "New Sókrates lead",
		body: lines.join("\n"),
		email,
	});

	if (!result.delivered) {
		// Not configured / delivery failed — tell the client so it can offer mailto.
		return json({ ok: false, error: result.reason }, { status: 503 });
	}

	return json({ ok: true });
};

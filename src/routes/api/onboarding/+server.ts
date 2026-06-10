/*
 * POST /api/onboarding — an onboarding intake submission. Formats the intake into
 * a readable brief and alerts the founder over ntfy (see $lib/server/notify). No
 * customer auto-reply; the founder follows up by hand. Returns 503 when delivery
 * is not configured / fails, so the client can offer a mailto fallback and never
 * lose an intake.
 */

import { json } from "@sveltejs/kit";
import { sendFounderAlert } from "$lib/server/notify";
import type { RequestHandler } from "./$types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OnbContact {
	name?: unknown;
	title?: unknown;
	email?: unknown;
	phone?: unknown;
	company?: unknown;
	website?: unknown;
}
interface OnbSystem {
	name?: unknown;
	vendor?: unknown;
	deployment?: unknown;
	role?: unknown;
	criticality?: unknown;
}
interface OnbBody {
	contact?: OnbContact;
	systems?: OnbSystem[];
	priorities?: { workflow?: unknown }[];
	outcomes?: unknown;
}

function str(v: unknown): string {
	return typeof v === "string" ? v.trim() : "";
}

export const POST: RequestHandler = async ({ request }) => {
	let body: OnbBody;
	try {
		body = (await request.json()) as OnbBody;
	} catch {
		return json({ ok: false, error: "invalid-body" }, { status: 400 });
	}

	const contact = body.contact ?? {};
	const email = str(contact.email);
	if (!EMAIL_RE.test(email)) {
		return json({ ok: false, error: "invalid-email" }, { status: 422 });
	}

	const company = str(contact.company);
	const systems = Array.isArray(body.systems) ? body.systems : [];
	const priorities = Array.isArray(body.priorities) ? body.priorities : [];
	const outcomes = str(body.outcomes);

	const lines: string[] = [
		`Company: ${company || "(not given)"}`,
		`Contact: ${str(contact.name) || "(not given)"}${str(contact.title) ? `, ${str(contact.title)}` : ""}`,
		`Email: ${email}`,
	];
	if (str(contact.phone)) lines.push(`Phone: ${str(contact.phone)}`);
	if (str(contact.website)) lines.push(`Website: ${str(contact.website)}`);

	lines.push("", `Systems (${systems.length}):`);
	for (const s of systems) {
		const name = str(s.name);
		if (!name) continue;
		const bits = [str(s.vendor), str(s.deployment), str(s.role), str(s.criticality)].filter(
			Boolean,
		);
		lines.push(`  • ${name}${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
	}

	const workflows = priorities.map((p) => str(p.workflow)).filter(Boolean);
	if (workflows.length > 0) {
		lines.push("", "First workflows to automate:");
		for (const w of workflows) lines.push(`  • ${w}`);
	}

	if (outcomes) {
		lines.push("", "Desired outcomes:", outcomes);
	}

	lines.push("", `Reply to ${email}.`);

	const result = await sendFounderAlert({
		title: `Sókrates onboarding: ${company || email}`,
		body: lines.join("\n"),
		email,
	});

	if (!result.delivered) {
		return json({ ok: false, error: result.reason }, { status: 503 });
	}
	return json({ ok: true });
};

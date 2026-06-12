/*
 * sendFounderAlert — channel fan-out semantics. Both channels are optional and
 * independent; the alert counts as delivered when at least one configured
 * channel accepts it, and the caller gets honest reasons when none do.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendFounderAlert } from "./notify.js";

// Mutable env backing the $env/dynamic/private mock; reset per test.
const mockEnv = vi.hoisted((): Record<string, string | undefined> => ({}));

vi.mock("$env/dynamic/private", () => ({ env: mockEnv }));

const fetchMock = vi.fn<typeof fetch>();

function clearEnv(): void {
	for (const key of Object.keys(mockEnv)) delete mockEnv[key];
}

beforeEach(() => {
	clearEnv();
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const ALERT = {
	title: "New Sókrates lead",
	body: "Name: Jón\nEmail: jon@example.is",
	email: "jon@example.is",
} as const;

function postmarkCall(): { url: string; init: RequestInit } {
	const call = fetchMock.mock.calls.find(([url]) => String(url).includes("postmarkapp.com"));
	if (!call) throw new Error("no Postmark call recorded");
	return { url: String(call[0]), init: call[1] as RequestInit };
}

describe("sendFounderAlert", () => {
	it("reports not-configured (and never fetches) when no channel has env", async () => {
		const result = await sendFounderAlert(ALERT);
		expect(result).toEqual({ delivered: false, reason: "not-configured" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("delivers via Postmark with token header, defaults, Reply-To, and outbound stream", async () => {
		mockEnv.POSTMARK_SERVER_TOKEN = "pm-secret";
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

		const result = await sendFounderAlert(ALERT);

		expect(result).toEqual({ delivered: true });
		const { url, init } = postmarkCall();
		expect(url).toBe("https://api.postmarkapp.com/email");
		expect(init.method).toBe("POST");
		expect((init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("pm-secret");
		expect(JSON.parse(String(init.body))).toEqual({
			From: "no-reply@sokrates.is",
			To: "hakon@sokrates.is",
			Subject: ALERT.title,
			TextBody: ALERT.body,
			ReplyTo: ALERT.email,
			MessageStream: "outbound",
		});
	});

	it("honours From/To env overrides and omits Reply-To when no lead email", async () => {
		mockEnv.POSTMARK_SERVER_TOKEN = "pm-secret";
		mockEnv.SOKRATES_EMAIL_FROM = "alerts@sokrates.is";
		mockEnv.SOKRATES_EMAIL_TO = "inbox@sokrates.is";
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

		await sendFounderAlert({ title: "t", body: "b" });

		const payload = JSON.parse(String(postmarkCall().init.body));
		expect(payload.From).toBe("alerts@sokrates.is");
		expect(payload.To).toBe("inbox@sokrates.is");
		expect("ReplyTo" in payload).toBe(false);
	});

	it("surfaces a Postmark rejection when it is the only channel", async () => {
		mockEnv.POSTMARK_SERVER_TOKEN = "pm-secret";
		fetchMock.mockResolvedValue(new Response("{}", { status: 422 }));

		const result = await sendFounderAlert(ALERT);
		expect(result).toEqual({ delivered: false, reason: "postmark-422" });
	});

	it("keeps the ntfy-only path working unchanged", async () => {
		mockEnv.SOKRATES_ALERT_NTFY_TOPIC = "leads";
		fetchMock.mockResolvedValue(new Response("", { status: 200 }));

		const result = await sendFounderAlert(ALERT);

		expect(result).toEqual({ delivered: true });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://ntfy.sh/leads");
		const headers = (init as RequestInit).headers as Record<string, string>;
		expect(headers.Title).toBe(ALERT.title);
		expect(headers.Priority).toBe("high");
	});

	it("delivers when Postmark fails but ntfy succeeds", async () => {
		mockEnv.POSTMARK_SERVER_TOKEN = "pm-secret";
		mockEnv.SOKRATES_ALERT_NTFY_TOPIC = "leads";
		fetchMock.mockImplementation(async (url) =>
			String(url).includes("postmarkapp.com")
				? new Response("{}", { status: 500 })
				: new Response("", { status: 200 }),
		);

		const result = await sendFounderAlert(ALERT);
		expect(result).toEqual({ delivered: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("combines reasons when every configured channel fails", async () => {
		mockEnv.POSTMARK_SERVER_TOKEN = "pm-secret";
		mockEnv.SOKRATES_ALERT_NTFY_TOPIC = "leads";
		fetchMock.mockImplementation(async (url) => {
			if (String(url).includes("postmarkapp.com")) throw new Error("dns");
			return new Response("", { status: 502 });
		});

		const result = await sendFounderAlert(ALERT);
		expect(result).toEqual({ delivered: false, reason: "postmark-network+ntfy-502" });
	});
});

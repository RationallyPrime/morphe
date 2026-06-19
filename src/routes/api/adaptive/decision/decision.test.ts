import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./+server";

const mockEnv = vi.hoisted((): Record<string, string | undefined> => ({}));

vi.mock("$env/dynamic/private", () => ({ env: mockEnv }));

const REQUEST_BODY = {
	task_state: {
		goal: "Inspect ERP exception workflow",
		lead: { company: "Northwind Controls", vertical: "industrial quality" },
	},
	event: { tier: "mid", name: "substrate.lab.requested", payload: { intent: "proof" } },
	digest: {
		summary: "Operator wants a compact, evidence-led panel.",
		signals: { risk: "medium" },
		events: [],
	},
	dialect_id: "gallery",
	surface_id: "substrate-lab",
} as const;

type PostEvent = Parameters<typeof POST>[0];

function clearEnv(): void {
	for (const key of Object.keys(mockEnv)) delete mockEnv[key];
}

async function callDecision(
	body: unknown,
	fetchMock: typeof fetch = vi.fn<typeof fetch>(),
): Promise<Response> {
	const request = new Request("http://morphe.test/api/adaptive/decision", {
		method: "POST",
		body: JSON.stringify(body),
	});
	return await POST({ request, fetch: fetchMock } as PostEvent);
}

describe("POST /api/adaptive/decision", () => {
	beforeEach(() => {
		clearEnv();
	});

	it("returns a valid fallback payload when the sidecar base URL is absent", async () => {
		const fetchMock = vi.fn<typeof fetch>();

		const response = await callDecision(REQUEST_BODY, fetchMock);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(payload.source).toBe("fallback");
		expect(payload.diagnostics).toEqual(["agent-not-configured"]);
		expect(payload.tree.kind).toBe("frame");
	});

	it("proxies configured sidecar success responses", async () => {
		mockEnv.MORPHE_AGENT_BASE_URL = "https://agent.test/";
		const livePayload = {
			source: "live",
			model: "test:function-model",
			tree: {
				kind: "stack",
				role: "section",
				children: [{ kind: "text", value: "Live adaptive panel", as: "heading" }],
			},
			diagnostics: ["ok"],
		};
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify(livePayload), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const response = await callDecision(REQUEST_BODY, fetchMock);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(livePayload);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://agent.test/v1/morphe/decision");
		expect((init as RequestInit).method).toBe("POST");
		expect(JSON.parse(String((init as RequestInit).body))).toEqual(REQUEST_BODY);
	});

	it("falls back instead of surfacing sidecar failures", async () => {
		mockEnv.MORPHE_AGENT_BASE_URL = "https://agent.test";
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response("nope", { status: 502 }));

		const response = await callDecision(REQUEST_BODY, fetchMock);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.source).toBe("fallback");
		expect(payload.diagnostics).toEqual(["agent-502"]);
		expect(payload.tree.kind).toBe("frame");
	});
});

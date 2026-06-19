import { error, json, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { Node } from "$lib";

const AGENT_TIMEOUT_MS = 4_000;

interface DecisionResponse {
	readonly source: "live" | "fallback";
	readonly model?: string;
	readonly tree: Node;
	readonly diagnostics: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function fallbackTree(body: Record<string, unknown>): Node {
	const taskState = isRecord(body.task_state) ? body.task_state : {};
	const digest = isRecord(body.digest) ? body.digest : {};
	const dialect = stringField(body, "dialect_id") ?? "gallery";
	const surface = stringField(body, "surface_id") ?? "adaptive-surface";

	return {
		kind: "frame",
		role: "panel",
		surface: "raised",
		children: [
			{
				kind: "stack",
				role: "section",
				children: [
					{
						kind: "cluster",
						role: "inline",
						align: "center",
						children: [
							{ kind: "badge", label: dialect, intent: "provenance" },
							{ kind: "badge", label: surface, intent: "evidence" },
						],
					},
					{
						kind: "text",
						value: stringField(taskState, "goal") ?? "Adaptive surface ready",
						as: "heading",
						emphasis: "strong",
					},
					{
						kind: "text",
						value:
							stringField(digest, "summary") ??
							"Morphe kept the render inside its deterministic grammar.",
						as: "body",
						emphasis: "muted",
					},
					{
						kind: "status",
						tone: "info",
						signal: { text: "Rendered by deterministic fallback" },
					},
				],
			},
		],
	};
}

function fallback(body: Record<string, unknown>, reason: string): Response {
	return json({
		source: "fallback",
		tree: fallbackTree(body),
		diagnostics: [reason],
	} satisfies DecisionResponse);
}

function isDecisionResponse(payload: unknown): payload is DecisionResponse {
	if (!isRecord(payload)) return false;
	if (payload.source !== "live" && payload.source !== "fallback") return false;
	if (!isRecord(payload.tree) || typeof payload.tree.kind !== "string") return false;
	if (!Array.isArray(payload.diagnostics)) return false;
	return payload.diagnostics.every((item) => typeof item === "string");
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: Record<string, unknown>;
	try {
		const parsed = (await request.json()) as unknown;
		if (!isRecord(parsed)) throw new Error("body must be an object");
		body = parsed;
	} catch {
		throw error(400, "invalid JSON body");
	}

	const baseUrl = env.MORPHE_AGENT_BASE_URL?.replace(/\/+$/, "");
	if (!baseUrl) return fallback(body, "agent-not-configured");

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(`${baseUrl}/v1/morphe/decision`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
	} catch {
		return fallback(body, "agent-network");
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) return fallback(body, `agent-${response.status}`);

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		return fallback(body, "agent-invalid-json");
	}
	if (!isDecisionResponse(payload)) return fallback(body, "agent-invalid-response");

	return json(payload);
};

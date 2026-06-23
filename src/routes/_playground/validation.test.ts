import { describe, expect, it } from "vitest";
import {
	LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT,
	validateLocalAdaptiveDraft,
} from "./validation.js";

const validDraft = {
	title: "Operational signal",
	summary: "A compact evidence-led panel for a local adaptive decision.",
	tone: "info",
	badges: ["local", "validated"],
	nextActionLabel: "Record review",
} as const;

describe("local adaptive draft validation", () => {
	it("accepts the bounded semantic draft used by the Prompt API exhibit", () => {
		const result = validateLocalAdaptiveDraft(validDraft);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.draft).toEqual(validDraft);
		}
	});

	it("rejects missing required fields with field diagnostics", () => {
		const result = validateLocalAdaptiveDraft({
			title: "Missing summary",
			tone: "info",
			badges: [],
			nextActionLabel: "Continue",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.join(" ")).toContain("summary");
		}
	});

	it("rejects unknown tones", () => {
		const result = validateLocalAdaptiveDraft({ ...validDraft, tone: "urgent" });

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.join(" ")).toContain("tone");
		}
	});

	it("rejects overlong labels and non-string badges", () => {
		const result = validateLocalAdaptiveDraft({
			...validDraft,
			nextActionLabel: "This label is intentionally much longer than the native control can carry",
			badges: ["ok", 42],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			const diagnostics = result.diagnostics.join(" ");
			expect(diagnostics).toContain("nextActionLabel");
			expect(diagnostics).toContain("badges.1");
		}
	});

	it("exports the same bounded object shape as the response constraint", () => {
		expect(LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT).toMatchObject({
			type: "object",
			additionalProperties: false,
			required: ["title", "summary", "tone", "badges", "nextActionLabel"],
		});
	});
});

import { z } from "zod";

const shortText = z.string().trim().min(1).max(48);
const summaryText = z.string().trim().min(1).max(220);
const badgeText = z.string().trim().min(1).max(24);

export const LOCAL_ADAPTIVE_DRAFT_RESPONSE_CONSTRAINT = Object.freeze({
	type: "object",
	additionalProperties: false,
	properties: {
		title: { type: "string", minLength: 1, maxLength: 48 },
		summary: { type: "string", minLength: 1, maxLength: 220 },
		tone: { type: "string", enum: ["info", "success", "caution"] },
		badges: {
			type: "array",
			maxItems: 4,
			items: { type: "string", minLength: 1, maxLength: 24 },
		},
		nextActionLabel: { type: "string", minLength: 1, maxLength: 48 },
	},
	required: ["title", "summary", "tone", "badges", "nextActionLabel"],
} as const);

export const localAdaptiveDraftSchema = z
	.object({
		title: shortText,
		summary: summaryText,
		tone: z.enum(["info", "success", "caution"]),
		badges: z.array(badgeText).max(4),
		nextActionLabel: shortText,
	})
	.strict();

export type LocalAdaptiveDraft = z.infer<typeof localAdaptiveDraftSchema>;

export type LocalAdaptiveTone = LocalAdaptiveDraft["tone"];

export interface LocalAdaptiveDraftValid {
	readonly ok: true;
	readonly draft: LocalAdaptiveDraft;
}

export interface LocalAdaptiveDraftInvalid {
	readonly ok: false;
	readonly diagnostics: readonly string[];
}

export type LocalAdaptiveDraftValidation = LocalAdaptiveDraftValid | LocalAdaptiveDraftInvalid;

export function validateLocalAdaptiveDraft(input: unknown): LocalAdaptiveDraftValidation {
	const parsed = localAdaptiveDraftSchema.safeParse(input);
	if (parsed.success) {
		return { ok: true, draft: parsed.data };
	}
	return {
		ok: false,
		diagnostics: parsed.error.issues.map((issue) => {
			const path = issue.path.length === 0 ? "draft" : issue.path.join(".");
			return `draft-invalid:${path}:${issue.code}`;
		}),
	};
}

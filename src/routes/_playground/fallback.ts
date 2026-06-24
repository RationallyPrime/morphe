import type { LocalAdaptiveDraft } from "./validation.js";

export const FALLBACK_LOCAL_ADAPTIVE_DRAFT: LocalAdaptiveDraft = Object.freeze({
	title: "Deterministic adaptive panel",
	summary:
		"Chrome local AI is optional. Morphe still renders a schema-valid tree through the same presenter.",
	tone: "info",
	badges: ["fallback", "validated"],
	nextActionLabel: "Record fallback",
});

export function fallbackDiagnostics(reason: string): readonly string[] {
	return [`fallback:${reason}`];
}

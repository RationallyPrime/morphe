/**
 * Morphe SLOTS — the top token layer (Lemma 3).
 *
 * Slots are component-facing assignments: they bind a primitive's structural
 * role (e.g. `field.border.error`) to an intent channel (e.g. `caution.border`).
 * Primitives reference SLOTS via the helpers here; they never reach for an
 * intent name directly and CERTAINLY never a scale.
 *
 * This indirection is what makes authored emissions fixed points under retheme:
 * a slot's *meaning* (field-error-border) is stable; only the intent→scale map
 * underneath it changes per dialect.
 *
 * Because the actual values live in CSS custom properties, a "slot" here is a
 * pure naming + resolution convention that returns a `var(--…)` expression a
 * primitive drops into a `style:` directive or inline style. There is no runtime
 * className synthesis (the legacy's central liability) — values resolve in the
 * cascade.
 */

import { type IntentChannel, intentVar } from "./intents.js";

/**
 * Resolve a slot to a CSS `var(...)` reference for a given intent. A primitive
 * uses this to bind, e.g., its surface to whatever intent the author chose:
 *
 *   style:background={slot(node.intent ?? "neutral", "surface")}
 *
 * @param intent  an intent name (core or dialect-contributed)
 * @param channel which channel of that intent to read
 * @param fallback optional CSS fallback if the var is unset (defense for unknown
 *                 dialect intents)
 */
export function slot(intent: string, channel: IntentChannel, fallback?: string): string {
	const name = intentVar(intent, channel);
	return fallback ? `var(${name}, ${fallback})` : `var(${name})`;
}

/**
 * Named, component-facing slot map. Each entry is the canonical binding for a
 * structural role. Primitives import the relevant entry rather than hard-coding
 * an intent, so a dialect can in principle re-point a slot without touching the
 * primitive. (Phase 0 keeps these pointing at the obvious core intents.)
 */
export const SLOTS = {
	/** Field/input chrome. */
	field: {
		surface: (): string => `var(--mo-intent-neutral-surface)`,
		on: (): string => `var(--mo-intent-on-surface)`,
		border: (): string => `var(--mo-intent-outline)`,
		borderFocus: (): string => slot("primary-action", "ring"),
		borderError: (): string => slot("caution", "border"),
		ring: (): string => slot("primary-action", "ring"),
	},
	/** Primary call-to-action surfaces. */
	action: {
		surface: (): string => slot("primary-action", "surface"),
		on: (): string => slot("primary-action", "on"),
		hover: (): string => slot("primary-action", "hover"),
	},
	/** Feedback tones map onto core intents. */
	feedback: {
		success: (channel: IntentChannel): string => slot("success", channel),
		caution: (channel: IntentChannel): string => slot("caution", channel),
		info: (channel: IntentChannel): string => slot("info", channel),
		neutral: (channel: IntentChannel): string => slot("neutral", channel),
	},
} as const;

/**
 * Map a Feedback `tone` to the intent that backs it. Keeps the
 * tone→intent decision in the token layer, not scattered across primitives.
 */
export function toneIntent(tone: "success" | "caution" | "info" | "neutral"): string {
	return tone;
}

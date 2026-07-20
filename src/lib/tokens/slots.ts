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

import type { CoreIntent, IntentRef } from "../grammar/types.js";
import { type IntentChannel, intentVar } from "./intents.js";

/**
 * Resolve a slot to a CSS `var(...)` reference for a given intent. A primitive
 * uses this to bind, e.g., its surface to whatever intent the author chose:
 *
 *   style:background={slot(node.intent ?? "neutral", "surface")}
 *
 * @param intent  a grammar-declared intent name
 * @param channel which channel of that intent to read
 * @param fallback optional CSS fallback if the var is unset (defense for unknown
 *                 dialect intents)
 */
export function slot(intent: IntentRef, channel: IntentChannel, fallback?: string): string {
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
	/**
	 * Freestanding CONTENT ink (Text / Number / Icon — the leaves that paint no
	 * fill). A content leaf is ink on whatever page surface it sits on, so it reads
	 * the intent's contrast-guaranteed `ink` channel, NOT `on` (which is text-on-fill
	 * and only clears contrast against the intent's own `surface`). The bare
	 * on-surface ink is the no-intent default the primitive supplies as the fallback.
	 */
	content: {
		ink: (intent: IntentRef): string => slot(intent, "ink", `var(--mo-intent-on-surface)`),
	},
	/** Field/input chrome. */
	field: {
		surface: (): string => `var(--mo-intent-neutral-surface)`,
		on: (): string => `var(--mo-intent-on-surface)`,
		border: (): string => `var(--mo-intent-outline)`,
		borderFocus: (): string => slot("primary-action", "ring"),
		borderError: (): string => slot("caution", "border"),
		ring: (): string => slot("primary-action", "ring"),
	},
	/**
	 * Action (Button) chrome. The Button primitive expresses its VARIANT by
	 * channel SELECTION (solid = surface+on; outline = border+on, transparent
	 * surface; ghost = on only, hover surface) — variants are re-combinations of
	 * these channels, NOT new tokens or a className matrix. Each reader takes the
	 * chosen intent so the same slot group backs any intent the author picks.
	 */
	action: {
		surface: (intent: IntentRef = "primary-action"): string => slot(intent, "surface"),
		on: (intent: IntentRef = "primary-action"): string => slot(intent, "on"),
		hover: (intent: IntentRef = "primary-action"): string => slot(intent, "hover"),
		border: (intent: IntentRef = "primary-action"): string => slot(intent, "border"),
		ring: (intent: IntentRef = "primary-action"): string => slot(intent, "ring"),
		/** Pressed state — falls back to hover if a dialect omits the channel. */
		active: (intent: IntentRef = "primary-action"): string =>
			slot(intent, "active", slot(intent, "hover")),
		/** Disabled surface — falls back to the surface channel if a dialect omits it. */
		disabled: (intent: IntentRef = "primary-action"): string =>
			slot(intent, "disabled", slot(intent, "surface")),
	},
	/**
	 * Link chrome — text + underline (the underline IS the affordance; functional
	 * colour is never the only signal). A link is FREESTANDING ink on the page
	 * ground, so it reads the intent's contrast-guaranteed `ink` / `ink-hover`
	 * channels — uniformly, for the provenance/citation default AND any explicit
	 * intent (KRA-796). This is the fix for BOTH prior bugs: the provenance branch
	 * used to route through `--mo-link-*` (which chained the beacon SURFACE on
	 * hover — cobalt-600 on paper, ~3.9:1, sub-AA), and an explicit-intent link
	 * used the intent's SURFACE/`on` hue as ink (the beacon fill as text — unreadable
	 * off its fill). The `ink` channel is contrast-guaranteed on base/raised/sunken
	 * by construction; `ink-hover` is its hover sibling, held to the same AA floor.
	 */
	link: {
		on: (intent: IntentRef = "provenance"): string =>
			slot(intent, "ink", `var(--mo-intent-on-surface)`),
		hover: (intent: IntentRef = "provenance"): string =>
			slot(intent, "ink-hover", slot(intent, "ink", `var(--mo-intent-on-surface)`)),
		ring: (intent: IntentRef = "provenance"): string => slot(intent, "ring"),
	},
	/**
	 * Overlay (Dialog/Popover) chrome. The floating panel surface, the modal
	 * scrim, a ghost edge over the scrim, and the layer scale (used only by the
	 * rare non-top-layer fallback — native showModal/popover own the top layer).
	 */
	overlay: {
		surface: (): string => `var(--mo-intent-surface-overlay)`,
		on: (): string => `var(--mo-intent-on-surface)`,
		scrim: (): string => `var(--mo-scrim)`,
		border: (): string => `var(--mo-intent-outline)`,
		layer: {
			dropdown: (): string => `var(--mo-layer-dropdown)`,
			overlay: (): string => `var(--mo-layer-overlay)`,
			toast: (): string => `var(--mo-layer-toast)`,
			tooltip: (): string => `var(--mo-layer-tooltip)`,
		},
	},
	/**
	 * Focus ring. The COLOR is per-intent (`ring` channel); only the geometry is
	 * neutral, so every interactive primitive draws a consistent ring (CONTRACT
	 * §7) without hardcoding pixels.
	 */
	focus: {
		ring: (intent: IntentRef = "primary-action"): string => slot(intent, "ring"),
		width: (): string => `var(--mo-ring-width)`,
		offset: (): string => `var(--mo-ring-offset)`,
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
export function toneIntent(tone: "success" | "caution" | "info" | "neutral"): CoreIntent {
	return tone;
}

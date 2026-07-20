/**
 * Morphe INTENTS — the middle token layer (Lemma 3).
 *
 * Intents are the ONLY token vocabulary authored trees touch. They are
 * domain-semantic names mapped onto neutral scales. The core set below is
 * vertical-NEUTRAL; the register tier adds the shared discourse roles every
 * shipped dialect re-reads. The namespace is closed at the grammar boundary:
 * adding another tier is a contract change, not an arbitrary string escape.
 *
 * Each intent resolves to a small, fixed set of channels. Slots (slots.ts) bind
 * component-facing roles to these channels. Re-theming / re-dialecting is a
 * fixed point for anything authored: it is purely a remap at THIS layer.
 *
 * This file is the TS contract for intent names + channel shape; the actual
 * color values for the default dialect live in intents.css (the CSS custom
 * properties this contract names).
 */

import type { CoreIntent, IntentRef, RegisterIntent } from "../grammar/types.js";

export type { CoreIntent, IntentRef, RegisterIntent };

/**
 * The channels every intent must provide. CSS var names derive from these.
 *
 * `active` and `disabled` were added for the ACTION family (the seed's
 * `IntentThemeEntry.activeBg` / `disabledBg` are the evidence): a button needs a
 * pressed-state surface and a disabled-state surface, and these are intent-scoped
 * (they shift with the chosen intent). They are OPTIONAL in a dialect's
 * `IntentDefinition` (Partial), so existing dialects need not define them and
 * primitives fall back through `slot(... , fallback)`.
 *
 * `ink` / `ink-hover` are the UNFILLED-ink channels (KRA-796). `surface + on` is
 * the pair for a FILLED component: the intent paints its `surface` and text uses
 * `on` — text-on-fill, contrast-guaranteed ONLY against that fill (badges,
 * statuses, alerts, solid buttons). A FREESTANDING leaf (`Text`/`Number`/`Link`)
 * paints no fill: it is ink on whatever page surface (base / raised / sunken) it
 * sits on. Using `on` there is the bug this channel fixes — provenance's ice `on`
 * is built for a navy panel and vanishes as inline text on paper. `ink` is the
 * intent's hue rendered as contrast-guaranteed ink on the page grounds; `ink-hover`
 * is its interactive-hover sibling (the Link affordance). Both are held to the
 * WCAG 2.2 AA floor on base/raised/sunken by the browser contrast matrix gate.
 */
export type IntentChannel =
	| "surface"
	| "on"
	| "hover"
	| "border"
	| "ring"
	| "active"
	| "disabled"
	| "ink"
	| "ink-hover";

/** The core intents, as a runtime-iterable list (mirrors the CoreIntent type). */
export const CORE_INTENTS: readonly CoreIntent[] = [
	"primary-action",
	"neutral",
	"provenance",
	"evidence",
	"accession",
	"caution",
	"success",
	"info",
] as const;

/** Shared register-extension names every shipped dialect re-reads. */
export const REGISTER_INTENTS: readonly RegisterIntent[] = ["folio", "marginalia", "seal"] as const;

/** Every authorable intent ref, as a runtime list for tests and validators. */
export const INTENT_REFS: readonly IntentRef[] = [...CORE_INTENTS, ...REGISTER_INTENTS] as const;

/**
 * The CSS custom-property name for an intent channel, e.g.
 * `intentVar("caution", "surface")` -> `--mo-intent-caution-surface`.
 *
 * This is the single naming convention shared by intents.css, slots.ts, and the
 * dialect provider. A primitive should reference SLOTS, but the chain bottoms
 * out at these var names.
 */
export function intentVar(intent: IntentRef, channel: IntentChannel): string {
	return `--mo-intent-${intent}-${channel}`;
}

/**
 * The base surface/on-surface vars (not intent-scoped) used by Frame surfaces
 * and the document body. Kept here so the naming convention has one home.
 *
 * `overlay` and `scrim` were added for the OVERLAY family: the floating-panel
 * surface (Dialog/Popover body — the highest tonal tier, depth via tone not
 * shadow) and the modal backdrop (the one overlay token expressed purely as a
 * translucent fill, since there is no tonal-layering substitute for a scrim).
 */
export const SURFACE_VARS = {
	base: "--mo-intent-surface-base",
	raised: "--mo-intent-surface-raised",
	sunken: "--mo-intent-surface-sunken",
	overlay: "--mo-intent-surface-overlay",
	on: "--mo-intent-on-surface",
	onMuted: "--mo-intent-on-surface-muted",
	outline: "--mo-intent-outline",
	scrim: "--mo-scrim",
} as const;

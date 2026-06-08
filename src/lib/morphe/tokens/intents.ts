/**
 * Morphe INTENTS — the middle token layer (Lemma 3).
 *
 * Intents are the ONLY token vocabulary authored trees touch. They are
 * domain-semantic names mapped onto neutral scales. The core set below is
 * vertical-NEUTRAL; a dialect (Lemma 4) EXTENDS it with vertical discourse roles
 * (e.g. a legal dialect contributes `judicial-crimson` as an intent mapping onto
 * the neutral `red` scale — NOT as a scale name). Intents never rename the core
 * set; refinement may only extend it.
 *
 * Each intent resolves to a small, fixed set of channels. Slots (slots.ts) bind
 * component-facing roles to these channels. Re-theming / re-dialecting is a
 * fixed point for anything authored: it is purely a remap at THIS layer.
 *
 * This file is the TS contract for intent names + channel shape; the actual
 * color values for the default dialect live in intents.css (the CSS custom
 * properties this contract names).
 */

import type { CoreIntent } from "../grammar/types.js";

export type { CoreIntent };

/** The channels every intent must provide. CSS var names derive from these. */
export type IntentChannel = "surface" | "on" | "hover" | "border" | "ring";

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

/**
 * The CSS custom-property name for an intent channel, e.g.
 * `intentVar("caution", "surface")` -> `--mo-intent-caution-surface`.
 *
 * This is the single naming convention shared by intents.css, slots.ts, and the
 * dialect provider. A primitive should reference SLOTS, but the chain bottoms
 * out at these var names.
 */
export function intentVar(intent: string, channel: IntentChannel): string {
	return `--mo-intent-${intent}-${channel}`;
}

/**
 * The base surface/on-surface vars (not intent-scoped) used by Frame surfaces
 * and the document body. Kept here so the naming convention has one home.
 */
export const SURFACE_VARS = {
	base: "--mo-intent-surface-base",
	raised: "--mo-intent-surface-raised",
	sunken: "--mo-intent-surface-sunken",
	on: "--mo-intent-on-surface",
	onMuted: "--mo-intent-on-surface-muted",
	outline: "--mo-intent-outline",
} as const;

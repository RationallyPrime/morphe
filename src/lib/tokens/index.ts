/**
 * Public token seam.
 *
 * This entry exports the authored vocabulary and slot helpers. Global token CSS
 * is published separately as `@rationallyprime/morphe/styles.css`.
 */

export type { IntentChannel } from "./intents.js";
export { CORE_INTENTS, intentVar, SURFACE_VARS } from "./intents.js";
export { SLOTS, slot, toneIntent } from "./slots.js";

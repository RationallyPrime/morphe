/**
 * Morphe GLOBAL ACTIVE DIALECT — the app-wide τ_frame selection (Lemma 4).
 *
 * The registry (`registry.ts`) names the dialects a deployment ships and resolves
 * one by id; the provider (`provider.svelte.ts`) is the pure apply mechanism;
 * `MorpheRoot` is the boundary that spreads the applied result. What was still
 * missing was a single, app-wide place to say WHICH dialect is currently active —
 * so the active dialect is global state, not a value hardcoded per page or trapped
 * local inside one demo.
 *
 * This module IS that store: one module-level `$state<Dialect>` rune defaulting to
 * `DEFAULT_DIALECT`, behind a tiny read/write API. Every `MorpheRoot` that OMITS an
 * explicit `dialect` prop follows `activeDialect.current` reactively, so flipping
 * the active dialect re-themes the whole app at once. An explicit `dialect` prop
 * still overrides at its boundary (the subtree-boundary swap is preserved).
 *
 * SSR-SAFE BY CONSTRUCTION: this module touches NOTHING at module scope beyond the
 * pure default (no `window`, no `localStorage`, no `document`). The setters are only
 * ever invoked from client code (a toggle's `onchange`, a layout `$effect`), which
 * never runs during SSR — so the server always renders the default and hydration is
 * stable. Persistence lives in the client-only layout effect, not here; this stays
 * pure runes.
 */

import { DEFAULT_DIALECT } from "./icelandic-archive.js";
import { getDialect, hasDialect } from "./registry.js";
import type { Dialect } from "./types.js";

/** The app-wide active dialect. Module-level rune: one source of truth per app. */
let active = $state<Dialect>(DEFAULT_DIALECT);

/**
 * The global active-dialect API. Reads are reactive (used inside `$derived` in
 * `MorpheRoot`); writes are client-only by discipline. `setById` is GUARDED by the
 * registry: an unknown id is a no-op, never a silent reset to the default — a
 * persisted legacy id should leave the current selection intact, not clobber it.
 */
export const activeDialect = {
	/** The currently active dialect object (reactive). */
	get current(): Dialect {
		return active;
	},
	/** The currently active dialect's id (reactive). */
	get id(): string {
		return active.id;
	},
	/** Set the active dialect from a concrete object. */
	set(d: Dialect): void {
		active = d;
	},
	/** Set the active dialect by id; unknown ids are a no-op (not a reset). */
	setById(id: string): void {
		if (hasDialect(id)) {
			active = getDialect(id);
		}
	},
};

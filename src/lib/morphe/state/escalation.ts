/**
 * Morphe TIER-2 ESCALATION context — the typed boundary surface (Lemma 5).
 *
 * Tier-2 events (`submit`, `task-transition`, `view-not-working`) surface as
 * a TYPED CALLBACK at the `MorpheRoot` boundary — never a DOM event, never a
 * store write. `MorpheRoot` accepts `onEscalate?: (e: Tier2Event) => void`
 * and provides it here; a primitive that owns a tier-2 affordance reads it
 * with `useEscalation()` and fires.
 *
 * The tier law, structurally: this context is DISJOINT from the store
 * context. Input primitives consume the store (tier-1 commits) and never
 * import this module — a tier-1 handler has no escalation capability in
 * scope to misuse (asserted by the architecture scan in `store.test.ts`).
 * Today no shipped primitive fires tier-2 (in-tree Buttons are inert until
 * the R1.4 action wire; the site's forms are native chrome, out of scope),
 * so this is the typed seam those land on.
 *
 * Like the resolver ref, the context value is a REF with a reactive `current`
 * getter — the host can change/remove its handler without remounting.
 */

import { getContext, hasContext, setContext } from "svelte";
import type { EscalationHandler } from "./events.js";

/** A reactive handle on the tree's escalation handler (if the host set one). */
export interface EscalationRef {
	readonly current: EscalationHandler | undefined;
}

const KEY = Symbol("morphe.escalation");

/** Provide the escalation ref (called by `MorpheRoot` at init). */
export function provideEscalation(ref: EscalationRef): void {
	setContext(KEY, ref);
}

/** Read the nearest escalation ref (undefined outside a `MorpheRoot`). */
export function useEscalation(): EscalationRef | undefined {
	if (!hasContext(KEY)) return undefined;
	return getContext<EscalationRef>(KEY);
}

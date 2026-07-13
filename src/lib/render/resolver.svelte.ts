/**
 * Morphe COMPOUND-RESOLVER context — how the dialect-restricted registry view
 * reaches EVERY `<Node>` in a tree (Lemma 4, G|D's compound half).
 *
 * `MorpheRoot` seeds a dialect-restricted resolver. Every `<Node>` then resolves
 * explicit prop > inherited ref > process singleton and re-provides that
 * effective resolver to its descendants. Layout and overlay primitives remain
 * unaware of compound resolution: when they recurse into `<Node>`, the nearest
 * effective resolver crosses that boundary through context automatically.
 *
 * The context value is a REF (an object with a reactive `current` getter),
 * not the resolver itself: `MorpheRoot` derives a fresh restricted view when
 * the effective dialect changes, and a getter read inside a consumer's
 * `$derived` tracks that change — the gating re-themes live, no remount
 * required. This also makes an explicit resolver on a standalone `<Node>` a
 * subtree override rather than a one-component hint.
 */

import { getContext, hasContext, setContext } from "svelte";
import type { CompoundResolver } from "../compounds/factory.js";

/** A reactive handle on the tree's current resolver. */
export interface CompoundResolverRef {
	readonly current: CompoundResolver;
}

const KEY = Symbol("morphe.compound-resolver");

/** Provide or narrow the resolver ref for a rendered subtree during init. */
export function provideCompoundResolver(ref: CompoundResolverRef): void {
	setContext(KEY, ref);
}

/** Read the nearest provided resolver ref (undefined outside a `MorpheRoot`). */
export function useCompoundResolver(): CompoundResolverRef | undefined {
	if (!hasContext(KEY)) return undefined;
	return getContext<CompoundResolverRef>(KEY);
}

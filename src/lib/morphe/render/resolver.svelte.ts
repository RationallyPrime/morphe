/**
 * Morphe COMPOUND-RESOLVER context — how the dialect-restricted registry view
 * reaches EVERY `<Node>` in a tree (Lemma 4, G|D's compound half).
 *
 * `<Node>`'s `registry` prop only survives Node→Node recursion (compound /
 * vary / slot branches). Layout and overlay primitives recurse into `<Node>`
 * themselves and hand it `{ node, ctx }` only — so a prop-threaded resolver
 * would silently revert to the process singleton at the first container
 * boundary. Context crosses those boundaries for free, exactly as the Morphe
 * context seed and the client store already do.
 *
 * The context value is a REF (an object with a reactive `current` getter),
 * not the resolver itself: `MorpheRoot` derives a fresh restricted view when
 * the effective dialect changes, and a getter read inside a consumer's
 * `$derived` tracks that change — the gating re-themes live, no remount
 * required. Resolution order in `<Node>`: explicit `registry` prop > this
 * context > the process singleton (graceful standalone degradation).
 */

import { getContext, hasContext, setContext } from "svelte";
import type { CompoundResolver } from "../compounds/factory.js";

/** A reactive handle on the tree's current resolver. */
export interface CompoundResolverRef {
	readonly current: CompoundResolver;
}

const KEY = Symbol("morphe.compound-resolver");

/** Provide the tree's resolver ref (called by `MorpheRoot` at init). */
export function provideCompoundResolver(ref: CompoundResolverRef): void {
	setContext(KEY, ref);
}

/** Read the nearest provided resolver ref (undefined outside a `MorpheRoot`). */
export function useCompoundResolver(): CompoundResolverRef | undefined {
	if (!hasContext(KEY)) return undefined;
	return getContext<CompoundResolverRef>(KEY);
}

/**
 * Morphe DIALECT REGISTRY — the named-dialect lookup (Lemma 4 ergonomics).
 *
 * The provider (`provider.svelte.ts`) is the pure apply mechanism: dialect ->
 * `{ attr, rootContext, vars }`. `MorpheRoot` is the τ_frame injection point
 * that spreads that result at a boundary. What's left is a small, declarative
 * place to NAME the dialects a deployment ships and to resolve one by id — so a
 * consumer can swap the active dialect at a subtree boundary by id rather than
 * importing the concrete object everywhere.
 *
 * This is data, not logic: a frozen record of id -> Dialect plus three trivial
 * pure helpers. It touches nothing in the core; it only collects the dialects
 * this `dialects/` folder defines. Adding a dialect = add its module here.
 *
 * Subtree-boundary swap, end to end:
 *   - The default tree renders under `MorpheRoot` with `DEFAULT_DIALECT`.
 *   - A nested region renders under another `MorpheRoot dialect={getDialect("clinical")}`.
 *   - `applyDialect` emits the clinical intent vars at that inner boundary; the
 *     CSS cascade scopes them to the inner subtree; the outer Archive tree is
 *     untouched. No authored Node changed; only the intent layer moved.
 */

import { clinical } from "./clinical.js";
import { gallery } from "./gallery.js";
import { icelandicArchive } from "./icelandic-archive.js";
import { night } from "./night.js";
import { reykjavikRegistry } from "./reykjavik-registry.js";
import { timaeus } from "./timaeus.js";
import type { Dialect } from "./types.js";

/**
 * The shipped dialects, keyed by their stable `id` (also the `data-mo-dialect`
 * attribute value). Frozen so it is read-only data, not a mutable global.
 */
export const DIALECTS: Readonly<Record<string, Dialect>> = Object.freeze({
	[icelandicArchive.id]: icelandicArchive,
	[clinical.id]: clinical,
	[reykjavikRegistry.id]: reykjavikRegistry,
	[timaeus.id]: timaeus,
	[gallery.id]: gallery,
	[night.id]: night,
});

/**
 * The dialect used when nothing more specific is selected — owned HERE, by the
 * registry (the single source of dialect truth), not by any dialect module.
 * ADR-0005 §2 (D6): the gallery light ground is the shipped default; the
 * amber-on-charcoal Archive identity is retired as the default but remains a
 * registered dialect (the substrate demo's fixed point). The static `:root`
 * fallback in tokens/intents.css MUST agree with this choice — pinned by the
 * data ⇄ CSS agreement suite in dialects.test.ts.
 */
export const DEFAULT_DIALECT: Dialect = gallery;

/** The id of the dialect used when nothing more specific is selected. */
export const DEFAULT_DIALECT_ID: string = DEFAULT_DIALECT.id;

/** Every registered dialect id, in insertion order. */
export const DIALECT_IDS: readonly string[] = Object.keys(DIALECTS);

/**
 * Resolve a dialect by id. Falls back to the default dialect for an unknown id
 * so a stray/legacy id can never make the renderer non-total (Definition 1).
 */
export function getDialect(id: string | undefined): Dialect {
	if (id !== undefined && id in DIALECTS) {
		// `in` guard above guarantees the index is present.
		return DIALECTS[id] as Dialect;
	}
	return DEFAULT_DIALECT;
}

/** Whether an id names a registered dialect (without falling back). */
export function hasDialect(id: string): boolean {
	return id in DIALECTS;
}

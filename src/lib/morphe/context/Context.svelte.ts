/**
 * Morphe context ENGINE — the Svelte-context carrier for Lemma 2's record.
 *
 * Discrete tier decisions ride Svelte context (set/get below). Continuous values
 * are emitted as CSS custom properties at boundaries via `boundaryVars()`, which
 * a Layout primitive spreads into `style:` at its root element. This is the
 * hybrid carrier: discrete in context, continuous in the cascade, browser-
 * visible flex in container queries.
 *
 * Svelte 5 runes only. `getContext`/`setContext` must run during component
 * init; primitives call `useMorpheContext()` at the top of their <script>.
 */

import { getContext, hasContext, setContext } from "svelte";
import type { ContainerRole, Density, EmphasisClaim } from "../grammar/types.js";
import {
	type MorpheContext,
	ROOT_CONTEXT,
	type ScaleTier,
	densityToSpaceStep,
	enterFrame,
	tierToTypeStep,
	transform,
} from "./algebra.js";

const KEY = Symbol("morphe.context");

/**
 * Read the current Morphe context. Returns ROOT_CONTEXT if none has been set
 * (e.g. a primitive rendered standalone in a test), so primitives never crash on
 * a missing provider — graceful degradation per Corollary 1.
 */
export function useMorpheContext(): MorpheContext {
	if (!hasContext(KEY)) return ROOT_CONTEXT;
	return getContext<MorpheContext>(KEY);
}

/**
 * Provide a context to descendants. Call at the top of a Layout primitive's
 * <script> AFTER computing the child context with `transform`/`enterFrame`.
 */
export function provideMorpheContext(ctx: MorpheContext): void {
	setContext(KEY, ctx);
}

/**
 * Compute and provide the child context for a non-Frame container, in one call.
 * Returns the computed context so the caller can also emit boundary vars.
 *
 * The parent context is carried by the explicit `ctx` PROP a primitive receives
 * from <Node> (the prop chain is the real carrier — it is correct on BOTH the
 * server and the first client render). The Svelte context channel is seeded
 * alongside it as a FALLBACK for anything that reads `useMorpheContext()`
 * directly. When `parent` is omitted (a primitive rendered standalone in a test),
 * we fall back to the context channel.
 */
export function descend(
	role: ContainerRole,
	opts: { readonly childCount?: number; readonly claim?: EmphasisClaim } = {},
	parent: MorpheContext = useMorpheContext(),
): MorpheContext {
	const child = transform(parent, role, opts);
	provideMorpheContext(child);
	return child;
}

/**
 * Frame variant of `descend` — the only context reset (Monotone-depth law).
 * Descends from the explicit `parent` (the `ctx` prop) so a dialect's clamped
 * density/budget priors take effect on SSR and the first client render; falls
 * back to the context channel for a standalone render.
 */
export function descendFrame(
	opts: {
		readonly surface?: "base" | "raised" | "sunken";
		readonly density?: Density;
		readonly budget?: number;
	} = {},
	parent: MorpheContext = useMorpheContext(),
): MorpheContext {
	const child = enterFrame(parent, opts);
	provideMorpheContext(child);
	return child;
}

/**
 * The CSS custom properties a boundary emits so that continuous values resolve
 * in the cascade. A Layout primitive spreads the returned record into `style:`
 * (Svelte) or builds an inline style string from it.
 *
 *   --mo-ctx-space     gap/padding step for this density
 *   --mo-ctx-type      type-scale step for this scale tier
 *   --mo-ctx-surface   the resolved surface color var
 */
export function boundaryVars(ctx: MorpheContext): Record<string, string> {
	const surfaceVar =
		ctx.surface === "raised"
			? "var(--mo-intent-surface-raised)"
			: ctx.surface === "sunken"
				? "var(--mo-intent-surface-sunken)"
				: "var(--mo-intent-surface-base)";
	return {
		"--mo-ctx-space": densityToSpaceStep(ctx.density),
		"--mo-ctx-type": tierToTypeStep(ctx.scaleTier),
		"--mo-ctx-surface": surfaceVar,
		"--mo-ctx-depth": String(ctx.depth),
	};
}

/** Build an inline `style` string from the boundary vars (for primitives). */
export function boundaryStyle(ctx: MorpheContext): string {
	return Object.entries(boundaryVars(ctx))
		.map(([k, v]) => `${k}:${v}`)
		.join(";");
}

export type { MorpheContext, ScaleTier };

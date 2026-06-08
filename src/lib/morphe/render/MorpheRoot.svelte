<script lang="ts">
	/*
	 * MorpheRoot — the dialect-providing entry point for a rendered tree.
	 *
	 * Applies a Dialect (clamping priors, selecting the intent block, injecting
	 * any intent overrides as CSS vars at this boundary), seeds the root context,
	 * and renders the tree through <Node>. This is the τ_frame injection point.
	 *
	 * This is a structural component (not a primitive); it is part of the core and
	 * primitive agents do not edit it.
	 */

	import type { Node as MorpheNode } from "../grammar/types.js";
	import type { Dialect } from "../dialects/types.js";
	import type { CompoundRegistry } from "../compounds/factory.js";
	import { registry as defaultRegistry } from "../compounds/factory.js";
	import { activeDialect } from "../dialects/active.svelte.js";
	import { applyDialect, dialectStyle } from "../dialects/provider.svelte.js";
	import { provideMorpheContext } from "../context/Context.svelte.js";
	import Node from "./Node.svelte";

	interface Props {
		tree: MorpheNode;
		dialect?: Dialect;
		registry?: CompoundRegistry;
	}

	let { tree, dialect, registry = defaultRegistry }: Props = $props();

	// An explicit `dialect` prop OVERRIDES (preserving the subtree-boundary swap);
	// when OMITTED, follow the GLOBAL active dialect reactively, so flipping it
	// re-themes every following root at once.
	const effective = $derived(dialect ?? activeDialect.current);
	const applied = $derived(applyDialect(effective));

	// Seed the root context at INIT (not in an effect): setContext must run during
	// component init to be visible to children synchronously on BOTH the server and
	// the first client render. An $effect.pre runs too late (children captured
	// their context at their own init) and is stripped on the server entirely.
	//
	// The dialect's clamped priors flow to children primarily via the `ctx` PROP
	// below (the layout primitives descend from that prop); this seed is the
	// fallback channel for anything reading `useMorpheContext()` directly. We read
	// the dialect store once here at init — a global flip remounts the root tree
	// ({#key activeDialect.id}), re-running this seed for the new dialect.
	// svelte-ignore state_referenced_locally
	provideMorpheContext(applied.rootContext);
</script>

<div class="mo-root" data-mo-dialect={applied.attr} style={dialectStyle(applied)}>
	<Node node={tree} ctx={applied.rootContext} {registry} />
</div>

<style>
	.mo-root {
		container-type: inline-size;
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
	}
</style>

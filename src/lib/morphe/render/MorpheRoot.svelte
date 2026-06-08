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
	import { DEFAULT_DIALECT } from "../dialects/icelandic-archive.js";
	import { applyDialect, dialectStyle } from "../dialects/provider.svelte.js";
	import { provideMorpheContext } from "../context/Context.svelte.js";
	import Node from "./Node.svelte";

	interface Props {
		tree: MorpheNode;
		dialect?: Dialect;
		registry?: CompoundRegistry;
	}

	let { tree, dialect = DEFAULT_DIALECT, registry = defaultRegistry }: Props = $props();

	const applied = $derived(applyDialect(dialect));

	// Seed the root context so descendants resolve from the dialect's priors.
	$effect.pre(() => {
		provideMorpheContext(applied.rootContext);
	});
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

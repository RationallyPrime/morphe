<script lang="ts">
	/*
	 * Morphe NODE RENDERER — the recursive heart of `render` (Definition 1).
	 *
	 * Responsibilities (and ONLY these — render stays small by design):
	 *   - switch on `node.kind`;
	 *   - expand `CompoundRef` via the factory, then render the expansion;
	 *   - render `Vary`'s default option (Phase 0; the mid loop chooses later);
	 *   - render `Slot`'s fallback (a bare Slot outside an expansion);
	 *   - render `ParamRef` defensively (should never survive expansion — the
	 *     factory resolves them — but if one reaches here we coerce to its text);
	 *   - for every primitive kind, look up the component in the registry and
	 *     hand it `{ node, ctx }`.
	 *
	 * Context threading: Layout primitives own their own descent (they call
	 * `descend`/`descendFrame` in their <script> and set boundary CSS vars), so
	 * this renderer simply passes the CURRENT ctx to the primitive. The primitive
	 * provides the child ctx to ITS children, which it renders by recursing into
	 * <Node> with that child ctx. This keeps LOCALITY clean: each node resolves
	 * from (parent ctx, own role) only.
	 */

	import type { Node as MorpheNode } from "../grammar/types.js";
	import type { MorpheContext } from "../context/algebra.js";
	import { ROOT_CONTEXT } from "../context/algebra.js";
	import { registry as defaultRegistry, type CompoundResolver } from "../compounds/factory.js";
	import { useCompoundResolver } from "./resolver.svelte.js";
	import { primitiveFor, type PrimitiveKind } from "./registry.js";
	import Self from "./Node.svelte";

	interface Props {
		node: MorpheNode;
		/** Resolved context at this node. Defaults to ROOT for a standalone render. */
		ctx?: MorpheContext;
		/**
		 * Compound resolver to expand against (DI). Resolution: this prop >
		 * the `MorpheRoot`-provided context ref (the dialect-restricted view —
		 * an out-of-dialect or non-promoted name reads as unknown and falls
		 * into the render-nothing + dev-warn path below, never throwing) > the
		 * process registry for a standalone render.
		 */
		registry?: CompoundResolver;
	}

	let { node, ctx = ROOT_CONTEXT, registry }: Props = $props();

	// Context crosses the container-primitive boundaries the prop chain cannot
	// (Stack/Frame/… recurse into <Node> with {node, ctx} only). The ref's
	// `current` getter is reactive, so a dialect change re-derives the view here.
	const provided = useCompoundResolver();
	const resolver = $derived(registry ?? provided?.current ?? defaultRegistry);

	/**
	 * For Vary, pick the default option index, clamped into range. Phase 0 has no
	 * mid loop, so this is the rendered choice.
	 */
	const varyChoice = $derived(
		node.kind === "vary"
			? node.options[Math.min(Math.max(node.default ?? 0, 0), node.options.length - 1)]
			: undefined,
	);

	/** Expand a CompoundRef once, reactively. */
	const expanded = $derived.by(() => {
		if (node.kind !== "compound") return undefined;
		if (resolver.has(node.name)) return resolver.expand(node);
		if (import.meta.env.DEV) {
			console.warn(`Unknown Morphe compound "${node.name}" rendered as empty.`);
		}
		return undefined;
	});
</script>

{#if node.kind === "compound"}
	{#if expanded}
		<Self node={expanded} {ctx} {registry} />
	{/if}
{:else if node.kind === "vary"}
	{#if varyChoice}
		<Self node={varyChoice} {ctx} {registry} />
	{/if}
{:else if node.kind === "slot"}
	<!-- A bare Slot outside a compound expansion renders its fallback. -->
	{#each node.fallback ?? [] as child, i (i)}
		<Self node={child} {ctx} {registry} />
	{/each}
{:else if node.kind === "param-ref"}
	<!-- Should be resolved during expansion; defensive fallthrough. -->
	<span>{node.param}</span>
{:else}
	<!-- A shipped primitive. The exhaustive registry guarantees a component. -->
	{@const Primitive = primitiveFor(node.kind as PrimitiveKind)}
	<Primitive {node} {ctx} />
{/if}

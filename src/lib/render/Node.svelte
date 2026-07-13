<script lang="ts">

	/*
	 * Morphe NODE RENDERER — the recursive heart of `render` (Definition 1).
	 *
	 * Responsibilities (and ONLY these — render stays small by design):
	 *   - switch on `node.kind`;
	 *   - expand `CompoundRef` via the factory, then render the expansion;
	 *   - resolve `Vary` and targeted `Within` authority sockets;
	 *   - render `Slot`'s fallback (a bare Slot outside an expansion);
	 *   - render `ParamRef` defensively (should never survive expansion — the
	 *     factory resolves them — but if one reaches here we coerce to its text);
	 *   - for every primitive kind, look up the component in the registry and
	 *     hand it `{ node, ctx }`.
	 *
	 * Context threading: Layout primitives own their own reactive
	 * `transform`/`enterFrame` calculation and set boundary CSS vars, so
	 * this renderer simply passes the CURRENT ctx to the primitive. The primitive
	 * provides the child ctx to ITS children, which it renders by recursing into
	 * <Node> with that child ctx. This keeps LOCALITY clean: each node resolves
	 * from (parent ctx, own role) only.
	 */

	import { DEV } from "esm-env";
	import { type CompoundResolver, registry as defaultRegistry } from "../compounds/factory.js";
	import type { MorpheContext } from "../context/algebra.js";
	import { emphasisToStrokeStep, ROOT_CONTEXT, withDensity } from "../context/algebra.js";
	import { boundaryStyle } from "../context/Context.svelte.js";
	import { resolveVaryOption, resolveWithin } from "../delegation/resolveChoice.js";
	import { hasVisibleLabelText } from "../grammar/labels.js";
	import type { Node as MorpheNode } from "../grammar/types.js";
	import { useChoices } from "./choices.svelte.js";
	import Self from "./Node.svelte";
	import { type PrimitiveKind, primitiveFor } from "./registry.js";
	import { provideCompoundResolver, useCompoundResolver } from "./resolver.svelte.js";

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

	// Capture the inherited resolver before narrowing this subtree. Re-providing
	// the effective ref lets every current and future recursive primitive cross
	// the boundary without acquiring registry props of its own. The getter remains
	// reactive, so a dialect change re-derives the restricted view in place.
	const provided = useCompoundResolver();
	const resolver = $derived(registry ?? provided?.current ?? defaultRegistry);
	provideCompoundResolver({
		get current() {
			return resolver;
		},
	});
	const providedChoices = useChoices();
	const choiceMap = $derived(providedChoices?.current);

	/**
	 * For Vary, pick the root-provided choice when present, else the authored
	 * default. The choice map is already epoch-checked host-side by applyDelta.
	 */
	const varyChoice = $derived(node.kind === "vary" ? resolveVaryOption(node, choiceMap) : undefined);
	const withinChoice = $derived(node.kind === "within" ? resolveWithin(node, choiceMap) : undefined);

	interface WithinRender {
		readonly node: MorpheNode;
		readonly ctx: MorpheContext;
	}

	/**
	 * Resolve a targeted Within into ordinary grammar + context inputs. Legacy
	 * targetless sockets remain inert. Collapse is compiled to the native
	 * Disclosure primitive; malformed direct-call trees without a visible summary fail
	 * open by rendering their target, never by hiding content behind an unlabelled
	 * control. Emphasis deliberately leaves ctx untouched: its parent has already
	 * budgeted the resolved claim and granted `renderedEmphasis` on that ctx.
	 */
	const withinRender = $derived.by((): WithinRender | undefined => {
		if (node.kind !== "within" || !node.target || !withinChoice) return undefined;
		switch (withinChoice.dimension) {
			case "density":
				return { node: node.target, ctx: withDensity(ctx, withinChoice.value) };
			case "emphasis":
				return { node: node.target, ctx };
			case "collapse": {
				if (node.dimension !== "collapse") return { node: node.target, ctx };
				if (!hasVisibleLabelText(node.summary)) return { node: node.target, ctx };
				return {
					node: {
						kind: "disclosure",
						summary: node.summary,
						open: !withinChoice.value,
						children: [node.target],
					},
					ctx,
				};
			}
		}
	});

	/** Expand a CompoundRef once, reactively. */
	const expanded = $derived.by(() => {
		if (node.kind !== "compound") return undefined;
		if (resolver.has(node.name)) {
			try {
				return resolver.expand(node);
			} catch (error) {
				if (DEV) {
					const detail = error instanceof Error ? `: ${error.message}` : "";
					console.warn(`Invalid Morphe compound "${node.name}" rendered as empty${detail}.`);
				}
				return undefined;
			}
		}
		if (DEV) console.warn(`Unknown Morphe compound "${node.name}" rendered as empty.`);
		return undefined;
	});
</script>

	{#if node.kind === "compound"}
		{#if expanded}
			<Self node={expanded} {ctx} />
		{/if}
	{:else if node.kind === "vary"}
		{#if varyChoice}
			<Self node={varyChoice} {ctx} />
		{/if}
	{:else if node.kind === "within"}
		{#if withinRender}
			{#if withinChoice?.dimension === "density" || withinChoice?.dimension === "emphasis"}
				<div
					class="mo-within-context"
					style={boundaryStyle(withinRender.ctx)}
					style:--mo-ctx-stroke={emphasisToStrokeStep(
						withinRender.ctx.renderedEmphasis ?? "normal",
					)}
				>
					<Self node={withinRender.node} ctx={withinRender.ctx} />
				</div>
			{:else}
				<Self node={withinRender.node} ctx={withinRender.ctx} />
			{/if}
		{/if}
	{:else if node.kind === "slot"}
		<!-- A bare Slot outside a compound expansion renders its fallback. -->
		{#each node.fallback ?? [] as child, i (i)}
			<Self node={child} {ctx} />
		{/each}
{:else if node.kind === "param-ref"}
	<!-- Should be resolved during expansion; defensive fallthrough. -->
	<span>{node.param}</span>
{:else}
		<!-- A shipped primitive. The exhaustive registry guarantees a component. -->
		{@const Primitive = primitiveFor(node.kind as PrimitiveKind)}
		<Primitive {node} {ctx} />
	{/if}

<style>
	/* A context carrier, not a layout primitive: it owns no box or geometry. */
	.mo-within-context {
		display: contents;
	}
</style>

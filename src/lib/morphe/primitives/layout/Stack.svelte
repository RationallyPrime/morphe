<script lang="ts">
	/*
	 * Stack — the block/inline/auto flow container (Layout role).
	 *
	 * Pure positioning + a carrier of composition context. It descends the context
	 * algebra (depth+1, density-for-count, role demotion of scale tier), emits the
	 * continuous boundary vars (--mo-ctx-space / -type / -surface) on its root, and
	 * recurses into <Node> with the child context. LOCALITY: it resolves from
	 * (parent ctx, own role) only; STABILITY: density only steps when childCount
	 * crosses an enumerated threshold (handled inside `descend`).
	 *
	 * `direction:"auto"` flips the main axis with a CONTAINER QUERY — no JS in that
	 * loop. The nearest Frame / MorpheRoot establishes `container-type: inline-size`,
	 * so a Stack reads its own available inline size, not the viewport.
	 *
	 * Geometry never hardcodes pixels: gap comes from the density→space boundary
	 * var; the inline-flip breakpoint is expressed in `rem` so it tracks the user's
	 * root font size. No raw scale or intent is referenced by anything an author
	 * authored — the author emits a role + a direction + an emphasis CLAIM; the
	 * algebra compiles those into space.
	 *
	 * Agent edits ONLY this file. grammar/types.ts, registry, tokens, context: locked.
	 */

	import type { PrimitiveProps } from "../../render/props.js";
	import type { Stack } from "../../grammar/types.js";
	import { descend, boundaryStyle } from "../../context/Context.svelte.js";
	import { emphasisToStrokeStep, renderedChildEmphasis } from "../../context/algebra.js";
	import Node from "../../render/Node.svelte";

	let { node, ctx }: PrimitiveProps<Stack> = $props();

	// A server-driven tree is immutable per <Node> instance: a changed tree mounts
	// new keyed components, so the one-time context descent (which MUST run during
	// init, because setContext does) reads `node` directly. It descends from the
	// explicit `ctx` PROP (the prop chain is the real carrier — correct on SSR and
	// the first client render) and seeds the context channel as a fallback. Values
	// consumed in the template stay $derived for reactivity.
	// svelte-ignore state_referenced_locally
	const child = descend(node.role, { childCount: node.children.length }, ctx);

	// Budget-Conservation, WIRED (Lemma 2, law 4): renormalize the children's
	// claims against the budget B available to them and grant each child its
	// rendered emphasis below. The parent is the only place the whole sibling set
	// and B are both in scope, so the law runs HERE — not as a per-node self-claim.
	const grants = $derived(renderedChildEmphasis(child.emphasisBudget, node.children));

	const dir = $derived(node.direction ?? "auto");
	// This Stack renders at the emphasis its OWN parent granted it (carried on the
	// ctx prop), never its raw self-claim.
	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");
	const childStyle = $derived(boundaryStyle(child));
</script>

<div
	class="mo-stack"
	data-direction={dir}
	data-role={node.role}
	data-emphasis={emphasis}
	style={childStyle}
	style:--mo-ctx-stroke={emphasisToStrokeStep(emphasis)}
>
	{#each node.children as c, i (c)}
		<Node node={c} ctx={{ ...child, renderedEmphasis: grants[i] }} />
	{/each}
</div>

<style>
	.mo-stack {
		display: flex;
		flex-direction: column;
		gap: var(--mo-ctx-space, var(--mo-space-5));
		/* min-width:0 stops a flex child from overflowing its track (long text,
		   nested grids). Pure positioning hygiene, no geometry decision. */
		min-inline-size: 0;
	}

	/* Explicit axes. */
	.mo-stack[data-direction="inline"] {
		flex-direction: row;
		align-items: center;
	}
	.mo-stack[data-direction="block"] {
		flex-direction: column;
	}

	/*
	 * direction:auto — start as a block stack (the safe, narrow default) and flip
	 * to an inline row once THIS container (not the viewport) is wide enough. The
	 * container query reads the nearest container-type ancestor, so the flip is
	 * compositional, not global — a Stack inside a narrow panel stays stacked even
	 * on a wide page. No JS.
	 */
	.mo-stack[data-direction="auto"] {
		flex-direction: column;
	}
	@container (min-inline-size: 32rem) {
		.mo-stack[data-direction="auto"] {
			flex-direction: row;
			align-items: center;
		}
	}

	/*
	 * Emphasis is a CLAIM the algebra renormalizes against the budget; the rendered
	 * weight reaches a Stack as a data attribute. A layout primitive never paints
	 * functional color — it only adjusts neutral SEPARATION so an emphasized group
	 * reads as a unit. This is shape/spacing, never color-as-the-only-signal.
	 */
	.mo-stack[data-emphasis="strong"],
	.mo-stack[data-emphasis="critical"] {
		gap: var(--mo-ctx-space, var(--mo-space-5));
	}
</style>

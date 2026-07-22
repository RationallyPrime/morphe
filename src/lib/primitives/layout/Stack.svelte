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
	 * loop. The nearest Grid-owned cell / Frame / MorpheRoot establishes
	 * `container-type: inline-size`, so a Stack reads its own available inline size,
	 * not the viewport.
	 *
	 * Geometry never hardcodes pixels: gap comes from the density→space boundary
	 * var; the inline-flip breakpoint is expressed in `rem` so it tracks the user's
	 * root font size. No raw scale or intent is referenced by anything an author
	 * authored — the author emits a role + a direction + an emphasis CLAIM; the
	 * algebra compiles those into space.
	 *
	 * Agent edits ONLY this file. grammar/types.ts, registry, tokens, context: locked.
	 */

	import { emphasisToStrokeStep, transform } from "../../context/algebra.js";
	import {
		boundaryStyle,
		provideReactiveMorpheContext,
	} from "../../context/Context.svelte.js";
	import type { Stack } from "../../grammar/types.js";
	import { useChoices } from "../../render/choices.svelte.js";
	import { resolveChildEmphasisGrants } from "../../render/emphasis.js";
	import Node from "../../render/Node.svelte";
	import type { PrimitiveProps } from "../../render/props.js";

	const STRUCTURAL_BLOCK_ROLES: ReadonlySet<Stack["role"]> = new Set(["page", "section", "list"]);

	function defaultDirectionForRole(role: Stack["role"]): NonNullable<Stack["direction"]> {
		return STRUCTURAL_BLOCK_ROLES.has(role) ? "block" : "auto";
	}

	let { node, ctx }: PrimitiveProps<Stack> = $props();

	const providedChoices = useChoices();
	const choices = $derived(providedChoices?.current);

	// The explicit ctx prop is authoritative and can now change when a targeted
	// Within adapts this Stack. Keep the transform reactive while seeding a live
	// fallback context view during init (setContext itself cannot run later).
	const child = $derived(transform(ctx, node.role, { childCount: node.children.length }));
	provideReactiveMorpheContext(() => child);

	// Budget-Conservation, WIRED (Lemma 2, law 4): renormalize the children's
	// claims against the budget B available to them and grant each child its
	// rendered emphasis below. The parent is the only place the whole sibling set
	// and B are both in scope, so the law runs HERE — not as a per-node self-claim.
	const grants = $derived(resolveChildEmphasisGrants(child.emphasisBudget, node.children, choices));

	const dir = $derived(node.direction ?? defaultDirectionForRole(node.role));
	// This Stack renders at the emphasis its OWN parent granted it (carried on the
	// ctx prop), never its raw self-claim.
	const emphasis = $derived(ctx.renderedEmphasis ?? "normal");
	const childStyle = $derived(boundaryStyle(child));

	// Tree indent (author intent: a LEVEL, not pixels) — emitted as a unit count
	// the CSS multiplies by a space-scale step, so a deeper path insets further
	// while the value stays a count. Absent/0 ⇒ no inset (the grammar fixed-point).
	const indent = $derived(node.indent && node.indent > 0 ? node.indent : undefined);
</script>

<div
	class="mo-stack"
	data-direction={dir}
	data-role={node.role}
	data-emphasis={emphasis}
	style={childStyle}
	style:--mo-ctx-stroke={emphasisToStrokeStep(emphasis)}
	style:--mo-stack-indent={indent}
>
	{#each node.children as c, i (i)}
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
	 * Tree indent — a LEVEL compiled into space. The level rides --mo-stack-indent
	 * and the unit is a space-scale step, so a deeper account path (Expenses:SaaS:AI)
	 * insets further while the authored value stays a count, never a pixel. Inline-
	 * start only; inside a tabular row's leading cell the content shifts within the
	 * track, so column edges still line up.
	 */
	.mo-stack[style*="--mo-stack-indent"] {
		padding-inline-start: calc(var(--mo-stack-indent) * var(--mo-space-6));
	}

	/* Emphasis-to-separation is intentionally not wired until the algebra owns it. */
</style>

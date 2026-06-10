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
	import type { ActionMap } from "../state/actions.js";
	import type { MorpheStore } from "../state/store.svelte.js";
	import type { EscalationHandler } from "../state/events.js";
	import { provideActions } from "../state/actions.js";
	import { escalationWithDigest } from "../state/digest.js";
	import { provideEscalation } from "../state/escalation.js";
	import { registry as defaultRegistry, restrictCompounds } from "../compounds/factory.js";
	import { activeDialect } from "../dialects/active.svelte.js";
	import { applyDialect, dialectStyle, unknownIntentsIn } from "../dialects/provider.svelte.js";
	import { provideMorpheContext } from "../context/Context.svelte.js";
	import { provideCompoundResolver } from "./resolver.svelte.js";
	import {
		createInMemoryMorpheStore,
		provideMorpheStore,
		resolveMorpheStore,
		useMorpheStore,
	} from "../state/store.svelte.js";
	import Node from "./Node.svelte";

	interface Props {
		tree: MorpheNode;
		dialect?: Dialect;
		registry?: CompoundRegistry;
		store?: MorpheStore;
		/** Declared action ids (`Button.action`) resolve against this host map. */
		actions?: ActionMap;
		/**
		 * Dev flag: render `candidate`-lifecycle compounds without a dialect
		 * opt-in (preview/tooling surfaces). Promoted is the default visible set.
		 */
		showCandidates?: boolean;
		/**
		 * The tier-2 escalation boundary (Lemma 5): submit / task-transition /
		 * view-not-working surface here as TYPED events — never a DOM event,
		 * never a store write. Omit it and tier-2 affordances are simply inert.
		 */
		onEscalate?: EscalationHandler;
	}

	let {
		tree,
		dialect,
		registry = defaultRegistry,
		store,
		actions,
		showCandidates = false,
		onEscalate,
	}: Props = $props();

	// An explicit `dialect` prop OVERRIDES (preserving the subtree-boundary swap);
	// when OMITTED, follow the GLOBAL active dialect reactively, so flipping it
	// re-themes every following root at once.
	const effective = $derived(dialect ?? activeDialect.current);
	const applied = $derived.by(() => {
		const next = applyDialect(effective);
		if (import.meta.env.DEV) {
			for (const intent of unknownIntentsIn(tree, effective.intents)) {
				console.warn(`Unknown Morphe intent "${intent}" for dialect "${effective.id}".`);
			}
		}
		return next;
	});

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

	// G|D's compound half (Lemma 4): the tree expands against a dialect-restricted
	// VIEW of the registry, derived from the effective dialect's `compounds`
	// subset (empty = unrestricted, today's behavior). The base registry is never
	// mutated — every root holds its own view, so two roots under different
	// dialects restrict independently over the same singleton. Provided via
	// CONTEXT (as a reactive ref), not the `<Node>` prop chain: container
	// primitives recurse into `<Node>` themselves and would drop a prop-threaded
	// view at the first boundary.
	const resolver = $derived(
		restrictCompounds(registry, { allow: effective.compounds, showCandidates }),
	);
	provideCompoundResolver({
		get current() {
			return resolver;
		},
	});

	// Lemma 5 client-store ownership: prop beats inherited context, inherited
	// context beats the per-root in-memory default. The root provides the resolved
	// instance synchronously so bound primitives can read their initial tier-1
	// state during SSR and first client render.
	const inheritedStore = useMorpheStore();
	const rootDefaultStore = createInMemoryMorpheStore();
	// svelte-ignore state_referenced_locally
	const resolvedStore = resolveMorpheStore(store, inheritedStore, rootDefaultStore);
	provideMorpheStore(resolvedStore);

	// R1.4 declarative action binding: a Button carries only an opaque action id.
	// The live handler map is provided by the host at this root boundary, so the
	// authored tree stays data and page chrome/native controls remain unchanged.
	provideActions({
		get current() {
			return actions;
		},
	});

	// Tier-2 escalation boundary (Lemma 5): provided as a reactive ref so the
	// host can swap/remove its handler without remounting. Deliberately a
	// SEPARATE context from the store — input primitives consume the store and
	// never this, so a tier-1 handler has no escalation capability in scope. The
	// root wraps the host callback so every tier-2 event is recorded with the
	// point-in-time ContextDigest (R1.3), never a live store reference.
	provideEscalation({
		get current() {
			return escalationWithDigest(resolvedStore, onEscalate);
		},
	});
</script>

<div class="mo-root" data-mo-dialect={applied.attr} style={dialectStyle(applied)}>
	<Node node={tree} ctx={applied.rootContext} />
</div>

<style>
	.mo-root {
		container-type: inline-size;
		background: var(--mo-intent-surface-base);
		color: var(--mo-intent-on-surface);
		font-family: var(--mo-font-body);
	}
</style>
